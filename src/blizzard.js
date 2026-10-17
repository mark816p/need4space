// src/blizzard.js — GPU blizzard weather, diamond dust glints, ship frost wakes, and steam geysers
// Why: Snow streams in drifting bands, diamond dust twinkling toward sun, geysers erupting, kept off lens
import * as THREE from 'three';

export class BlizzardWeather {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // 1. GPU Snow Streams & Diamond Dust Particles (3000 particles orbiting player/camera)
    this.snowCount = 3000;
    const snowGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.snowCount * 3);
    const seeds = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i++) {
      // Box volume 300m x 120m x 300m
      positions[i * 3 + 0] = (Math.random() - 0.5) * 300.0;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300.0;

      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

    this.snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(-0.70, 0.139, 0.70).normalize() },
        uCamPos: { value: new THREE.Vector3(0, 0, 0) },
        uWind: { value: new THREE.Vector3(14.0, -4.5, 14.0) }, // SW to NE wind
        uShelter: { value: 0.0 } // 1.0 = fully sheltered in crevasse/tunnel, no snow smear
      },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uWind;
        uniform float uShelter;
        attribute vec3 aSeed;
        varying float vAlpha;
        varying float vGlint;

        void main() {
          // Wrap particle positions inside 300x120x300 moving cube centered on camera
          vec3 p = position + uWind * uTime * (0.8 + aSeed.x * 0.4);
          vec3 box = vec3(300.0, 120.0, 300.0);
          p = mod(p, box) - box * 0.5;
          vec3 worldPos = uCamPos + p;

          // Distance to camera: fade out near lens (no smear across view!) and far away
          float dist = length(p);
          float nearFade = smoothstep(3.5, 9.0, dist); // Kept strictly off the lens
          float farFade = 1.0 - smoothstep(100.0, 150.0, dist);

          // Diamond dust glints: forward scattering towards sun
          vec3 toCam = normalize(-p);
          float sunDot = max(0.0, dot(toCam, vec3(-0.70, 0.139, 0.70)));
          float twinkle = sin(uTime * 8.0 + aSeed.y * 62.8) * 0.5 + 0.5;
          vGlint = pow(sunDot, 12.0) * twinkle * 2.5;

          // Shelter factor suppresses snow inside crevasse walls
          vAlpha = nearFade * farFade * (0.35 + aSeed.z * 0.45) * (1.0 - uShelter);

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          gl_PointSize = (3.5 + aSeed.x * 4.0) * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vGlint;
        void main() {
          // Circular soft particle
          vec2 coord = gl_PointCoord - vec2(0.5);
          float r = length(coord);
          if (r > 0.5) discard;
          float circle = smoothstep(0.5, 0.1, r);

          vec3 baseSnow = vec3(0.85, 0.92, 1.0);
          vec3 glintCol = vec3(1.0, 0.95, 0.85);
          vec3 col = baseSnow + glintCol * vGlint;

          gl_FragColor = vec4(col, vAlpha * circle);
        }
      `
    });

    this.snowPoints = new THREE.Points(snowGeo, this.snowMat);
    this.group.add(this.snowPoints);

    // 2. Steam Geysers in Open Water (Erupting plumes every few seconds)
    this.geysers = [];
    const geyserPositions = [
      new THREE.Vector3(1680, -6.0, 920),
      new THREE.Vector3(1820, -6.0, 1080),
      new THREE.Vector3(-1450, -6.0, 1350),
      new THREE.Vector3(-1580, -6.0, 1480),
    ];

    const plumeGeo = new THREE.CylinderGeometry(14.0, 4.0, 85.0, 12, 6, true);
    plumeGeo.translate(0, 42.5, 0);

    const plumeMat = new THREE.MeshStandardMaterial({
      color: 0x90caf9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.55,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < geyserPositions.length; i++) {
      const gMesh = new THREE.Mesh(plumeGeo, plumeMat);
      gMesh.position.copy(geyserPositions[i]);
      this.group.add(gMesh);
      this.geysers.push({
        mesh: gMesh,
        phase: i * 2.1,
        period: 5.5 + i * 0.8
      });
    }

    scene.add(this.group);
  }

  update(dt, camera, inCrevasse = false) {
    if (this.snowMat && this.snowMat.uniforms.uTime) {
      this.snowMat.uniforms.uTime.value += dt;
      if (camera) {
        this.snowMat.uniforms.uCamPos.value.copy(camera.position);
      }
      const targetShelter = inCrevasse ? 1.0 : 0.0;
      this.snowMat.uniforms.uShelter.value += (targetShelter - this.snowMat.uniforms.uShelter.value) * Math.min(1.0, dt * 5.0);
    }

    // Geyser eruption cycle
    const time = this.snowMat ? this.snowMat.uniforms.uTime.value : 0;
    for (const g of this.geysers) {
      const cycle = (time + g.phase) % g.period;
      // Erupts for first 2.5 seconds of cycle
      if (cycle < 2.5) {
        const tErupt = cycle / 2.5;
        const scaleY = Math.sin(tErupt * Math.PI) * 1.6;
        g.mesh.scale.set(1.0 + tErupt * 0.8, Math.max(0.01, scaleY), 1.0 + tErupt * 0.8);
        g.mesh.visible = true;
      } else {
        g.mesh.visible = false;
      }
    }
  }
}
