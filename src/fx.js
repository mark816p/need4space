// src/fx.js — Visual special effects: screen-edge flashes, high-speed warp lines, and wall collision sparks
// Why: Visceral arcade feedback during high-G maneuvers, supersonic speeds, and barrier scrapes

import * as THREE from 'three';
import { clamp, damp } from './noise.js';

export class FXSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // DOM edgeflash
    this.elEdge = (typeof document !== 'undefined') ? document.getElementById('edgeflash') : null;
    this.edgeOpacity = 0.0;
    this.edgeColor = 'rgba(0, 210, 255, 0.45)';

    // Speed Lines System (>220 m/s)
    this._initSpeedLines();

    // Wall Scrape Spark Particles
    this._initSparkParticles();

    // Drift FX System (dormant when TrackRacer.drifting is false)
    this._initDriftFX();
  }

  // ---------------------------------------------------------------------------
  // Drift FX (sparks/trails/glow by tier colours blue -> orange -> violet)
  // ---------------------------------------------------------------------------
  _initDriftFX() {
    this.drift = {
      active: false,
      tier: 0,
      tierColors: [
        new THREE.Color(0x00d2ff), // Tier 1: Blue #00d2ff
        new THREE.Color(0xff8800), // Tier 2: Orange #ff8800
        new THREE.Color(0xb042ff)  // Tier 3: Violet #b042ff
      ],
      sparks: [],
      trails: [],
      glowColor: new THREE.Color(0x00d2ff),
      update: (dt, racer) => {
        if (!racer || !racer.isDrifting) {
          this.drift.active = false;
          return;
        }
        this.drift.active = true;
        this.drift.tier = racer.driftTier || 0;
        if (this.drift.tier >= 1 && this.drift.tier <= 3) {
          this.drift.glowColor.copy(this.drift.tierColors[this.drift.tier - 1]);
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Screen-Edge Flash
  // ---------------------------------------------------------------------------
  flash(type = 'boost', intensity = 1.0) {
    if (!this.elEdge) return;
    if (type === 'boost') {
      this.edgeColor = 'rgba(0, 210, 255, 0.55)'; // Cyan
    } else if (type === 'pad') {
      this.edgeColor = 'rgba(0, 255, 136, 0.65)'; // Bright Neon Green/Cyan
    } else if (type === 'impact') {
      this.edgeColor = 'rgba(255, 50, 80, 0.65)';  // Red/Orange Warning
    }
    this.edgeOpacity = Math.min(1.0, intensity);
  }

  // ---------------------------------------------------------------------------
  // 2. High-Speed 3D Warp Lines
  // ---------------------------------------------------------------------------
  _initSpeedLines() {
    const count = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 6); // 2 vertices per line (start & end)
    const alphas = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      // Cylinder distribution around camera
      const theta = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 8.0;
      const z = -(5.0 + Math.random() * 30.0);
      const len = 3.0 + Math.random() * 5.0;

      const idx = i * 6;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;

      // Start vertex
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // End vertex (stretched along Z)
      positions[idx + 3] = x;
      positions[idx + 4] = y;
      positions[idx + 5] = z - len;

      alphas[i * 2] = 0.0;
      alphas[i * 2 + 1] = 0.8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.matSpeedLines = new THREE.LineBasicMaterial({
      color: 0x88e5ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.speedLinesMesh = new THREE.LineSegments(geometry, this.matSpeedLines);
    this.speedLinesMesh.frustumCulled = false;
    this.scene.add(this.speedLinesMesh);
  }

  // ---------------------------------------------------------------------------
  // 3. Wall Collision Spark Particles
  // ---------------------------------------------------------------------------
  _initSparkParticles() {
    this.maxSparks = 180;
    this.sparks = [];
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSparks * 3);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffaa33,
      size: 1.8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparksMesh = new THREE.Points(geometry, material);
    this.sparksMesh.frustumCulled = false;
    this.scene.add(this.sparksMesh);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparks.push({
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        life: 0.0,
        maxLife: 0.35
      });
    }
  }

  emitSparks(origin, normal, count = 25) {
    let emitted = 0;
    for (let i = 0; i < this.sparks.length && emitted < count; i++) {
      const sp = this.sparks[i];
      if (sp.life <= 0) {
        sp.pos.copy(origin);
        // Tangential bounce cone
        sp.vel.copy(normal).multiplyScalar(8.0 + Math.random() * 14.0)
          .add(new THREE.Vector3(
            (Math.random() - 0.5) * 12.0,
            (Math.random() - 0.2) * 10.0,
            (Math.random() - 0.5) * 12.0
          ));
        sp.life = 0.2 + Math.random() * 0.25;
        sp.maxLife = sp.life;
        emitted++;
      }
    }
  }

  update(dt, playerRacer) {
    // 1. Decay Edgeflash
    if (this.elEdge) {
      if (this.edgeOpacity > 0.005) {
        this.edgeOpacity = damp(this.edgeOpacity, 0.0, 7.0, dt);
        this.elEdge.style.background = `radial-gradient(ellipse at center, transparent 60%, ${this.edgeColor} 100%)`;
        this.elEdge.style.opacity = this.edgeOpacity.toFixed(3);
      } else {
        this.elEdge.style.opacity = '0';
      }
    }

    // 2. Speed Lines (active > 220 m/s)
    if (this.speedLinesMesh && playerRacer) {
      const speed = playerRacer.vs || 0;
      const speedThreshold = 220.0; // 792 km/h
      const targetOpacity = (speed > speedThreshold)
        ? clamp((speed - speedThreshold) / 50.0, 0.0, 0.85)
        : 0.0;

      this.matSpeedLines.opacity = damp(this.matSpeedLines.opacity, targetOpacity, 8.0, dt);

      // Lock speed lines mesh to camera space
      this.speedLinesMesh.position.copy(this.camera.position);
      this.speedLinesMesh.quaternion.copy(this.camera.quaternion);
    }

    // 3. Update Sparks Physics
    if (this.sparksMesh) {
      const posAttr = this.sparksMesh.geometry.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < this.sparks.length; i++) {
        const sp = this.sparks[i];
        if (sp.life > 0) {
          sp.life -= dt;
          sp.pos.addScaledVector(sp.vel, dt);
          sp.vel.y -= 18.0 * dt; // Gravity drop

          arr[i * 3] = sp.pos.x;
          arr[i * 3 + 1] = sp.pos.y;
          arr[i * 3 + 2] = sp.pos.z;
        } else {
          arr[i * 3 + 1] = -9999;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 4. Update Drift FX
    if (this.drift) {
      this.drift.update(dt, playerRacer);
    }
  }
}
