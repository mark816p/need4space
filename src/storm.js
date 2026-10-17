// src/storm.js — Distant eastern thunderheads, procedurally generated lightning ribbons & horizon flicker
// Why: Thunderheads over the east horizon baked into sky band, lightning strikes with ambient environmental flash
import * as THREE from 'three';

export class HorizonStorm {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // 1. Distant Eastern Thunderheads Band (Azimuth 45° to 135°, Elevation 0° to 30°, Radius 60,000m)
    const arcRadius = 60000.0;
    const bandHeight = 22000.0;
    const thunderheadGeo = new THREE.CylinderGeometry(
      arcRadius,
      arcRadius,
      bandHeight,
      32,
      1,
      true,
      Math.PI * 0.15, // Eastern azimuth range
      Math.PI * 0.65
    );
    thunderheadGeo.translate(0, bandHeight * 0.5, 0);

    this.cloudMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vWorldPos = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uFlash;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          // Billowing cumulonimbus cloud shapes
          vec2 uv = vUv * vec2(8.0, 3.0);
          float n = noise(uv + vec2(uTime * 0.015, 0.0)) * 0.6 +
                    noise(uv * 2.5 - vec2(uTime * 0.02, 0.0)) * 0.4;

          float cloudShape = smoothstep(0.2, 0.7, n * (1.0 - vUv.y * 0.5));

          vec3 darkStorm = vec3(0.02, 0.03, 0.06);
          vec3 rimLight = vec3(0.22, 0.15, 0.28);
          vec3 flashCol = vec3(0.65, 0.85, 1.0) * uFlash * 3.5;

          vec3 col = mix(darkStorm, rimLight, vUv.y * 0.7) + flashCol;
          float alpha = clamp(cloudShape * 0.95, 0.0, 0.95);

          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    this.cloudMesh = new THREE.Mesh(thunderheadGeo, this.cloudMat);
    this.group.add(this.cloudMesh);

    // 2. Lightning Ribbon Geometry (Dynamic jagged lightning bolt)
    this.lightningGeo = new THREE.BufferGeometry();
    const maxLightningVerts = 48;
    this.lightningPositions = new Float32Array(maxLightningVerts * 3);
    this.lightningGeo.setAttribute('position', new THREE.BufferAttribute(this.lightningPositions, 3));

    this.lightningMat = new THREE.LineBasicMaterial({
      color: 0xcee8ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.0
    });
    this.lightningLine = new THREE.Line(this.lightningGeo, this.lightningMat);
    this.group.add(this.lightningLine);

    // Lightning strike timer state
    this.timeToNextStrike = 4.0;
    this.strikeDuration = 0.0;
    this.flashIntensity = 0.0;

    scene.add(this.group);
  }

  _triggerStrike() {
    this.strikeDuration = 0.28;
    this.flashIntensity = 1.0;

    // Generate procedural jagged bolt from east cloud base down toward sea horizon
    const startX = 42000.0 + (Math.random() - 0.5) * 15000.0;
    const startZ = 12000.0 + (Math.random() - 0.5) * 10000.0;
    const startY = 16000.0;
    const endY = -10.0;

    let curX = startX;
    let curY = startY;
    let curZ = startZ;
    const steps = 32;
    const dy = (endY - startY) / steps;

    for (let i = 0; i <= steps; i++) {
      if (i > 0 && i < steps) {
        curX += (Math.random() - 0.5) * 1200.0;
        curZ += (Math.random() - 0.5) * 1200.0;
      }
      curY += dy;

      this.lightningPositions[i * 3 + 0] = curX;
      this.lightningPositions[i * 3 + 1] = curY;
      this.lightningPositions[i * 3 + 2] = curZ;
    }

    this.lightningGeo.attributes.position.needsUpdate = true;
    this.lightningGeo.setDrawRange(0, steps + 1);
  }

  update(dt) {
    if (this.cloudMat && this.cloudMat.uniforms.uTime) {
      this.cloudMat.uniforms.uTime.value += dt;
    }

    this.timeToNextStrike -= dt;
    if (this.timeToNextStrike <= 0) {
      this._triggerStrike();
      this.timeToNextStrike = 5.0 + Math.random() * 4.5;
    }

    if (this.strikeDuration > 0) {
      this.strikeDuration -= dt;
      // Multi-pulse flash flicker
      const pulse = Math.sin(this.strikeDuration * 48.0) * 0.5 + 0.5;
      this.flashIntensity = (this.strikeDuration / 0.28) * pulse;
      this.lightningMat.opacity = this.flashIntensity;
      if (this.cloudMat) {
        this.cloudMat.uniforms.uFlash.value = this.flashIntensity;
      }
    } else {
      this.flashIntensity = 0.0;
      this.lightningMat.opacity = 0.0;
      if (this.cloudMat) {
        this.cloudMat.uniforms.uFlash.value = 0.0;
      }
    }
  }
}
