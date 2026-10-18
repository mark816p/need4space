// src/showroom.js — 3D Ship Showroom modal, rotating black glass stand, softbox highlights, drag-rotation, and stat cards
// Why: "P11.4 The Comet R1 and the Showroom (v1.3.0). 3D Showroom: modal with rotating black glass stand,
// softbox highlights, drag-rotation, zoom, stat cards. Ship selector in menu."

import * as THREE from 'three';
import { buildFeatherS1, buildCometR1, buildAnvilH1, createShipMaterials } from './shipmodels.js';
import { Ship } from './ship.js';
import { HANDLING } from './ships.js';
import { damp, clamp } from './noise.js';

export const SHOWROOM_SHIPS = [
  {
    kind: 'feather',
    id: 'feather',
    name: 'FEATHER S1',
    cls: 'INTERCEPTOR',
    desc: 'Precision needle craft with twin turbofans on swept wings. Supreme agility and razor-sharp line adherence.',
    defaultColor: 0xe62233
  },
  {
    kind: 'rocket',
    id: 'rocket',
    name: 'COMET R1',
    cls: 'ROCKET MANTA',
    desc: 'Titanium manta on two hover sponsons with a single massive tail rocket and 18-tooth folding petal nozzle. Highest straight-line speed.',
    defaultColor: 0xffaa00
  },
  {
    kind: 'heavy',
    id: 'heavy',
    name: 'ANVIL H1',
    cls: 'HEAVY ARMORED',
    desc: 'Armored lifting body with dual magnetic pulse rings. Unshakable track grip and devastating boost impulse.',
    defaultColor: 0x8844ff
  }
];

export const LIVERY_COLORS = [
  { name: 'RACING RED', hex: 0xe62233, css: '#e62233' },
  { name: 'SOLAR AMBER', hex: 0xffaa00, css: '#ffaa00' },
  { name: 'CYAN PULSE', hex: 0x00d2ff, css: '#00d2ff' },
  { name: 'VORTEX EMERALD', hex: 0x00ff88, css: '#00ff88' },
  { name: 'NEXUS VIOLET', hex: 0x8833ee, css: '#8833ee' },
  { name: 'ZENITH WHITE', hex: 0xf0f2f5, css: '#f0f2f5' }
];

export class Showroom {
  constructor(app = null) {
    this.app = app;
    this.isOpen = false;
    this.currentShipIdx = 0;
    this.currentLiveryHex = 0xe62233;

    // Camera orbit parameters
    this.orbitRadius = 14.5;
    this.theta = 0.45; // Azimuth
    this.phi = 0.32;   // Elevation
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.autoRotate = true;

    // Three.js Scene & Lighting
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.2, 500);
    this.camera.position.set(0, 3.5, 14.5);
    this.camera.lookAt(0, 0.5, 0);

    this.shipInstance = null;
    this.shipGroup = new THREE.Group();
    this.shipGroup.name = 'showroom_ship_holder';
    this.scene.add(this.shipGroup);

