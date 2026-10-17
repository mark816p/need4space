// src/input.js — Keyboard and Gamepad input handler
// Why: Unifies keyboard, gamepad, and touch input into a clean state object without per-frame allocations

export class InputHandler {
  constructor() {
    this.keys = new Set();
    this.touch = {
      steerLeft: false,
      steerRight: false,
      throttle: false,
      brake: false,
      boost: false
    };
    this.raw = {
      throttle: 0,
      brake: 0,
      steer: 0,
      pitch: 0,
      roll: 0,
      boost: false,
      airbrakeL: false,
      airbrakeR: false,
      slam: false,
      toggleMode: false,
      respawn: false,
      toggleCanopy: false,
      toggleEngine: false,
      changeCam: false,
      toggleMute: false,
      nextTrack: false
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this._initTouchControls();
    }
  }

  _initTouchControls() {
    if (typeof document === 'undefined') return;

    // Auto-detect mobile / coarse pointer device
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isCoarse || hasTouch) {
      document.body.classList.add('touch-active');
    }

    // Also activate touch layer on first touch event
    window.addEventListener('touchstart', () => {
      document.body.classList.add('touch-active');
    }, { once: true, passive: true });

    // Helper to bind button events for both touch and pointer
    const bindBtn = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;

      const down = (e) => {
        if (e.cancelable) e.preventDefault();
        this.touch[prop] = true;
      };
      const up = (e) => {
        if (e.cancelable) e.preventDefault();
        this.touch[prop] = false;
      };

      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
    };

    bindBtn('t-left', 'steerLeft');
    bindBtn('t-right', 'steerRight');
    bindBtn('t-thr', 'throttle');
    bindBtn('t-brake', 'brake');
    bindBtn('t-boost', 'boost');
  }

  _onKeyDown(e) {
    this.keys.add(e.code);

    // Single-shot key triggers
    if (e.code === 'KeyG') this.raw.toggleMode = true;
    if (e.code === 'KeyT') this.raw.respawn = true;
    if (e.code === 'KeyF') this.raw.toggleCanopy = true;
    if (e.code === 'KeyC') this.raw.changeCam = true;
    if (e.code === 'KeyM') this.raw.toggleMute = true;
    if (e.code === 'KeyN') this.raw.nextTrack = true;
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  poll() {
    const k = this.keys;

    // Keyboard state
    let throttle = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1.0;
    if (this.touch.throttle) throttle = Math.max(throttle, 1.0);

    let brake = 0;
    if (k.has('KeyS') || k.has('ArrowDown')) brake += 1.0;
    if (this.touch.brake) brake = Math.max(brake, 1.0);

    let steer = 0;
    if (k.has('KeyD') || k.has('ArrowRight')) steer += 1.0;
    if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1.0;
    if (this.touch.steerRight) steer += 1.0;
    if (this.touch.steerLeft) steer -= 1.0;
    steer = Math.max(-1.0, Math.min(1.0, steer));

    let pitch = 0;
    if (k.has('KeyI')) pitch += 1.0;
    if (k.has('KeyK')) pitch -= 1.0;

    let boost = k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.boost;
    const airbrakeL = k.has('KeyQ');
    const airbrakeR = k.has('KeyE');
    const slam = k.has('Space');

    // Gamepad polling if connected
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected) {
          // Left stick steering
          const stickX = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
          if (Math.abs(stickX) > 0.12) steer = stickX;

          // RT (button 7) or A (button 0) for throttle
          const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
          if (rt > 0.1 || (gp.buttons[0] && gp.buttons[0].pressed)) {
            throttle = Math.max(throttle, rt > 0.1 ? rt : 1.0);
          }

          // LT (button 6) for brake
          const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
          if (lt > 0.1) {
            brake = Math.max(brake, lt);
          }

          // RB (button 5) or X (button 2) for boost
          if ((gp.buttons[5] && gp.buttons[5].pressed) || (gp.buttons[2] && gp.buttons[2].pressed)) {
            this.raw.boost = true;
          }
        }
      }
    }

    this.raw.throttle = throttle;
    this.raw.brake = brake;
    this.raw.steer = steer;
    this.raw.pitch = pitch;
    this.raw.boost = boost;
    this.raw.airbrakeL = airbrakeL;
    this.raw.airbrakeR = airbrakeR;
    this.raw.slam = slam;

    return this.raw;
  }

  // Consume and reset single-shot trigger flags
  consumeTrigger(name) {
    const val = this.raw[name];
    this.raw[name] = false;
    return val;
  }
}
