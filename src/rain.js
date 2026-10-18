// src/rain.js — Procedural storm rain streaks, road splashes, puddles, and underwater shutoff
// Why: "P12 Ocean World Rain: speed-elongated rain streaks catching moonlight/headlights,
// world-fixed deck/sea splashes, road puddles reflecting lights, underwater rain shutoff, and ambient rain audio."

import * as THREE from 'three';

export class StormRain {
  constructor(scene, camera, audioManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.audioManager = audioManager;
    this.group = new THREE.Group();
    this.group.name = 'storm_rain_system';
    this.scene.add(this.group);

    this.rainCount = 1200;
    this.boxSize = new THREE.Vector3(120, 80, 120);

    this.splashes = [];
    this.puddles = [];

    this._buildRainStreaks();
    this._buildDeckSplashes();
    this._buildRoadPuddles();
    this._initRainAudio();
  }

  _buildRainStreaks() {
    // Rain streaks constructed from line segments or elongated instanced meshes
    const positions = new Float32Array(this.rainCount * 6); // 2 vertices per streak line
    const colors = new Float32Array(this.rainCount * 6);

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 6;
      const x = (Math.random() - 0.5) * this.boxSize.x;
      const y = (Math.random() - 0.5) * this.boxSize.y;
      const z = (Math.random() - 0.5) * this.boxSize.z;

      // Top vertex
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // Bottom vertex (streak elongation along fall vector)
      positions[idx + 3] = x - 0.4;
      positions[idx + 4] = y - 4.5;
      positions[idx + 5] = z - 0.8;

      // Moonlight silver / slight cyan tint
      for (let v = 0; v < 2; v++) {
        colors[idx + v * 3] = 0.75;
        colors[idx + v * 3 + 1] = 0.88;
        colors[idx + v * 3 + 2] = 1.0;
      }
    }

    this.rainGeom = new THREE.BufferGeometry();
    this.rainGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.rainMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.rainLines = new THREE.LineSegments(this.rainGeom, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.group.add(this.rainLines);
  }

  _buildDeckSplashes() {
    // Animated splash droplets hitting causeway deck and sea surface
    const splashGeom = new THREE.RingGeometry(0.15, 0.45, 8);
    splashGeom.rotateX(-Math.PI * 0.5);

    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xc0e4ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const numSplashes = 32;
    for (let i = 0; i < numSplashes; i++) {
      const splash = new THREE.Mesh(splashGeom, this.splashMat.clone());
      splash.visible = false;
      this.group.add(splash);
      this.splashes.push({
        mesh: splash,
        active: false,
        life: 0.0,
        maxLife: 0.35 + Math.random() * 0.25,
        scale: 1.0
      });
    }
  }

