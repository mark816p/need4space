// src/menu.js — Pause menu, options dialog, results standings, and changelog viewer
// Why: Clean modal navigation for settings, restart, audio/video configuration, and race finish

import { CHANGELOG, CURRENT_VERSION } from './changelog.js';

export class MenuManager {
  constructor(app) {
    this.app = app;
    const hasDoc = typeof document !== 'undefined';
    this.elMenu = hasDoc ? document.getElementById('menu') : null;
    this.elSettings = hasDoc ? document.getElementById('settings') : null;
    this.elResults = hasDoc ? document.getElementById('results') : null;

    this.isOpen = false;
    this.currentView = null; // 'pause' | 'settings' | 'results' | 'circuits' | 'changelog' | 'whats-new'

    this._bindEvents();
  }

  get active() {
    return this.isOpen;
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.currentView === 'settings' || this.currentView === 'circuits' || this.currentView === 'changelog' || this.currentView === 'whats-new') {
          this._renderPauseMenu();
        } else {
          this.togglePause();
        }
      } else if (e.code === 'KeyR') {
        if (this.currentView === 'results' || this.app.paused) {
          this.restartRace();
        }
      } else if (this.isOpen) {
        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
          e.preventDefault();
          this._navigateButtons(e.code === 'ArrowDown' ? 1 : -1);
        } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
          const focused = document.activeElement;
          if (focused && focused.tagName === 'BUTTON') {
            focused.click();
          }
        }
      }
    });
  }

  _navigateButtons(dir) {
    const activeDialog = this.elSettings && !this.elSettings.classList.contains('hidden') ? this.elSettings :
                         this.elResults && !this.elResults.classList.contains('hidden') ? this.elResults :
                         this.elMenu && !this.elMenu.classList.contains('hidden') ? this.elMenu : null;
    if (!activeDialog) return;
    const btns = Array.from(activeDialog.querySelectorAll('button:not(.hint-btn)'));
    if (!btns.length) return;
    const curIdx = btns.indexOf(document.activeElement);
    let nextIdx = 0;
    if (curIdx >= 0) {
      nextIdx = (curIdx + dir + btns.length) % btns.length;
    } else if (dir < 0) {
      nextIdx = btns.length - 1;
    }
    btns[nextIdx].focus();
  }

  _renderHints(container) {
    if (!container || typeof container.querySelector !== 'function' || typeof document === 'undefined') return;
    const card = container.querySelector('.dialog-card');
    if (!card) return;
    const hints = document.createElement('div');
    hints.className = 'menu-hints';
    hints.innerHTML = `
      <button class="hint-btn" id="hint-esc"><span class="hint-key">Esc</span> Back</button>
      <button class="hint-btn" id="hint-enter"><span class="hint-key">↵</span> Enter</button>
      <button class="hint-btn" id="hint-arrows"><span class="hint-key">▲▼</span> Navigate</button>
      <button class="hint-btn" id="hint-r"><span class="hint-key">R</span> Restart</button>
    `;

    hints.querySelector('#hint-esc')?.addEventListener('click', () => {
      if (this.currentView === 'settings' || this.currentView === 'circuits' || this.currentView === 'changelog' || this.currentView === 'whats-new') {
        this._renderPauseMenu();
      } else if (this.isOpen) {
        this.resume();
      }
    });
    hints.querySelector('#hint-enter')?.addEventListener('click', () => {
      const focused = document.activeElement;
      if (focused && typeof focused.click === 'function') focused.click();
    });
    hints.querySelector('#hint-arrows')?.addEventListener('click', () => {
      this._navigateButtons(1);
    });
    hints.querySelector('#hint-r')?.addEventListener('click', () => {
      this.restartRace();
    });

    card.appendChild(hints);
  }

  togglePause() {
    if (this.currentView === 'results') return;

    if (this.isOpen) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause() {
    this.isOpen = true;
    this.app.paused = true;
    this.currentView = 'pause';
    this._renderPauseMenu();
  }

  resume() {
    this.isOpen = false;
    this.app.paused = false;
    this.currentView = null;
    this._hideAllDialogs();
  }

  restartRace() {
    this.resume();
    if (this.app.race) {
      this.app.race._buildGrid();
      this.app.race.state = 'countdown';
      this.app.race.countdownTime = 4.0;
      this.app.race.elapsedTime = 0.0;
      this.app.playerRacer = this.app.race.playerRacer;
    }
    if (this.app.hud) {
      this.app.hud.currentLapTime = 0.0;
      this.app.hud.totalRaceTime = 0.0;
      this.app.hud.score = 0;
      this.app.hud.currentLap = 1;
    }
    if (this.app.music) {
      this.app.music.stop();
    }
  }

  _hideAllDialogs() {
    if (this.elMenu) this.elMenu.classList.add('hidden');
    if (this.elSettings) this.elSettings.classList.add('hidden');
    if (this.elResults) this.elResults.classList.add('hidden');
  }

  _renderPauseMenu() {
    if (!this.elMenu) return;
    this._hideAllDialogs();
    this.elMenu.classList.remove('hidden');
    this.currentView = 'pause';

    this.elMenu.innerHTML = `
      <div class="dialog-card">
        <h2 class="dialog-title">SYSTEM PAUSED</h2>
        <div class="menu-list">
          <button class="btn btn-primary" id="btn-resume">RESUME RACE</button>
          <button class="btn" id="btn-restart">RESTART CIRCUIT</button>
          <button class="btn" id="btn-circuits">SELECT CIRCUIT</button>
          <button class="btn" id="btn-options">OPTIONS</button>
          <button class="btn" id="btn-whats-new">WHAT'S NEW IN v${CURRENT_VERSION}</button>
          <button class="btn" id="btn-changelog">CHANGELOG</button>
        </div>
      </div>
    `;

    this._renderHints(this.elMenu);
    document.getElementById('btn-resume')?.addEventListener('click', () => this.resume());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.restartRace());
    document.getElementById('btn-circuits')?.addEventListener('click', () => this.showCircuits());
    document.getElementById('btn-options')?.addEventListener('click', () => this.showOptions());
    document.getElementById('btn-whats-new')?.addEventListener('click', () => this.showWhatsNew());
    document.getElementById('btn-changelog')?.addEventListener('click', () => this.showChangelog());
  }

  showWhatsNew() {
    if (!this.elMenu) return;
    this._hideAllDialogs();
    this.elMenu.classList.remove('hidden');
    this.currentView = 'whats-new';

    this.elMenu.innerHTML = `
      <div class="dialog-card whats-new-card" style="max-width: 680px;">
        <h2 class="dialog-title">WHAT'S NEW IN v1.1 "FOUR WORLDS"</h2>
        <div class="whats-new-body" style="text-align: left; max-height: 380px; overflow-y: auto; margin: 12px 0 16px 0; padding: 14px 18px; background: rgba(0,0,0,0.45); border-radius: 6px; font-size: 14px; line-height: 1.6; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08);">
          <h3 style="color: var(--accent-cyan); font-family: Orbitron, sans-serif; font-size: 14px; margin-top: 4px; margin-bottom: 6px; letter-spacing: 1px;">FOUR EXPANSIVE PLANETARY CIRCUITS</h3>
          <p style="margin-bottom: 10px;"><strong style="color: #fff;">Orbital Station (26.6 km):</strong> Space route threading the 12 km derelict Colossus through its engine bell, pulsing reactor hall, vacuum break leap, upside-down hold, and barbette trench run.</p>
          <p style="margin-bottom: 10px;"><strong style="color: var(--accent-green);">Forest Moon (13.8 km):</strong> High-speed canopy sweepers, floating island crest jump, subterranean lake cavern, 600m verdant loop, and inverted flight past a colossal reptile skeleton.</p>
          <p style="margin-bottom: 10px;"><strong style="color: #38bdf8;">Ice Planet (14.0 km):</strong> Glacial sastrugi, crystal garden prisms with internal facets, 270m crevasse dive, glacier bore cave, and sea floes gravity flips in howling blizzards.</p>
          <p style="margin-bottom: 14px;"><strong style="color: #f59e0b;">Desert Planet (14.3 km):</strong> Layered sandstone gorge, hollow fallen skyscraper transit, sandstone arches, two chasm jumps, and sweepers through a towering simoom sandstorm.</p>

          <h3 style="color: var(--accent-cyan); font-family: Orbitron, sans-serif; font-size: 14px; margin-top: 14px; margin-bottom: 6px; letter-spacing: 1px;">DIFFICULTY & PLAYER PERKS</h3>
          <p style="margin-bottom: 10px;"><strong style="color: #fff;">Four Difficulty Tiers:</strong> Easy, Normal, Hard, and Brutal calibrated so rivals follow strict median lap times.</p>
          <p style="margin-bottom: 14px;"><strong style="color: #fff;">Player Cornering Assist:</strong> On Easy, enjoy gentle steering assistance toward the apex and wall scrapes that are five times less punishing (wallScrapeDamp: 0.2).</p>

          <h3 style="color: var(--accent-cyan); font-family: Orbitron, sans-serif; font-size: 14px; margin-top: 14px; margin-bottom: 6px; letter-spacing: 1px;">ATMOSPHERIC VISUALS & OPTIMIZATIONS</h3>
          <p style="margin-bottom: 4px;">GPU blizzard streaks, sandstorm dust volume, light shaft glint filtering, single-pass MSAA resolve, and parallel post-processing shader precompilation.</p>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" id="btn-wn-back">RETURN</button>
        </div>
      </div>
    `;

    this._renderHints(this.elMenu);
    document.getElementById('btn-wn-back')?.addEventListener('click', () => this._renderPauseMenu());
  }

  showOptions() {
    if (!this.elSettings) return;
    this._hideAllDialogs();
    this.elSettings.classList.remove('hidden');
    this.currentView = 'settings';

    const s = this.app.settings ? this.app.settings.data : {};

    this.elSettings.innerHTML = `
      <div class="dialog-card">
        <h2 class="dialog-title">SYSTEM CONFIGURATION</h2>
        <div class="settings-form">
          <div class="form-row">
            <label>GRAPHICS PRESET</label>
            <div class="btn-group">
              <button class="btn-opt ${s.quality === 'low' ? 'active' : ''}" data-q="low">LOW</button>
              <button class="btn-opt ${s.quality === 'medium' ? 'active' : ''}" data-q="medium">MED</button>
              <button class="btn-opt ${s.quality === 'high' ? 'active' : ''}" data-q="high">HIGH</button>
              <button class="btn-opt ${s.quality === 'ultra' ? 'active' : ''}" data-q="ultra">ULTRA</button>
            </div>
          </div>
          <div class="form-row">
            <label>LAPTOP MODE (PERF)</label>
            <div class="btn-group">
              <button class="btn-opt ${s.laptopMode ? 'active' : ''}" id="btn-laptop">${s.laptopMode ? 'ENABLED' : 'DISABLED'}</button>
            </div>
          </div>
          <div class="form-row">
            <label>DIFFICULTY</label>
            <div class="btn-group difficulty-row">
              <button class="btn-opt ${s.difficulty === 'easy' ? 'active' : ''}" data-d="easy">EASY</button>
              <button class="btn-opt ${s.difficulty === 'normal' ? 'active' : ''}" data-d="normal">NORMAL</button>
              <button class="btn-opt ${s.difficulty === 'hard' ? 'active' : ''}" data-d="hard">HARD</button>
              <button class="btn-opt ${s.difficulty === 'brutal' ? 'active' : ''}" data-d="brutal">BRUTAL</button>
            </div>
          </div>
          <div class="form-row">
            <label>MASTER VOLUME</label>
            <input type="range" min="0" max="1" step="0.05" id="rng-master" value="${s.volumeMaster || 0.9}">
          </div>
          <div class="form-row">
            <label>SFX VOLUME</label>
            <input type="range" min="0" max="1" step="0.05" id="rng-sfx" value="${s.volumeSFX || 0.85}">
          </div>
          <div class="form-row">
            <label>ENGINE VOLUME</label>
            <input type="range" min="0" max="1" step="0.05" id="rng-engine" value="${s.volumeEngine || 0.8}">
          </div>
          <div class="form-row">
            <label>MUSIC VOLUME</label>
            <input type="range" min="0" max="1" step="0.05" id="rng-music" value="${s.volumeMusic || 0.65}">
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" id="btn-back">APPLY & RETURN</button>
        </div>
        <div class="settings-copyright">
          Need4Space v${CURRENT_VERSION} &bull; &copy; 2026 &lt;OWNER&gt;. All Rights Reserved. <!-- <OWNER> -->
        </div>
      </div>
    `;

    this._renderHints(this.elSettings);

    // Bind graphics buttons
    if (this.elSettings.querySelectorAll) {
      this.elSettings.querySelectorAll('[data-q]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const q = e.target.dataset.q;
          if (this.app.settings) {
            this.app.settings.set('quality', q);
            this.app.settings.apply(this.app);
          }
          this.showOptions();
        });
      });
    }

    // Bind laptop mode toggle
    const btnLaptop = this.elSettings.querySelector ? this.elSettings.querySelector('#btn-laptop') : null;
    if (btnLaptop) {
      btnLaptop.addEventListener('click', () => {
        if (this.app.settings) {
          const cur = !!this.app.settings.get('laptopMode');
          this.app.settings.set('laptopMode', !cur);
          this.app.settings.apply(this.app);
        }
        this.showOptions();
      });
    }

    // Bind difficulty buttons
    if (this.elSettings.querySelectorAll) {
      this.elSettings.querySelectorAll('[data-d]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const d = e.target.dataset.d;
          if (this.app.settings) {
            this.app.settings.set('difficulty', d);
          }
          if (this.app.race) {
            this.app.race.setDifficulty(d);
          }
          this.showOptions();
        });
      });
    }

    // Volume sliders
    const bindSlider = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (this.app.settings) {
            this.app.settings.set(key, val);
            this.app.settings.apply(this.app);
          }
        });
      }
    };
    bindSlider('rng-master', 'volumeMaster');
    bindSlider('rng-sfx', 'volumeSFX');
    bindSlider('rng-engine', 'volumeEngine');
    bindSlider('rng-music', 'volumeMusic');

    document.getElementById('btn-back')?.addEventListener('click', () => this._renderPauseMenu());
  }

  showChangelog() {
    if (!this.elMenu) return;
    this._hideAllDialogs();
    this.elMenu.classList.remove('hidden');

    let notesHtml = '';
    CHANGELOG.forEach(c => {
      notesHtml += `
        <div class="changelog-entry">
          <div class="changelog-header">v${c.version} — ${c.title} <span class="date">${c.date}</span></div>
          <ul class="changelog-list">
            ${c.notes.map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>
      `;
    });

    this.elMenu.innerHTML = `
      <div class="dialog-card">
        <h2 class="dialog-title">CHANGELOG</h2>
        <div class="changelog-container">
          ${notesHtml}
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" id="btn-cl-back">BACK</button>
        </div>
      </div>
    `;

    this._renderHints(this.elMenu);
    document.getElementById('btn-cl-back')?.addEventListener('click', () => this._renderPauseMenu());
  }

  showCircuits() {
    if (!this.elSettings) return;
    this._hideAllDialogs();
    this.elSettings.classList.remove('hidden');
    this.currentView = 'circuits';

    const curCircuit = this.app.track ? this.app.track.name : 'space';

    this.elSettings.innerHTML = `
      <div class="dialog-card">
        <h2 class="dialog-title">CIRCUIT SELECTOR</h2>
        <div class="circuit-list">
          <div class="circuit-card ${curCircuit === 'space' ? 'active' : ''}" style="margin-bottom: 16px; padding: 14px; background: rgba(0, 210, 255, 0.08); border: 1px solid var(--accent-cyan); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-family: Orbitron, sans-serif; font-weight: 700; color: #fff; font-size: 16px;">ORBITAL STATION</span>
              <span style="font-family: Rajdhani, sans-serif; color: var(--accent-cyan); font-weight: 700;">26.6 KM</span>
            </div>
            <p style="font-size: 13px; color: #8fa3b8; margin: 0 0 10px 0;">High-speed orbit over gas giant Solaris IV. Threads the 12 km derelict Colossus through its engine bell, pulsing reactor hall, vacuum break leap, upside-down hold, and barbette trench run.</p>
            <button class="btn btn-primary" data-circuit="space" style="width: 100%;">${curCircuit === 'space' ? 'CURRENT CIRCUIT' : 'ENGAGE SPACE'}</button>
          </div>
          <div class="circuit-card ${curCircuit === 'forest' ? 'active' : ''}" style="margin-bottom: 16px; padding: 14px; background: rgba(0, 255, 136, 0.08); border: 1px solid var(--accent-green); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-family: Orbitron, sans-serif; font-weight: 700; color: #fff; font-size: 16px;">FOREST MOON</span>
              <span style="font-family: Rajdhani, sans-serif; color: var(--accent-green); font-weight: 700;">13.8 KM</span>
            </div>
            <p style="font-size: 13px; color: #8fa3b8; margin: 0 0 10px 0;">Lush canopy world featuring floating islands, the 2 km hollow hill cave with subterranean lake, and two gravity flips flying inverted past the colossal reptile skull.</p>
            <button class="btn btn-primary" data-circuit="forest" style="width: 100%; border-color: var(--accent-green);">${curCircuit === 'forest' ? 'CURRENT CIRCUIT' : 'ENGAGE FOREST'}</button>
          </div>
          <div class="circuit-card ${curCircuit === 'ice' ? 'active' : ''}" style="margin-bottom: 16px; padding: 14px; background: rgba(56, 189, 248, 0.08); border: 1px solid #38bdf8; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-family: Orbitron, sans-serif; font-weight: 700; color: #fff; font-size: 16px;">ICE PLANET</span>
              <span style="font-family: Rajdhani, sans-serif; color: #38bdf8; font-weight: 700;">14.0 KM</span>
            </div>
            <p style="font-size: 13px; color: #8fa3b8; margin: 0 0 10px 0;">Glacier shelf split by a 270m crevasse, upside-down run over sea ice floes between gravity flips, and frozen falls.</p>
            <button class="btn btn-primary" data-circuit="ice" style="width: 100%; border-color: #38bdf8;">${curCircuit === 'ice' ? 'CURRENT CIRCUIT' : 'ENGAGE ICE'}</button>
          </div>
          <div class="circuit-card ${curCircuit === 'desert' ? 'active' : ''}" style="margin-bottom: 16px; padding: 14px; background: rgba(245, 158, 11, 0.08); border: 1px solid #f59e0b; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-family: Orbitron, sans-serif; font-weight: 700; color: #fff; font-size: 16px;">DESERT PLANET</span>
              <span style="font-family: Rajdhani, sans-serif; color: #f59e0b; font-weight: 700;">14.3 KM</span>
            </div>
            <p style="font-size: 13px; color: #8fa3b8; margin: 0 0 10px 0;">Arid wasteland under low WNW sunset. Threads a hollow fallen skyscraper, layered sandstone gorge, two chasm jumps, and a towering sandstorm.</p>
            <button class="btn btn-primary" data-circuit="desert" style="width: 100%; border-color: #f59e0b;">${curCircuit === 'desert' ? 'CURRENT CIRCUIT' : 'ENGAGE DESERT'}</button>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn" id="btn-circuits-back">RETURN</button>
        </div>
      </div>
    `;

    this._renderHints(this.elSettings);

    if (this.elSettings.querySelectorAll) {
      this.elSettings.querySelectorAll('[data-circuit]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const c = e.target.dataset.circuit;
          if (this.app.loadCircuit) {
            this.app.loadCircuit(c);
          }
          this.resume();
        });
      });
    }

    document.getElementById('btn-circuits-back')?.addEventListener('click', () => this._renderPauseMenu());
  }

  showResults(results = []) {
    if (!this.elResults) return;
    this._hideAllDialogs();
    this.elResults.classList.remove('hidden');
    this.currentView = 'results';

    let rowsHtml = '';
    results.forEach((r, idx) => {
      const isPlayer = r.isPlayer;
      const timeStr = r.time ? `${Math.floor(r.time / 60)}:${(r.time % 60).toFixed(2)}` : '--:--.--';
      rowsHtml += `
        <tr class="${isPlayer ? 'player-row' : ''}">
          <td class="col-rank">${idx + 1}</td>
          <td class="col-name">${r.name}</td>
          <td class="col-time">${timeStr}</td>
          <td class="col-pts">+${r.points} PTS</td>
        </tr>
      `;
    });

    this.elResults.innerHTML = `
      <div class="dialog-card results-card">
        <h2 class="dialog-title">CIRCUIT CLASSIFICATION</h2>
        <table class="results-table">
          <thead>
            <tr>
              <th>POS</th>
              <th>TEAM</th>
              <th>TIME</th>
              <th>SCORE</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="dialog-actions">
          <button class="btn btn-primary" id="btn-res-restart">RESTART (R)</button>
        </div>
      </div>
    `;

    this._renderHints(this.elResults);
    document.getElementById('btn-res-restart')?.addEventListener('click', () => this.restartRace());
  }
}
