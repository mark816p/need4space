// src/scoreboard.js — Global Scoreboard Client, Polling, and UI Viewer
// Why: Provides leaderboard browsing across all 16 categories (4 circuits x 4 difficulties),
// auto-refresh every 15s when visible, zero race-loop overhead when dormant, and seamless results submission.

export class ScoreboardClient {
  constructor() {
    this.endpoint = '/api/scoreboard';
    this.configLoaded = false;
  }

  async loadConfig() {
    if (this.configLoaded) return;
    try {
      const resp = await fetch('scoreboard-config.json');
      if (resp.ok) {
        const conf = await resp.json();
        if (conf.endpoint) {
          this.endpoint = conf.endpoint;
        }
      }
    } catch (e) {
      // Fallback to default '/api/scoreboard'
    }
    this.configLoaded = true;
  }

  async getScores(mapId = 'space', difficulty = 'normal', pilotName = null) {
    await this.loadConfig();
    const query = new URLSearchParams({
      map: mapId,
      difficulty: difficulty
    });
    if (pilotName) {
      query.set('name', pilotName);
    }

    try {
      const resp = await fetch(`${this.endpoint}?${query.toString()}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      return {
        error: 'Scores are unavailable. Try Refresh again.',
        scores: [],
        top: [],
        player: null,
        personal: null,
        storage: 'offline'
      };
    }
  }

  async submitTime(data) {
    await this.loadConfig();
    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const resJson = await resp.json();
      return resJson;
    } catch (err) {
      return {
        success: false,
        message: 'Your time was not saved. Please try again.'
      };
    }
  }
}

export const CIRCUITS = [
  { id: 'space', name: 'ORBITAL STATION', length: '26.6 KM', color: '#00d2ff' },
  { id: 'forest', name: 'FOREST MOON', length: '13.8 KM', color: '#00ff88' },
  { id: 'ice', name: 'ICE PLANET', length: '14.0 KM', color: '#38bdf8' },
  { id: 'desert', name: 'DESERT PLANET', length: '14.3 KM', color: '#fb923c' }
];

export const DIFFICULTIES = [
  { id: 'easy', label: 'EASY', color: '#4ade80' },
  { id: 'normal', label: 'NORMAL', color: '#38bdf8' },
  { id: 'hard', label: 'HARD', color: '#fbbf24' },
  { id: 'brutal', label: 'BRUTAL', color: '#f43f5e' }
];

export class ScoreboardUI {
  constructor(app, client = new ScoreboardClient()) {
    this.app = app;
    this.client = client;
    this.container = typeof document !== 'undefined' ? document.getElementById('scoreboard') : null;
    this.isOpen = false;

    this.currentCircuit = 'space';
    this.currentDifficulty = 'normal';
    this.pollTimer = null;
    this.cachedData = null;
    this.loading = false;
    this.errorMessage = null;

    this._bindEvents();
  }

  get active() {
    return this.isOpen;
  }

  _bindEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Handle visibility changes for polling
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOpen) {
        this.fetchAndRender();
        this._startPolling();
      } else {
        this._stopPolling();
      }
    });

    // Keyboard navigation when scoreboard is open
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.fetchAndRender();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        this._cycleCircuit(e.code === 'ArrowDown' ? 1 : -1);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        this._cycleDifficulty(e.code === 'ArrowRight' ? 1 : -1);
      }
    });
  }

  _cycleCircuit(dir) {
    const idx = CIRCUITS.findIndex(c => c.id === this.currentCircuit);
    const nextIdx = (idx + dir + CIRCUITS.length) % CIRCUITS.length;
    this.setBoard(CIRCUITS[nextIdx].id, this.currentDifficulty);
  }

  _cycleDifficulty(dir) {
    const idx = DIFFICULTIES.findIndex(d => d.id === this.currentDifficulty);
    const nextIdx = (idx + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
    this.setBoard(this.currentCircuit, DIFFICULTIES[nextIdx].id);
  }

  _startPolling() {
    this._stopPolling();
    // Auto-refresh every 15s only when visible and open
    this.pollTimer = setInterval(() => {
      if (this.isOpen && document.visibilityState === 'visible') {
        this.fetchAndRender(true);
      }
    }, 15000);
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getRememberedPilotName() {
    try {
      return localStorage.getItem('n4s_pilot_name') || 'Pilot';
    } catch (e) {
      return 'Pilot';
    }
  }

  setRememberedPilotName(name) {
    try {
      localStorage.setItem('n4s_pilot_name', name);
    } catch (e) {}
  }

  open(circuit = null, difficulty = null) {
    if (!this.container) return;
    this.isOpen = true;
    if (circuit) this.currentCircuit = circuit;
    if (difficulty) this.currentDifficulty = difficulty;

    this.container.classList.remove('hidden');
    this.fetchAndRender();
    this._startPolling();
  }

  close() {
    this._stopPolling();
    this.isOpen = false;
    if (this.container) {
      this.container.classList.add('hidden');
    }
    // Return to pause menu if game is paused
    if (this.app && this.app.menu && this.app.paused) {
      this.app.menu.showPauseMenu();
    }
  }

  setBoard(circuit, difficulty) {
    this.currentCircuit = circuit;
    this.currentDifficulty = difficulty;
    this.fetchAndRender();
  }

  async fetchAndRender(background = false) {
    if (!background) {
      this.loading = true;
      this.render();
    }

    const pilot = this.getRememberedPilotName();
    const data = await this.client.getScores(this.currentCircuit, this.currentDifficulty, pilot);
    this.loading = false;
    this.cachedData = data;
    this.errorMessage = data.error || null;
    this.render();
  }

  formatTime(seconds) {
    if (!seconds || seconds <= 0 || Number.isNaN(seconds)) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3).padStart(6, '0');
    return `${m}:${s}`;
  }

  render() {
    if (!this.container) return;

    const curCirc = CIRCUITS.find(c => c.id === this.currentCircuit) || CIRCUITS[0];
    const curDiff = DIFFICULTIES.find(d => d.id === this.currentDifficulty) || DIFFICULTIES[1];
    const rememberedName = this.getRememberedPilotName().trim().toLowerCase();

    // Circuit tabs
    const circuitTabsHtml = CIRCUITS.map(c => `
      <button class="sb-tab sb-circuit-tab ${c.id === this.currentCircuit ? 'active' : ''}" data-circuit="${c.id}" style="--tab-color: ${c.color}">
        <span class="sb-tab-title">${c.name}</span>
        <span class="sb-tab-sub">${c.length}</span>
      </button>
    `).join('');

    // Difficulty tabs
    const diffTabsHtml = DIFFICULTIES.map(d => `
      <button class="sb-tab sb-diff-tab ${d.id === this.currentDifficulty ? 'active' : ''}" data-diff="${d.id}" style="--tab-color: ${d.color}">
        <img src="assets/ui/need4space-v1/icon-${d.id}.svg" class="sb-diff-icon" alt="${d.label}">
        <span>${d.label}</span>
      </button>
    `).join('');

    // Table rows
    let tableRows = '';
    const scores = (this.cachedData && this.cachedData.scores) || [];

    if (this.loading && (!this.cachedData || !scores.length)) {
      tableRows = `<tr><td colspan="7" class="sb-status-cell">CONNECTING TO SCOREBOARD SERVICE...</td></tr>`;
    } else if (this.errorMessage) {
      tableRows = `
        <tr>
          <td colspan="7" class="sb-status-cell sb-error-cell">
            ${this.errorMessage}
            <button class="btn btn-sm btn-retry" id="sb-retry-btn">RETRY (R)</button>
          </td>
        </tr>
      `;
    } else if (!scores.length) {
      tableRows = `<tr><td colspan="7" class="sb-status-cell">NO REGISTERED TIMES FOR THIS BOARD YET. BE THE FIRST!</td></tr>`;
    } else {
      scores.forEach((entry, idx) => {
        const isPlayer = entry.name && entry.name.trim().toLowerCase() === rememberedName;
        const totalStr = this.formatTime(entry.total);
        const bestStr = this.formatTime(entry.best);
        const rank = idx + 1;
        const rankClass = rank === 1 ? 'rank-gold' : (rank === 2 ? 'rank-silver' : (rank === 3 ? 'rank-bronze' : ''));

        tableRows += `
          <tr class="sb-row ${isPlayer ? 'sb-player-highlight' : ''}">
            <td class="col-rank ${rankClass}">${rank}</td>
            <td class="col-pilot">${escapeHtml(entry.name || 'Anonymous')}</td>
            <td class="col-ship">${escapeHtml(entry.ship || 'feather').toUpperCase()}</td>
            <td class="col-total font-mono">${totalStr}</td>
            <td class="col-best font-mono">${bestStr}</td>
            <td class="col-pts">+${entry.points || 0}</td>
            <td class="col-date">${entry.date ? new Date(entry.date * 1000).toLocaleDateString() : '—'}</td>
          </tr>
        `;
      });
    }

    // Personal rank display
    let personalCardHtml = '';
    const personal = this.cachedData && (this.cachedData.personal || this.cachedData.player);
    if (personal && personal.entry) {
      const pEntry = personal.entry;
      personalCardHtml = `
        <div class="sb-personal-card">
          <div class="sb-personal-label">YOUR REGISTERED STANDING</div>
          <div class="sb-personal-stats">
            <span class="sb-personal-rank">#${personal.rank}</span>
            <span class="sb-personal-name">${escapeHtml(pEntry.name)}</span>
            <span class="sb-personal-time font-mono">TOTAL: ${this.formatTime(pEntry.total)}</span>
            <span class="sb-personal-best font-mono">BEST LAP: ${this.formatTime(pEntry.best)}</span>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="dialog-card scoreboard-card">
        <div class="sb-header">
          <div class="sb-title-group">
            <h2 class="dialog-title sb-title">GLOBAL SCOREBOARD</h2>
            <div class="sb-storage-badge badge-${this.cachedData ? this.cachedData.storage : 'local'}">
              ${(this.cachedData && this.cachedData.storage === 'github') ? '● GITHUB CLOUD' : '● LOCAL DB'}
            </div>
          </div>
          <button class="sb-close-btn" id="sb-close-btn" aria-label="Close Scoreboard">✕</button>
        </div>

        <!-- Circuit Selector Tabs -->
        <div class="sb-circuits-bar">
          ${circuitTabsHtml}
        </div>

        <!-- Difficulty Selector Tabs -->
        <div class="sb-diffs-bar">
          ${diffTabsHtml}
        </div>

        <!-- Leaderboard Table -->
        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead>
              <tr>
                <th class="col-rank">POS</th>
                <th class="col-pilot">PILOT</th>
                <th class="col-ship">CRAFT</th>
                <th class="col-total">TOTAL TIME</th>
                <th class="col-best">BEST LAP</th>
                <th class="col-pts">SCORE</th>
                <th class="col-date">DATE</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        ${personalCardHtml}

        <div class="sb-footer">
          <div class="sb-hints">
            <span><span class="hint-key">▲▼</span> Circuit</span>
            <span><span class="hint-key">◀▶</span> Difficulty</span>
            <span><span class="hint-key">R</span> Refresh</span>
            <span><span class="hint-key">Esc</span> Close</span>
          </div>
          <button class="btn btn-primary" id="sb-refresh-btn">REFRESH (R)</button>
        </div>
      </div>
    `;

    // Bind UI actions
    this.container.querySelectorAll('[data-circuit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const c = e.currentTarget.dataset.circuit;
        this.setBoard(c, this.currentDifficulty);
      });
    });

    this.container.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const d = e.currentTarget.dataset.diff;
        this.setBoard(this.currentCircuit, d);
      });
    });

    this.container.querySelector('#sb-close-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#sb-refresh-btn')?.addEventListener('click', () => this.fetchAndRender());
    this.container.querySelector('#sb-retry-btn')?.addEventListener('click', () => this.fetchAndRender());
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