    this._initStudio();
    this._initDom();
  }

  _initStudio() {
    // 1. Black Glass Turntable Stand
    const standGeom = new THREE.CylinderGeometry(8.5, 8.5, 0.45, 64);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x090c12,
      roughness: 0.04,
      metalness: 0.96
    });
    this.turntable = new THREE.Mesh(standGeom, standMat);
    this.turntable.position.set(0, -0.25, 0);
    this.turntable.receiveShadow = true;
    this.scene.add(this.turntable);

    // Glowing Rim Accent on Turntable
    const rimGeom = new THREE.TorusGeometry(8.5, 0.06, 16, 64);
    rimGeom.rotateX(Math.PI * 0.5);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, toneMapped: false });
    this.turntableRim = new THREE.Mesh(rimGeom, rimMat);
    this.turntableRim.position.set(0, -0.02, 0);
    this.scene.add(this.turntableRim);

    // Dark Floor Plane around stand
    const floorGeom = new THREE.PlaneGeometry(120, 120);
    floorGeom.rotateX(-Math.PI * 0.5);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x040609,
      roughness: 0.2,
      metalness: 0.8
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.position.set(0, -0.26, 0);
    this.scene.add(floorMesh);

    // 2. Softbox Studio Highlights (Key, Rim, Fill, Overhead)
    this.softboxTop = new THREE.DirectionalLight(0xfffaee, 2.4);
    this.softboxTop.position.set(12, 16, 14);
    this.scene.add(this.softboxTop);

    this.softboxRim = new THREE.DirectionalLight(0x77bbee, 2.8);
    this.softboxRim.position.set(-14, 12, -15);
    this.scene.add(this.softboxRim);

    this.softboxFill = new THREE.DirectionalLight(0x223344, 0.7);
    this.softboxFill.position.set(0, -4, 10);
    this.scene.add(this.softboxFill);

    const ambientLight = new THREE.AmbientLight(0x0e141f, 0.65);
    this.scene.add(ambientLight);
  }

  _initDom() {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'showroom-modal';
    this.container.className = 'dialog-overlay hidden';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: radial-gradient(circle at center, rgba(10, 15, 25, 0.94) 0%, rgba(3, 5, 8, 0.98) 100%);
      z-index: 9999; display: flex; flex-direction: column; overflow: hidden;
      font-family: 'Rajdhani', sans-serif;
    `;

    this.container.innerHTML = `
      <div style="position: absolute; top: 16px; left: 24px; z-index: 10;">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 22px; font-weight: 900; color: #fff; letter-spacing: 3px;">
          NEED<span style="color: #00d2ff;">4</span>SPACE <span style="font-size: 14px; color: #8fa3b8; font-weight: 500;">// 3D SHOWROOM</span>
        </div>
      </div>

      <div style="position: absolute; top: 16px; right: 24px; z-index: 10;">
        <button id="sr-btn-close" class="btn" style="padding: 6px 18px; font-family: 'Orbitron', sans-serif; font-size: 13px;">EXIT</button>
      </div>

      <canvas id="sr-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></canvas>

      <!-- Bottom HUD & Stat Breakdown -->
      <div style="position: absolute; bottom: 20px; left: 24px; right: 24px; display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; z-index: 10;">
        <!-- Left: Ship Identity & Selector -->
        <div style="background: rgba(13, 20, 32, 0.88); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 18px 24px; width: 340px; pointer-events: auto; backdrop-filter: blur(8px);">
          <div id="sr-ship-class" style="font-size: 11px; letter-spacing: 2px; color: #00d2ff; font-weight: 700; margin-bottom: 2px;">INTERCEPTOR</div>
          <div id="sr-ship-name" style="font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 900; color: #fff; letter-spacing: 1px;">FEATHER S1</div>
          <p id="sr-ship-desc" style="font-size: 13px; color: #94a3b8; line-height: 1.35; margin: 8px 0 14px 0;"></p>

          <div style="display: flex; gap: 8px; margin-bottom: 14px;">
            <button id="sr-btn-prev" class="btn" style="flex: 1; padding: 8px;">◀ PREV</button>
            <button id="sr-btn-next" class="btn" style="flex: 1; padding: 8px;">NEXT ▶</button>
          </div>

          <button id="sr-btn-select" class="btn btn-primary" style="width: 100%; padding: 10px; font-family: 'Orbitron', sans-serif; font-size: 14px; font-weight: 700;">ENGAGE SHIP</button>
        </div>

        <!-- Center: Livery Palette Switcher -->
        <div style="background: rgba(13, 20, 32, 0.88); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 12px 18px; pointer-events: auto; backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="font-size: 11px; letter-spacing: 2px; color: #8fa3b8; font-weight: 700;">HULL LIVERY PALETTE</div>
          <div id="sr-livery-row" style="display: flex; gap: 8px;"></div>
        </div>

        <!-- Right: Technical Specification Telemetry -->
        <div style="background: rgba(13, 20, 32, 0.88); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 18px 24px; width: 340px; pointer-events: auto; backdrop-filter: blur(8px);">
          <div style="font-size: 11px; letter-spacing: 2px; color: #00d2ff; font-weight: 700; margin-bottom: 10px;">TECHNICAL SPECIFICATIONS</div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8fa3b8; margin-bottom: 2px;">
              <span>MAX VELOCITY</span><span id="sr-val-speed" style="color: #fff; font-weight: 700;">900 KM/H</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div id="sr-bar-speed" style="height: 100%; width: 75%; background: #00d2ff;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8fa3b8; margin-bottom: 2px;">
              <span>ACCELERATION</span><span id="sr-val-accel" style="color: #fff; font-weight: 700;">115 M/S²</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div id="sr-bar-accel" style="height: 100%; width: 65%; background: #00ff88;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8fa3b8; margin-bottom: 2px;">
              <span>LATERAL ADHERENCE (GRIP)</span><span id="sr-val-grip" style="color: #fff; font-weight: 700;">12.5 G</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div id="sr-bar-grip" style="height: 100%; width: 80%; background: #ffaa00;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8fa3b8; margin-bottom: 2px;">
              <span>ANGULAR TURN RATE</span><span id="sr-val-turn" style="color: #fff; font-weight: 700;">2.25 RAD/S</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div id="sr-bar-turn" style="height: 100%; width: 85%; background: #ff3366;"></div>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8fa3b8; margin-bottom: 2px;">
              <span>DRY MASS</span><span id="sr-val-mass" style="color: #fff; font-weight: 700;">1000 KG</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.canvas = this.container.querySelector('#sr-canvas');

    // Bind event listeners
    this._bindEvents();
  }

  _bindEvents() {
    if (!this.container) return;

    this.container.querySelector('#sr-btn-close')?.addEventListener('click', () => this.close());
    this.container.querySelector('#sr-btn-prev')?.addEventListener('click', () => this.prevShip());
    this.container.querySelector('#sr-btn-next')?.addEventListener('click', () => this.nextShip());
    this.container.querySelector('#sr-btn-select')?.addEventListener('click', () => this.selectShip());

    // Livery swatches
    const liveryRow = this.container.querySelector('#sr-livery-row');
    if (liveryRow) {
      liveryRow.innerHTML = '';
      for (const col of LIVERY_COLORS) {
        const swatch = document.createElement('button');
        swatch.style.cssText = `
          width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff;
          background: ${col.css}; cursor: pointer; transition: transform 0.15s;
        `;
        swatch.title = col.name;
        swatch.addEventListener('click', () => {
          this.currentLiveryHex = col.hex;
          this._rebuildShip();
        });
        liveryRow.appendChild(swatch);
      }
    }

    // Pointer Drag Rotation & Zoom on Canvas
    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', (e) => {
        this.isDragging = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        this.theta -= dx * 0.007;
        this.phi = clamp(this.phi + dy * 0.007, 0.05, 1.25);
      });

      const stopDrag = (e) => {
        if (this.isDragging) {
          this.isDragging = false;
          try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      this.canvas.addEventListener('pointerup', stopDrag);
      this.canvas.addEventListener('pointercancel', stopDrag);

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.orbitRadius = clamp(this.orbitRadius + e.deltaY * 0.015, 7.5, 24.0);
      }, { passive: false });
    }
  }

  _rebuildShip() {
    while (this.shipGroup.children.length > 0) {
      this.shipGroup.remove(this.shipGroup.children[0]);
    }

    const shipDef = SHOWROOM_SHIPS[this.currentShipIdx];
    const liveryHex = this.currentLiveryHex || shipDef.defaultColor;
    const mats = createShipMaterials(liveryHex, 0x1f242d);

    let model;
    if (shipDef.kind === 'rocket') {
      model = buildCometR1(mats);
    } else if (shipDef.kind === 'heavy') {
      model = buildAnvilH1(mats);
    } else {
      model = buildFeatherS1(mats);
    }

    this.shipInstance = new Ship(model, { isRival: false });
    this.shipInstance.root.position.set(0, 0.65, 0);
    this.shipGroup.add(this.shipInstance.root);

    // Initial startup animation state
    this.shipInstance.canopyT = 0.0;
    this.shipInstance.canopyTarget = 1.0;
    this.shipInstance.power = 0.0;
    this.shipInstance.setEngine(true);

    this._updateStatsUi();
  }

  _updateStatsUi() {
    if (!this.container) return;
    const shipDef = SHOWROOM_SHIPS[this.currentShipIdx];
    const h = HANDLING[shipDef.kind] || HANDLING.feather;

    const elName = this.container.querySelector('#sr-ship-name');
    const elClass = this.container.querySelector('#sr-ship-class');
    const elDesc = this.container.querySelector('#sr-ship-desc');
    const elBtnSelect = this.container.querySelector('#sr-btn-select');

    if (elName) elName.textContent = shipDef.name;
    if (elClass) elClass.textContent = shipDef.cls;
    if (elDesc) elDesc.textContent = shipDef.desc;

    // Check if this ship is currently active in settings
    const currentActive = this.app?.settings?.get('selectedShip') || 'feather';
    if (elBtnSelect) {
      if (currentActive === shipDef.kind) {
        elBtnSelect.textContent = 'CURRENT SHIP (ACTIVE)';
        elBtnSelect.style.borderColor = '#00ff88';
        elBtnSelect.style.color = '#00ff88';
      } else {
        elBtnSelect.textContent = 'ENGAGE SHIP';
        elBtnSelect.style.borderColor = 'var(--accent-cyan)';
        elBtnSelect.style.color = '#fff';
      }
    }

    // Technical numbers
    const topKmh = Math.round(h.topSpeed * 3.6);
    this._setText('#sr-val-speed', `${topKmh} KM/H`);
    this._setBar('#sr-bar-speed', (h.topSpeed / 300.0) * 100);

    this._setText('#sr-val-accel', `${Math.round(h.accel)} M/S²`);
    this._setBar('#sr-bar-accel', (h.accel / 150.0) * 100);

    this._setText('#sr-val-grip', `${h.grip.toFixed(1)} G`);
    this._setBar('#sr-bar-grip', (h.grip / 16.0) * 100);

    this._setText('#sr-val-turn', `${h.turnRate.toFixed(2)} RAD/S`);
    this._setBar('#sr-bar-turn', (h.turnRate / 2.5) * 100);

    this._setText('#sr-val-mass', `${h.mass} KG`);
  }

  _setText(selector, val) {
    const el = this.container.querySelector(selector);
    if (el) el.textContent = val;
  }

  _setBar(selector, pct) {
    const el = this.container.querySelector(selector);
    if (el) el.style.width = `${Math.min(100, Math.max(5, pct))}%`;
  }

  prevShip() {
    this.currentShipIdx = (this.currentShipIdx - 1 + SHOWROOM_SHIPS.length) % SHOWROOM_SHIPS.length;
    this.currentLiveryHex = SHOWROOM_SHIPS[this.currentShipIdx].defaultColor;
    this._rebuildShip();
  }

  nextShip() {
    this.currentShipIdx = (this.currentShipIdx + 1) % SHOWROOM_SHIPS.length;
    this.currentLiveryHex = SHOWROOM_SHIPS[this.currentShipIdx].defaultColor;
    this._rebuildShip();
  }

  selectShip(kind = null) {
    const shipKind = kind || SHOWROOM_SHIPS[this.currentShipIdx].kind;
    if (this.app?.settings) {
      this.app.settings.set('selectedShip', shipKind);
      this.app.settings.save();
    }
    this._updateStatsUi();
  }

  open() {
    if (!this.container) return;
    this.isOpen = true;
    this.container.classList.remove('hidden');

    // Synchronize to current active ship in settings
    const activeKind = this.app?.settings?.get('selectedShip') || 'feather';
    const foundIdx = SHOWROOM_SHIPS.findIndex(s => s.kind === activeKind);
    if (foundIdx >= 0) this.currentShipIdx = foundIdx;
    this.currentLiveryHex = SHOWROOM_SHIPS[this.currentShipIdx].defaultColor;

    this._rebuildShip();

    // Start dedicated render loop
    this.lastTime = performance.now();
    this._renderLoop = (now) => {
      if (!this.isOpen) return;
      requestAnimationFrame(this._renderLoop);
      const dt = Math.min(0.1, (now - this.lastTime) * 0.001);
      this.lastTime = now;
      this.update(dt);
      this.render();
    };
    requestAnimationFrame(this._renderLoop);
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  update(dt) {
    if (this.autoRotate && !this.isDragging) {
      this.theta += dt * 0.22;
    }

    // Camera orbital spherical coordinates
    const cx = Math.sin(this.theta) * Math.cos(this.phi) * this.orbitRadius;
    const cy = Math.sin(this.phi) * this.orbitRadius + 0.5;
    const cz = Math.cos(this.theta) * Math.cos(this.phi) * this.orbitRadius;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 0.65, 0);

    // Update ship startup animation and idle engine spool
    if (this.shipInstance) {
      this.shipInstance.update(dt, { throttle: 0.15, speed: 0, boost: false });
      // Road deck lighting preview on stand
      const standFrame = {
        pos: new THREE.Vector3(0, 0, 0),
        U: new THREE.Vector3(0, 1, 0),
        R: new THREE.Vector3(1, 0, 0),
        T: new THREE.Vector3(0, 0, 1)
      };
      this.shipInstance.setDeckLight(standFrame, 0x090c12, this.app?.settings?.data);
    }
  }

  render() {
    if (!this.canvas || !this.app?.renderer) return;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    const origTarget = this.app.renderer.getRenderTarget();
    this.app.renderer.setRenderTarget(null);
    this.app.renderer.setViewport(0, 0, w, h);
    this.app.renderer.clear();
    this.app.renderer.render(this.scene, this.camera);
    this.app.renderer.setRenderTarget(origTarget);
  }

  async prepare(renderer) {
    if (renderer && renderer.compileAsync) {
      await renderer.compileAsync(this.scene, this.camera);
    }
  }
}

let _showroomInstance = null;
export function openShowroom(app) {
  if (!_showroomInstance) {
    _showroomInstance = new Showroom(app);
  }
  _showroomInstance.open();
  return _showroomInstance;
}
