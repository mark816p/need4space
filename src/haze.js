// src/haze.js — Desert Planet atmospheric dome, Mie dust forward scatter, moon, and sandstorm ellipsoid
// Why: Sun ~7.5° over WNW horizon, big hazy dust glow, warm rose to violet sky dome,
// rising moon in east, and closed-form ray-ellipsoid optical depth sandstorm (obscures without blacking out)

import * as THREE from 'three';

// Sun ~7.5° over WNW horizon (azimuth ~295°, elevation 7.5°)
export const DESERT_SUN_DIR = new THREE.Vector3(-0.92, 0.1305, 0.38).normalize();

export class DesertHaze {
  constructor(scene, sunDir = DESERT_SUN_DIR) {
    this.scene = scene;
    this.sunDir = sunDir.clone().normalize();
    this.group = new THREE.Group();
    this.group.name = 'desert_haze_dome';

    this._buildSkyDome();
    this._buildRisingMoon();
    this._buildSandstormEllipsoid();

    this.scene.add(this.group);
  }

  _buildSkyDome() {
    // Sky Dome with radius 160,000m
    const domeGeom = new THREE.SphereGeometry(160000, 36, 24);
    domeGeom.scale(-1, 1, 1); // Invert faces inward

    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldDir;
        varying float vElevation;

        void main() {
          vWorldDir = normalize(position);
          vElevation = vWorldDir.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vWorldDir;
        varying float vElevation;

        void main() {
          vec3 dir = normalize(vWorldDir);

          // 1. Sky Gradient: Warm rose near horizon to deep violet overhead
          vec3 horizonRose = vec3(0.92, 0.48, 0.32);
          vec3 midWarmth = vec3(0.68, 0.32, 0.36);
          vec3 zenithViolet = vec3(0.18, 0.08, 0.24);
          vec3 groundSand = vec3(0.72, 0.42, 0.24); // Below horizon ends on sand, no grey band!

          vec3 skyCol;
          if (dir.y >= 0.0) {
            float h = pow(dir.y, 0.45);
            skyCol = mix(horizonRose, midWarmth, smoothstep(0.0, 0.35, dir.y));
            skyCol = mix(skyCol, zenithViolet, smoothstep(0.25, 0.85, dir.y));

            // World shadow (Earth shadow) rising in the east opposite the sun
            float oppSun = max(0.0, dot(dir, -vec3(uSunDir.x, 0.0, uSunDir.z)));
            float shadowRise = smoothstep(0.0, 0.22, dir.y) * (1.0 - smoothstep(0.22, 0.45, dir.y));
            vec3 shadowDark = vec3(0.14, 0.09, 0.18);
            skyCol = mix(skyCol, shadowDark, pow(oppSun, 2.5) * shadowRise * 0.65);
          } else {
            // Below horizon: dome's rays end on the sand
            float under = clamp(-dir.y * 4.0, 0.0, 1.0);
            skyCol = mix(horizonRose, groundSand, under);
          }

          // 2. Big hazy glow (dust forward scatter Mie phase function) around sun
          float cosTheta = dot(dir, uSunDir);
          float g = 0.88; // Strong forward scattering parameter
          float miePhase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);
          vec3 sunHaze = vec3(1.0, 0.78, 0.52) * (miePhase * 0.15);

          // Sharp solar disc (sun ~7.5° up)
          float sunDisc = smoothstep(0.9994, 0.9998, cosTheta);
          vec3 discCol = vec3(1.6, 1.3, 0.9);

          skyCol += sunHaze + discCol * sunDisc;

          gl_FragColor = vec4(skyCol, 1.0);
        }
      `
    });

    this.domeMesh = new THREE.Mesh(domeGeom, this.domeMat);
    this.group.add(this.domeMesh);
  }

  _buildRisingMoon() {
    // Pale cratered moon rising in the eastern sky opposite sunset
    const moonDist = 120000.0;
    // Positioned east (positive X, slight elevation)
    const moonDir = new THREE.Vector3(0.92, 0.18, -0.36).normalize();
    const moonPos = moonDir.clone().multiplyScalar(moonDist);

    const moonGeom = new THREE.SphereGeometry(3200, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe2deda,
      transparent: true,
      opacity: 0.85
    });

    this.moonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.moonMesh.position.copy(moonPos);
    this.group.add(this.moonMesh);
  }

  _buildSandstormEllipsoid() {
    // "Sandstorm: a towering dust ellipsoid over part of the circuit,
    // closed-form optical depth along any ray; from outside a red wall,
    // inside everything deep orange-red with the far deck lost."
    this.stormCenter = new THREE.Vector3(-1200.0, 160.0, -1400.0);
    this.stormRadius = new THREE.Vector3(1350.0, 520.0, 1150.0);

    const stormGeom = new THREE.SphereGeometry(1.0, 36, 24);
    // Scale unit sphere to ellipsoid dimensions
    stormGeom.scale(this.stormRadius.x, this.stormRadius.y, this.stormRadius.z);

    this.stormMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uCenter: { value: this.stormCenter },
        uRadius: { value: this.stormRadius },
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: this.sunDir },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vModelPos;

        void main() {
          vModelPos = position;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uCenter;
        uniform vec3 uRadius;
        uniform vec3 uCamPos;
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vModelPos;

        // Closed-form analytical ray-ellipsoid optical depth
        float getEllipsoidOpticalDepth(vec3 ro, vec3 rd, vec3 center, vec3 rad) {
          // Transform ray to unit sphere space
          vec3 o = (ro - center) / rad;
          vec3 d = rd / rad;

          float A = dot(d, d);
          float B = dot(o, d);
          float C = dot(o, o) - 1.0;

          float disc = B * B - A * C;
          if (disc <= 0.0) return 0.0;

          float sqrtDisc = sqrt(disc);
          float t0 = (-B - sqrtDisc) / A;
          float t1 = (-B + sqrtDisc) / A;

          // Clamp to ray front
          t0 = max(0.0, t0);
          t1 = max(0.0, t1);
          if (t1 <= t0) return 0.0;

          // Parabolic density integration: rho(p) = rho0 * (1 - ||p||^2)
          // Analytic closed-form solution: (2/3) * (disc^(3/2)) / (A^(3/2))
          float opticalDepth = (2.0 / 3.0) * pow(disc, 1.5) / pow(A, 1.5);
          return opticalDepth * 0.0028;
        }

        void main() {
          vec3 rayDir = normalize(vWorldPos - uCamPos);
          float tau = getEllipsoidOpticalDepth(uCamPos, rayDir, uCenter, uRadius);

          if (tau <= 0.001) discard;

          // Dust wall color: deep terracotta-red outside, luminous orange-red inside
          vec3 outerRedWall = vec3(0.85, 0.28, 0.16);
          vec3 innerWarmOrange = vec3(0.95, 0.48, 0.22);

          // Sunlight scattering within dust
          float sunDot = max(0.0, dot(rayDir, uSunDir));
          vec3 dustCol = mix(outerRedWall, innerWarmOrange, sunDot * 0.5 + 0.5);

          // Transmittance T = exp(-tau)
          float alpha = clamp(1.0 - exp(-tau * 1.8), 0.0, 0.88); // Obscures without complete blackout!

          gl_FragColor = vec4(dustCol, alpha);
        }
      `
    });

    this.stormMesh = new THREE.Mesh(stormGeom, this.stormMat);
    this.stormMesh.position.copy(this.stormCenter);
    this.group.add(this.stormMesh);
  }

  update(dt, camera) {
    if (this.domeMat && this.domeMat.uniforms.uTime) {
      this.domeMat.uniforms.uTime.value += dt;
    }
    if (this.stormMat) {
      this.stormMat.uniforms.uTime.value += dt;
      if (camera) {
        this.stormMat.uniforms.uCamPos.value.copy(camera.position);
      }
    }
  }

  // Helper to query optical depth at player position (for HUD/fog adjustments)
  getOpticalDepthAt(pos) {
    if (!pos) return 0.0;
    const norm = new THREE.Vector3(
      (pos.x - this.stormCenter.x) / this.stormRadius.x,
      (pos.y - this.stormCenter.y) / this.stormRadius.y,
      (pos.z - this.stormCenter.z) / this.stormRadius.z
    );
    const dSq = norm.lengthSq();
    if (dSq >= 1.0) return 0.0;
    return (1.0 - dSq);
  }
}
