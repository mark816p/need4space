// src/frost.js — Ice Planet atmospheric optics, dusk sky dome, halo, sun dogs, light pillar & aurora
// Why: Sun ~8° over SW horizon through orange/rose band, rising to indigo with stars, ringed ice giant SE, aurora N
import * as THREE from 'three';

// Sun ~8° above the South-West horizon
export const ICE_SUN_DIR = new THREE.Vector3(-0.70, 0.139, 0.70).normalize();
export const ICE_RINGED_PLANET_DIR = new THREE.Vector3(0.68, 0.32, -0.65).normalize();

// Ice fog optical depth with scale height 260m
export function iceOpticalDepth(y0, dy, len, H = 260.0) {
  if (Math.abs(dy) < 1e-4) return Math.exp(-Math.max(0, y0) / H) * len;
  return (H / dy) * (Math.exp(-Math.max(0, y0) / H) - Math.exp(-Math.max(0, y0 + dy * len) / H));
}

export class FrostAtmosphereDome {
  constructor(sunDir = ICE_SUN_DIR) {
    this.sunDir = sunDir.clone();

    // Large sky sphere (radius 180,000m)
    const geo = new THREE.SphereGeometry(180000, 48, 32);

    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uPlanetDir: { value: ICE_RINGED_PLANET_DIR.clone() },
        uTime: { value: 0 },
        uAuroraIntensity: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        varying vec3 vWorldPos;
        void main() {
          vWorldDir = normalize(position);
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uPlanetDir;
        uniform float uTime;
        uniform float uAuroraIntensity;
        varying vec3 vWorldDir;
        varying vec3 vWorldPos;

        // Hash for background stars
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float y = dir.y;

          // 1. Dusk Sky Gradient:
          // Low horizon: warm fiery orange/rose band
          // Mid sky: deep violet
          // Zenith: deep indigo night
          vec3 colHorizon = vec3(0.95, 0.42, 0.22); // Fiery orange/rose
          vec3 colMid = vec3(0.38, 0.15, 0.42);     // Violet
          vec3 colZenith = vec3(0.02, 0.04, 0.12);  // Deep indigo night
          vec3 colBelow = vec3(0.01, 0.02, 0.05);   // Dark frozen sea floor

          vec3 skyCol;
          if (y > 0.0) {
            float tLow = smoothstep(0.0, 0.22, y);
            float tHigh = smoothstep(0.22, 0.85, y);
            vec3 lowSky = mix(colHorizon, colMid, tLow);
            skyCol = mix(lowSky, colZenith, tHigh);
          } else {
            skyCol = mix(colHorizon, colBelow, smoothstep(0.0, -0.15, y));
          }

          // 2. Stars in the upper indigo sky
          if (y > 0.18) {
            vec2 starCoord = floor(dir.xz / (y + 0.3) * 350.0);
            float starHash = hash(starCoord);
            if (starHash > 0.985) {
              float starTwinkle = 0.6 + 0.4 * sin(uTime * 3.0 + starHash * 6.28);
              skyCol += vec3(0.85, 0.9, 1.0) * (starHash - 0.985) * 45.0 * starTwinkle * smoothstep(0.18, 0.5, y);
            }
          }

          // 3. Crescent Ringed Ice Giant in South-East Sky
          float planetAngle = dot(dir, uPlanetDir);
          if (planetAngle > 0.992) {
            // Planet disc
            float rDisc = acos(clamp(planetAngle, -1.0, 1.0)) / 0.08;
            if (rDisc < 1.0) {
              // Crescent illumination from sun
              vec3 sunProj = normalize(uSunDir - uPlanetDir * dot(uSunDir, uPlanetDir));
              vec3 dirProj = normalize(dir - uPlanetDir * dot(dir, uPlanetDir));
              float sunFace = dot(dirProj, sunProj);
              float crescent = smoothstep(-0.2, 0.7, sunFace) * (1.0 - rDisc * 0.4);
              vec3 planetCol = vec3(0.42, 0.65, 0.88) * crescent * 2.2;
              skyCol = mix(skyCol, planetCol, smoothstep(1.0, 0.96, rDisc));
            }
          }
          // Planetary Rings
          float ringPlane = abs(dot(dir - uPlanetDir, vec3(0.2, 0.95, 0.2)));
          if (planetAngle > 0.982 && planetAngle < 0.997 && ringPlane < 0.008) {
            skyCol += vec3(0.55, 0.72, 0.95) * 1.2 * smoothstep(0.008, 0.001, ringPlane);
          }

          // 4. Northern Aurora Curtains (Waving green/cyan bands in the North, dir.z < -0.3)
          if (dir.z < -0.2 && y > 0.08 && y < 0.75) {
            float wave1 = sin(dir.x * 6.0 + uTime * 0.45) * 0.08;
            float wave2 = cos(dir.x * 12.0 - uTime * 0.3) * 0.04;
            float curtainY = y + wave1 + wave2;
            float auroraBand = smoothstep(0.15, 0.35, curtainY) * (1.0 - smoothstep(0.35, 0.65, curtainY));
            // Vertical striations (flux lines)
            float striation = sin(dir.x * 120.0 + uTime * 0.8) * 0.5 + 0.5;
            vec3 auroraColor = mix(vec3(0.1, 0.95, 0.55), vec3(0.15, 0.65, 0.95), y * 1.5);
            skyCol += auroraColor * (auroraBand * (0.6 + 0.4 * striation)) * uAuroraIntensity * 1.1;
          }

          // 5. Sun Disc, 22° Halo, Sun Dogs & Vertical Light Pillar
          float sunCos = dot(dir, uSunDir);

          // Small hot sun disc
          if (sunCos > 0.9992) {
            skyCol += vec3(1.0, 0.96, 0.88) * 18.0;
          } else if (sunCos > 0.996) {
            skyCol += vec3(1.0, 0.75, 0.4) * 4.5 * (sunCos - 0.996) / 0.0032;
          }

          // Vertical Light Pillar from hexagonal ice crystal plates
          float horizDistToSun = length(dir.xz - uSunDir.xz);
          if (horizDistToSun < 0.045 && y > 0.0) {
            float pillar = (1.0 - horizDistToSun / 0.045) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.28, 0.55, y));
            skyCol += vec3(1.0, 0.68, 0.45) * pillar * 1.8;
          }

          // 22° Ice Crystal Halo (cos(22 deg) ~= 0.9272)
          float haloAngle = sunCos;
          float haloRing = smoothstep(0.915, 0.927, haloAngle) * (1.0 - smoothstep(0.927, 0.940, haloAngle));
          if (haloRing > 0.01) {
            // Subtle spectral dispersion (red inside, blue outside)
            vec3 haloColor = mix(vec3(1.0, 0.55, 0.3), vec3(0.6, 0.8, 1.0), (haloAngle - 0.915) / 0.025);
            skyCol += haloColor * haloRing * 0.85;
          }

          // Two Sun Dogs (Parhelia) at 22° left and right along the solar elevation level
          float dY = abs(dir.y - uSunDir.y);
          if (dY < 0.035 && haloRing > 0.05) {
            float parhelion = (1.0 - dY / 0.035) * haloRing;
            skyCol += vec3(1.0, 0.82, 0.55) * parhelion * 2.4;
          }

          gl_FragColor = vec4(skyCol, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, this.material);
  }

  update(dt) {
    if (this.material && this.material.uniforms.uTime) {
      this.material.uniforms.uTime.value += dt;
    }
  }
}
