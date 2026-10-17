// src/atmo.js — Dual-layer atmospheric scattering and cloud deck model
// Why: Closed-form optical depth (8km air + 350m jungle haze) eliminates horizon banding and grounds ships in jungle light
import * as THREE from 'three';

// Scattering coefficients
// Rayleigh: Strong in blue [5.8e-6, 13.5e-6, 33.1e-6] m^-1
export const BETA_RAYLEIGH = new THREE.Vector3(5.8e-6, 13.5e-6, 33.1e-6);
// Mie / Jungle Haze: Neutral grey [2.1e-5, 2.1e-5, 2.1e-5] m^-1
export const BETA_MIE = new THREE.Vector3(2.1e-5, 2.1e-5, 2.1e-5);

export const SCALE_HEIGHT_AIR = 8000.0; // 8 km
export const SCALE_HEIGHT_HAZE = 350.0; // 350 m at canopy level
export const MIE_G = 0.76;              // Forward scattering lobe factor

// Analytical optical depth integration along ray segment [p0, p1]
export function rayOpticalDepth(y0, dy, len, H) {
  if (Math.abs(dy) < 1e-4) {
    return Math.exp(-y0 / H) * len;
  }
  return (H / dy) * (Math.exp(-y0 / H) - Math.exp(-(y0 + dy * len) / H));
}

// Shader chunk for atmospheric scattering
export const AtmoShaderChunk = {
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
    uSunColor: { value: new THREE.Color(0xfff6dd) },
    uSkyColor: { value: new THREE.Color(0x38bdf8) },
    uJungleColor: { value: new THREE.Color(0x062814) },
    uTime: { value: 0 }
  },
  vertexPars: `
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
  `,
  vertexMain: `
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vViewDir = vWorldPos - cameraPosition;
  `,
  fragmentPars: `
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uJungleColor;
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    // Phase functions
    float rayleighPhase(float cosTheta) {
      return (3.0 / (16.0 * 3.14159265)) * (1.0 + cosTheta * cosTheta);
    }

    float miePhase(float cosTheta, float g) {
      float g2 = g * g;
      float d = 1.0 + g2 - 2.0 * g * cosTheta;
      return (1.0 / (4.0 * 3.14159265)) * ((1.0 - g2) / (pow(d, 1.5)));
    }

    // Closed-form optical depth
    float opticalDepth(float y0, float dy, float len, float H) {
      if (abs(dy) < 0.0001) {
        return exp(-y0 / H) * len;
      }
      return (H / dy) * (exp(-y0 / H) - exp(-(y0 + dy * len) / H));
    }
  `
};

export class AtmosphereSkyDome {
  constructor(sunDir) {
    this.sunDir = sunDir || new THREE.Vector3(0.5, 0.45, -0.6).normalize();
    const geo = new THREE.SphereGeometry(150000, 32, 24);

    this.uniforms = {
      uSunDir: { value: this.sunDir.clone() },
      uSunColor: { value: new THREE.Color(0xfffaed) },
      uSkyColor: { value: new THREE.Color(0x0c74ba) },
      uJungleColor: { value: new THREE.Color(0x072412) }, // Rich canopy green below horizon
      uTime: { value: 0 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uJungleColor;
        varying vec3 vWorldPos;

        ${AtmoShaderChunk.fragmentPars}

        void main() {
          vec3 dir = normalize(vWorldPos);
          float cosTheta = dot(dir, uSunDir);

          // Ray parameters to infinity
          float dy = max(0.005, dir.y);
          float optAir = 8000.0 / dy;
          float optHaze = 350.0 / max(0.005, dir.y + 0.15);

          vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
          vec3 betaM = vec3(2.1e-5);

          vec3 trans = exp(-(betaR * optAir + betaM * optHaze));

          float pR = rayleighPhase(cosTheta);
          float pM = miePhase(cosTheta, 0.76);

          // Deep clear sky with forward sun glare
          vec3 inscatter = uSunColor * (betaR * pR + betaM * pM * 3.5) * 80000.0 * (1.0 - trans) + uSkyColor * 0.45;

          // Below horizon: smoothly transition to deep jungle canopy, avoiding grey bands
          float horizon = smoothstep(-0.25, 0.05, dir.y);
          vec3 finalColor = mix(uJungleColor * 1.2, inscatter, horizon);

          // Sun disc
          float sunDisc = smoothstep(0.9995, 0.9998, cosTheta);
          finalColor += uSunColor * sunDisc * 12.0;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, mat);
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }
}

// Procedural Cloud Decks (Abyss Deck & High Cirrus Deck)
export class CloudDecks {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // 1. Abyss Cloud Deck (-750 m under circuit, showing canopy gaps)
    const abyssGeo = new THREE.PlaneGeometry(35000, 35000, 32, 32);
    abyssGeo.rotateX(-Math.PI / 2);

    this.abyssMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
        uCloudColor: { value: new THREE.Color(0xd6eef8) },
        uShadowColor: { value: new THREE.Color(0x0c3022) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv * 14.0;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uCloudColor;
        uniform vec3 uShadowColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        // Hash & noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          v += 0.5 * noise(p); p *= 2.02;
          v += 0.25 * noise(p); p *= 2.03;
          v += 0.125 * noise(p);
          return v;
        }

        void main() {
          vec2 uvFlow = vUv + vec2(uTime * 0.004, uTime * 0.002);
          float n = fbm(uvFlow);

          // Gaps showing canopy below
          float coverage = smoothstep(0.42, 0.72, n);
          if (coverage < 0.01) discard;

          // Rim shading & sun light
          vec3 col = mix(uShadowColor, uCloudColor, smoothstep(0.45, 0.8, n));
          float dist = length(vWorldPos.xz);
          float edgeFade = 1.0 - smoothstep(12000.0, 17000.0, dist);

          gl_FragColor = vec4(col, coverage * 0.82 * edgeFade);
        }
      `
    });

    this.abyssMesh = new THREE.Mesh(abyssGeo, this.abyssMat);
    this.abyssMesh.position.y = -720.0;
    this.group.add(this.abyssMesh);

    // 2. High Cirrus Deck (+2600 m altitude)
    const cirrusGeo = new THREE.PlaneGeometry(60000, 60000, 16, 16);
    cirrusGeo.rotateX(-Math.PI / 2);
    this.cirrusMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xf0f8ff) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 8.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        void main() {
          vec2 p = vUv + vec2(uTime * 0.002, uTime * 0.001);
          float n = noise(p) * 0.6 + noise(p * 2.5) * 0.4;
          float alpha = smoothstep(0.55, 0.85, n) * 0.45;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });
    this.cirrusMesh = new THREE.Mesh(cirrusGeo, this.cirrusMat);
    this.cirrusMesh.position.y = 2600.0;
    this.group.add(this.cirrusMesh);

    scene.add(this.group);
  }

  update(dt) {
    this.abyssMat.uniforms.uTime.value += dt;
    this.cirrusMat.uniforms.uTime.value += dt;
  }
}
