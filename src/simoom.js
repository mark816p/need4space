// src/simoom.js — Desert Planet GPU wind, sand veils, dust devils, skimming wakes, and heat-shimmer
// Why: Low veils of fine sand hugging the deck (thicker/redder in sandstorm), sand wakes torn
// off dunes under low skimming craft, dust devils, and horizon heat-shimmer distortion

import * as THREE from 'three';
import { DESERT_SUN_DIR } from './haze.js';

export class SimoomWind {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'simoom_system';

    // Wind direction along WNW
    this.windDir = new THREE.Vector3(-0.92, 0.05, 0.38).normalize();
    this.windSpeed = 26.0; // 26 m/s howling simoom wind

    this._initSandVeils();
    this._initDustDevils();
    this._initSkimWakes();

    this.heatShimmer = 1.0; // Enables heat shimmer along rising horizon

    this.scene.add(this.group);
  }

  _initSandVeils() {
    // 1. GPU drifting sand veils (3200 particles hugging the deck)
    this.veilCount = 3200;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.veilCount * 3);
    const seeds = new Float32Array(this.veilCount * 3);

    for (let i = 0; i < this.veilCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 320.0;
      positions[i * 3 + 1] = Math.random() * 18.0; // Hugging close to deck/sand
      positions[i * 3 + 2] = (Math.random() - 0.5) * 320.0;

      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

    this.veilMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uWind: { value: this.windDir.clone().multiplyScalar(this.windSpeed) },
        uStormFactor: { value: 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uWind;
        uniform float uStormFactor;
        attribute vec3 aSeed;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          vec3 p = position + uWind * uTime * (0.8 + aSeed.x * 0.5);
          vec3 box = vec3(320.0, 24.0, 320.0);
          p = mod(p, box) - box * 0.5;
          vec3 worldPos = uCamPos + p;

          float dist = length(p.xz);
          float nearFade = smoothstep(2.5, 6.0, dist);
          float farFade = 1.0 - smoothstep(110.0, 160.0, dist);
          float heightFade = 1.0 - smoothstep(1.0, 22.0, p.y + 12.0);

          vAlpha = nearFade * farFade * heightFade * (0.25 + uStormFactor * 0.45);

          // Color: golden amber normally, deeper terracotta red in sandstorm
          vec3 goldDust = vec3(0.92, 0.65, 0.38);
          vec3 stormRed = vec3(0.85, 0.32, 0.18);
          vColor = mix(goldDust, stormRed, uStormFactor);

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          gl_PointSize = (2.5 + aSeed.y * 3.5 + uStormFactor * 2.0) * (260.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float r = length(coord);
          if (r > 0.5) discard;
          float circle = smoothstep(0.5, 0.1, r);
          gl_FragColor = vec4(vColor, vAlpha * circle);
        }
      `
    });

    this.veilPoints = new THREE.Points(geom, this.veilMat);
    this.group.add(this.veilPoints);
  }

  _initDustDevils() {
    // 2. Dust Devils: wandering rotating vortex funnels of sand
    this.devils = [];
    const devilGroup = new THREE.Group();
    devilGroup.name = 'dust_devils';

    const devilLocations = [
      new THREE.Vector3(800, 0, 1100),
      new THREE.Vector3(-600, 0, 1500),
      new THREE.Vector3(-1400, 0, -400),
      new THREE.Vector3(1200, 0, -900),
      new THREE.Vector3(400, 0, -1800),
      new THREE.Vector3(-900, 0, 2400)
    ];

    // Cylinder funnel geometry
    const funnelGeom = new THREE.CylinderGeometry(18.0, 3.5, 120.0, 12, 8, true);
    funnelGeom.translate(0, 60.0, 0);

    const funnelMat = new THREE.MeshBasicMaterial({
      color: 0xd88842,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (let i = 0; i < devilLocations.length; i++) {
      const mesh = new THREE.Mesh(funnelGeom, funnelMat);
      mesh.position.copy(devilLocations[i]);
      devilGroup.add(mesh);
      this.devils.push({
        mesh,
        basePos: devilLocations[i].clone(),
        phase: i * 1.7,
        rotSpeed: 3.5 + (i % 3) * 1.2
      });
    }

    this.group.add(devilGroup);
  }

  _initSkimWakes() {
    // 3. Sand Wakes torn off dunes under low skimming craft
    const wakeCount = 400;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(wakeCount * 3);
    const alphas = new Float32Array(wakeCount);

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xd48845,
      size: 16.0,
      transparent: true,
      opacity: 0.45,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.wakePoints = new THREE.Points(geom, mat);
    this.group.add(this.wakePoints);
    this.wakeIndex = 0;
  }

  update(dt, camera, playerRacer, stormOpticalDepth = 0.0) {
    // Update GPU sand veils
    if (this.veilMat && this.veilMat.uniforms.uTime) {
      this.veilMat.uniforms.uTime.value += dt;
      if (camera) {
        this.veilMat.uniforms.uCamPos.value.copy(camera.position);
      }
      this.veilMat.uniforms.uStormFactor.value = Math.min(1.0, stormOpticalDepth * 1.5);
    }

    // Animate wandering and spinning dust devils
    const t = this.veilMat ? this.veilMat.uniforms.uTime.value : 0;
    for (const d of this.devils) {
      d.mesh.rotation.y += d.rotSpeed * dt;
      // Meandering trajectory across desert
      d.mesh.position.x = d.basePos.x + Math.sin(t * 0.4 + d.phase) * 60.0;
      d.mesh.position.z = d.basePos.z + Math.cos(t * 0.3 + d.phase) * 60.0;
    }

    // Emit skimming sand wake if player racer is low and fast
    if (playerRacer && playerRacer.h < 3.2 && playerRacer.vs > 60.0) {
      const posAttr = this.wakePoints.geometry.attributes.position;
      const alphaAttr = this.wakePoints.geometry.attributes.alpha;
      const count = posAttr.count;

      const idx = this.wakeIndex % count;
      const rear = playerRacer.pos.clone().addScaledVector(playerRacer.frame.T, -7.0);
      posAttr.setXYZ(idx, rear.x + (Math.random() - 0.5) * 6.0, rear.y + Math.random() * 2.0, rear.z + (Math.random() - 0.5) * 6.0);
      alphaAttr.setX(idx, 0.85);

      this.wakeIndex++;
      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
  }
}
