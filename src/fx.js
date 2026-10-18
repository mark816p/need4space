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

    // Explosion Fragment System (v1.8.0)
    this._initExplosionParticles();

    // Drift FX System (dormant when TrackRacer.drifting is false)
    this._initDriftFX();

    // Critical alarm state
    this.criticalAlarm = false;
    this.critPhase = 0.0;
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
      this.edgeColor = 'rgba(255, 80, 50, 0.65)';  // Red/Orange Warning
    } else if (type === 'damage') {
      this.edgeColor = 'rgba(255, 20, 40, 0.85)';  // Red Damage Flash
    } else if (type === 'slam') {
      this.edgeColor = 'rgba(255, 160, 20, 0.85)'; // Amber Slam Flash
    } else if (type === 'crit') {
      this.edgeColor = 'rgba(255, 0, 30, 0.9)';   // Critical Red Flash
    }
    this.edgeOpacity = Math.min(1.0, intensity);
  }

  setCriticalAlarm(active) {
    this.criticalAlarm = !!active;
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

  // ---------------------------------------------------------------------------
  // 4. Explosion Fragment & Debris System (v1.8.0)
  // ---------------------------------------------------------------------------
  _initExplosionParticles() {
    this.maxFrags = 120;
    this.fragments = [];
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxFrags * 3);
    const colors = new Float32Array(this.maxFrags * 3);

    for (let i = 0; i < this.maxFrags; i++) {
      positions[i * 3 + 1] = -9999;
      // Fiery explosion palette: white-hot -> orange -> red-violet
      const r = 1.0;
      const g = 0.3 + Math.random() * 0.6;
      const b = Math.random() * 0.2;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.explosionMesh = new THREE.Points(geometry, material);
    this.explosionMesh.frustumCulled = false;
    this.scene.add(this.explosionMesh);

    for (let i = 0; i < this.maxFrags; i++) {
      this.fragments.push({
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        life: 0.0,
        maxLife: 1.2
      });
    }
  }

  emitExplosion(origin, count = 60) {
    let emitted = 0;
    for (let i = 0; i < this.fragments.length && emitted < count; i++) {
      const fr = this.fragments[i];
      if (fr.life <= 0) {
        fr.pos.copy(origin);
        // Spherical explosion burst with high radial speed (25 - 65 m/s)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 25.0 + Math.random() * 45.0;
        fr.vel.set(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed + 10.0, // upward bias
          Math.sin(phi) * Math.sin(theta) * speed
        );
        fr.life = 0.6 + Math.random() * 0.8;
        fr.maxLife = fr.life;
        emitted++;
      }
    }
    this.flash('crit', 1.0);
  }

  emitSlamShockwave(origin, normal, count = 35) {
    this.emitSparks(origin, normal, count);
    this.flash('slam', 0.85);
  }

  update(dt, playerRacer) {
    // 1. Critical Alarm & Screen Vignette
    if (this.elEdge) {
      if (this.criticalAlarm) {
        this.critPhase += dt * 6.5;
        const pulse = 0.45 + 0.4 * Math.sin(this.critPhase);
        this.edgeColor = 'rgba(255, 0, 30, 0.85)';
        this.edgeOpacity = Math.max(this.edgeOpacity, pulse);
        this.elEdge.style.background = `radial-gradient(ellipse at center, transparent 55%, ${this.edgeColor} 100%)`;
        this.elEdge.style.opacity = this.edgeOpacity.toFixed(3);
      } else if (this.edgeOpacity > 0.005) {
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

    // 4. Update Explosion Fragments Physics
    if (this.explosionMesh) {
      const posAttr = this.explosionMesh.geometry.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < this.fragments.length; i++) {
        const fr = this.fragments[i];
        if (fr.life > 0) {
          fr.life -= dt;
          fr.pos.addScaledVector(fr.vel, dt);
          fr.vel.y -= 22.0 * dt; // Gravity drag
          fr.vel.multiplyScalar(Math.max(0, 1.0 - 0.9 * dt)); // Air resistance

          arr[i * 3] = fr.pos.x;
          arr[i * 3 + 1] = fr.pos.y;
          arr[i * 3 + 2] = fr.pos.z;
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