  _buildRoadPuddles() {
    // Reflective surface puddles along the causeway road deck (y ≈ 8.5)
    const puddleGeom = new THREE.CircleGeometry(4.5, 16);
    puddleGeom.rotateX(-Math.PI * 0.5);

    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x050a12,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.85
    });

    // Puddles placed along the causeway sprint
    const puddleCoords = [
      { x: 120, y: 8.65, z: 2850, r: 3.8 },
      { x: 450, y: 8.65, z: 2680, r: 5.2 },
      { x: 820, y: 8.65, z: 2350, r: 4.4 },
      { x: 1250, y: 8.65, z: 1950, r: 6.0 },
      { x: 1650, y: 8.65, z: 1720, r: 4.8 }
    ];

    for (let i = 0; i < puddleCoords.length; i++) {
      const p = puddleCoords[i];
      const mesh = new THREE.Mesh(puddleGeom, puddleMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.set(p.r / 4.5, 1.0, (p.r / 4.5) * 1.5);
      this.group.add(mesh);
      this.puddles.push(mesh);
    }
  }

  _initRainAudio() {
    // Procedural WebAudio ambient storm rain rumble and hiss
    if (!this.audioManager || !this.audioManager.ctx) return;
    try {
      const ctx = this.audioManager.ctx;
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.05 * white)) / 1.05;
        lastOut = data[i];
      }

      this.rainNoise = ctx.createBufferSource();
      this.rainNoise.buffer = buffer;
      this.rainNoise.loop = true;

      this.rainFilter = ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 1800;
      this.rainFilter.Q.value = 0.8;

      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.0;

      this.rainNoise.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      if (this.audioManager.masterGain) {
        this.rainGain.connect(this.audioManager.masterGain);
      } else {
        this.rainGain.connect(ctx.destination);
      }

      this.rainNoise.start(0);
    } catch (_) {}
  }

  update(dt, camera, speed = 0, underK = 0.0) {
    // Underwater rain shutoff:
    // When submerged (underK > 0.05), rain streaks stop rendering completely
    if (underK > 0.05) {
      this.rainLines.visible = false;
      for (let i = 0; i < this.splashes.length; i++) {
        this.splashes[i].mesh.visible = false;
      }
      if (this.rainGain && this.audioManager?.ctx) {
        this.rainGain.gain.setTargetAtTime(0.0, this.audioManager.ctx.currentTime, 0.1);
      }
      return;
    }

    this.rainLines.visible = true;

    // Follow camera box
    if (camera) {
      this.rainLines.position.copy(camera.position);
    }

    // Dynamic streak elongation based on racer forward speed
    const posAttr = this.rainGeom.attributes.position;
    const pos = posAttr.array;
    const fallSpeed = 55.0 + speed * 0.15;
    const streakLength = 4.5 + speed * 0.04;

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 6;
      pos[idx + 1] -= fallSpeed * dt;
      pos[idx + 4] = pos[idx + 1] - streakLength;

      // Wrap around relative camera boundary
      if (pos[idx + 1] < -this.boxSize.y * 0.5) {
        pos[idx + 1] += this.boxSize.y;
        pos[idx + 4] = pos[idx + 1] - streakLength;
        pos[idx] = (Math.random() - 0.5) * this.boxSize.x;
        pos[idx + 3] = pos[idx] - 0.3;
        pos[idx + 2] = (Math.random() - 0.5) * this.boxSize.z;
        pos[idx + 5] = pos[idx + 2] - 0.6;

        // Random chance to trigger ground/sea splash
        if (Math.random() < 0.05 && camera) {
          this._spawnSplash(
            camera.position.x + pos[idx],
            camera.position.y > 0 ? 0.2 : -200,
            camera.position.z + pos[idx + 2]
          );
        }
      }
    }
    posAttr.needsUpdate = true;

    // Update splash droplet rings
    for (let s = 0; s < this.splashes.length; s++) {
      const sp = this.splashes[s];
      if (sp.active) {
        sp.life += dt;
        const progress = sp.life / sp.maxLife;
        sp.mesh.scale.set(1.0 + progress * 2.5, 1.0 + progress * 2.5, 1.0);
        sp.mesh.material.opacity = (1.0 - progress) * 0.5;
        if (progress >= 1.0) {
          sp.active = false;
          sp.mesh.visible = false;
        }
      }
    }

    // Update rain audio volume (fades in above water, louder when moving fast)
    if (this.rainGain && this.audioManager?.ctx) {
      const targetVol = (1.0 - underK) * (0.18 + Math.min(0.2, (speed / 300.0) * 0.15));
      this.rainGain.gain.setTargetAtTime(targetVol, this.audioManager.ctx.currentTime, 0.15);
    }
  }

  _spawnSplash(x, y, z) {
    for (let s = 0; s < this.splashes.length; s++) {
      const sp = this.splashes[s];
      if (!sp.active) {
        sp.active = true;
        sp.life = 0.0;
        sp.mesh.position.set(x, y, z);
        sp.mesh.scale.set(1, 1, 1);
        sp.mesh.visible = true;
        break;
      }
    }
  }

  dispose() {
    if (this.rainNoise) {
      try { this.rainNoise.stop(); } catch (_) {}
    }
  }
}
