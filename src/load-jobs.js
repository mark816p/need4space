// src/load-jobs.js — Web Worker pool for parallel background generation
// Why: Offloads heavy procedural terrain generation and math calculations from the main UI thread

import * as MathKernels from './load-math.js';

export class WorkerPool {
  constructor(poolSize = 2) {
    this.poolSize = Math.max(1, Math.min(poolSize, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4));
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();
    this.jobIdCounter = 1;
    this.hasWorkers = false;

    this._initWorkers();
  }

  _initWorkers() {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
      return;
    }

    try {
      // Inline Worker source code bundling MathKernels
      const workerCode = `
        const MathKernels = {
          lerp: ${MathKernels.lerp.toString()},
          clamp: ${MathKernels.clamp.toString()},
          smoothstep: ${MathKernels.smoothstep.toString()},
          hash2d: ${MathKernels.hash2d.toString()},
          valueNoise2D: ${MathKernels.valueNoise2D.toString()},
          fbm2D: ${MathKernels.fbm2D.toString()},
          generateHeightmapChunk: ${MathKernels.generateHeightmapChunk.toString()}
        };

        self.onmessage = function(e) {
          const { id, type, payload } = e.data;
          try {
            if (type === 'heightmap') {
              const { startX, startZ, sizeX, sizeZ, scale, heightScale } = payload;
              const heights = MathKernels.generateHeightmapChunk(startX, startZ, sizeX, sizeZ, scale, heightScale);
              self.postMessage({ id, success: true, result: heights }, [heights.buffer]);
            } else {
              self.postMessage({ id, success: false, error: 'Unknown job type: ' + type });
            }
          } catch (err) {
            self.postMessage({ id, success: false, error: err.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(workerUrl);
        worker.busy = false;
        worker.onmessage = (e) => this._onWorkerMessage(worker, e);
        worker.onerror = (err) => this._onWorkerError(worker, err);
        this.workers.push(worker);
      }
      this.hasWorkers = true;
    } catch (e) {
      console.warn('[WorkerPool] Worker instantiation unavailable; falling back to main-thread execution:', e);
      this.hasWorkers = false;
    }
  }

  _onWorkerMessage(worker, e) {
    worker.busy = false;
    const { id, success, result, error } = e.data;
    const pending = this.activeJobs.get(id);
    if (pending) {
      this.activeJobs.delete(id);
      if (success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error));
      }
    }
    this._drain();
  }

  _onWorkerError(worker, err) {
    worker.busy = false;
    console.error('[WorkerPool] Worker error:', err);
    this._drain();
  }

  _drain() {
    if (!this.queue.length) return;
    const idleWorker = this.workers.find(w => !w.busy);
    if (!idleWorker) return;

    const task = this.queue.shift();
    idleWorker.busy = true;
    idleWorker.postMessage({
      id: task.id,
      type: task.type,
      payload: task.payload
    });
  }

  /**
   * Execute an async job via worker or fallback synchronously
   */
  execute(type, payload) {
    return new Promise((resolve, reject) => {
      const id = this.jobIdCounter++;

      if (!this.hasWorkers) {
        // Fallback to synchronous execution on main thread
        try {
          if (type === 'heightmap') {
            const { startX, startZ, sizeX, sizeZ, scale, heightScale } = payload;
            const res = MathKernels.generateHeightmapChunk(startX, startZ, sizeX, sizeZ, scale, heightScale);
            resolve(res);
          } else {
            reject(new Error(`Unknown job type ${type}`));
          }
        } catch (e) {
          reject(e);
        }
        return;
      }

      this.activeJobs.set(id, { resolve, reject, type, payload });
      this.queue.push({ id, type, payload });
      this._drain();
    });
  }

  terminate() {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.hasWorkers = false;
  }
}

export const defaultWorkerPool = new WorkerPool();
