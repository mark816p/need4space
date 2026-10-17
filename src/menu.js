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
    this.currentView = null; // 'pause' | 'settings' | 'results' | 'changelog'

    this._bindEvents();
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.togglePause();
      } else if (e.code === 'KeyR') {
        if (this.currentView === 'results' || this.app.paused) {
          this.restartRace();
        }
      }
    });
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

    this.elMenu.innerHTML = `
      <div class="dialog-card">
        <h2 class="dialog-title">SYSTEM PAUSED</h2>
        <div class="menu-list">
          <button class="btn btn-primary" id="btn-resume">RESUME RACE</button>
          <button class="btn" id="btn-restart">RESTART CIRCUIT</button>
          <button class="btn" id="btn-options">OPTIONS</button>
          <button class="btn" id="btn-changelog">CHANGELOG (v${CURRENT_VERSION})</button>
        </div>
      </div>
    `;

    document.getElementById('btn-resume')?.addEventListener('click', () => this.resume());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.restartRace());
    document.getElementById('btn-options')?.addEventListener('click', () => this.showOptions());
    document.getElementById('btn-changelog')?.addEventListener('click', () => this.showChangelog());
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
            <div class="btn-group">
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
      </div>
    `;

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

    document.getElementById('btn-cl-back')?.addEventListener('click', () => this._renderPauseMenu());
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

    document.getElementById('btn-res-restart')?.addEventListener('click', () => this.restartRace());
  }
}
