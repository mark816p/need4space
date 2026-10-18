// src/post.js — Post-processing pipeline: GTAO, Deck SSR, Bloom, and Look Pass
// Why: Filmic tone mapping, ambient occlusion in track recesses, screen-space reflections
// on glossy carbon deck, engine/pad bloom, and high-G chromatic aberration

import * as THREE from 'three';
import { LookController } from './look.js';

// Screen-covering single big triangle for zero-overhead fullscreen passes
// Why: Avoids diagonal quad seam interpolations and rasterizer edge clipping
class FullScreenTriangle {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.mesh = new THREE.Mesh(this.geometry);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(renderer, material, target = null) {
    this.mesh.material = material;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.geometry.dispose();
  }
}

// -----------------------------------------------------------------------------
// Shader 1: Ground-Truth Ambient Occlusion (GTAO)
// 8 directions x 3 radial steps sampling reconstructed view-space positions
// -----------------------------------------------------------------------------
const GTAOShader = {
  uniforms: {
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    cameraNear: { value: 0.2 },
    cameraFar: { value: 30000.0 },
    projMatrix: { value: new THREE.Matrix4() },
    invProjMatrix: { value: new THREE.Matrix4() },
    radius: { value: 2.2 },
    intensity: { value: 1.0 },
    exponent: { value: 1.3 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform mat4 invProjMatrix;
    uniform float radius;
    uniform float intensity;
    uniform float exponent;
    varying vec2 vUv;

    // View-space position reconstruction from depth buffer
    vec3 getViewPos(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = invProjMatrix * clip;
      return view.xyz / max(view.w, 0.00001);
    }

    void main() {
      float depth = texture2D(tDepth, vUv).r;
      // Sky/space background has depth == 1.0, skip AO
      if (depth >= 0.99999) {
        gl_FragColor = vec4(1.0);
        return;
      }

      vec3 p = getViewPos(vUv);
      vec3 dx = dFdx(p);
      vec3 dy = dFdy(p);
      vec3 normal = normalize(cross(dx, dy));

      float occlusion = 0.0;
      float sampleStep = radius / (max(-p.z, 0.1) * 3.0);
      vec2 texel = 1.0 / resolution;

      // 8 directions around circle
      const float PI = 3.14159265359;
      for (int i = 0; i < 8; i++) {
        float angle = float(i) * (2.0 * PI / 8.0);
        vec2 dir = vec2(cos(angle), sin(angle));

        for (int j = 1; j <= 3; j++) {
          vec2 sampleUv = vUv + dir * (float(j) * sampleStep * texel * 12.0);
          vec3 sp = getViewPos(sampleUv);
          vec3 diff = sp - p;
          float d = length(diff);
          if (d > 0.01 && d < radius * 3.0) {
            float ndl = max(0.0, dot(normal, normalize(diff)));
            float falloff = 1.0 - (d / (radius * 3.0));
            occlusion += ndl * falloff * (1.0 / 24.0);
          }
        }
      }

      float ao = clamp(1.0 - pow(occlusion * intensity, exponent), 0.0, 1.0);
      gl_FragColor = vec4(vec3(ao), 1.0);
    }
  `
};

// -----------------------------------------------------------------------------
// Shader 2: Bilateral Depth-Aware Blur
// Preserves geometric edges while smoothing high-frequency noise
// -----------------------------------------------------------------------------
const BilateralBlurShader = {
  uniforms: {
    tAO: { value: null },
    tDepth: { value: null },
    direction: { value: new THREE.Vector2(1, 0) },
    resolution: { value: new THREE.Vector2() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tAO;
    uniform sampler2D tDepth;
    uniform vec2 direction;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec2 texel = direction / resolution;
      float centerDepth = texture2D(tDepth, vUv).r;
      float centerAO = texture2D(tAO, vUv).r;

      if (centerDepth >= 0.99999) {
        gl_FragColor = vec4(1.0);
        return;
      }

      float totalAO = centerAO;
      float totalWeight = 1.0;

      const float weights[4] = float[4](0.227027, 0.1945946, 0.1216216, 0.054054);
      for (int i = 1; i < 4; i++) {
        vec2 offset = texel * float(i);
        vec2 uv1 = vUv + offset;
        vec2 uv2 = vUv - offset;

        float d1 = texture2D(tDepth, uv1).r;
        float d2 = texture2D(tDepth, uv2).r;

        float w1 = weights[i] * max(0.0, 1.0 - abs(d1 - centerDepth) * 350.0);
        float w2 = weights[i] * max(0.0, 1.0 - abs(d2 - centerDepth) * 350.0);

        totalAO += texture2D(tAO, uv1).r * w1;
        totalWeight += w1;

        totalAO += texture2D(tAO, uv2).r * w2;
        totalWeight += w2;
      }

      gl_FragColor = vec4(vec3(totalAO / max(totalWeight, 0.0001)), 1.0);
    }
  `
};

// -----------------------------------------------------------------------------
// Shader 3: Deck SSR (Screen-Space Reflections)
// Raymarches 16 steps with 4 binary search refinements across track deck
// -----------------------------------------------------------------------------
const DeckSSRShader = {
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    invProjMatrix: { value: new THREE.Matrix4() },
    projMatrix: { value: new THREE.Matrix4() },
    maxDistance: { value: 60.0 },
    stepSize: { value: 0.8 },
    edgeFade: { value: 0.18 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 invProjMatrix;
    uniform mat4 projMatrix;
    uniform float maxDistance;
    uniform float stepSize;
    uniform float edgeFade;
    varying vec2 vUv;

    vec3 getViewPos(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = invProjMatrix * clip;
      return view.xyz / max(view.w, 0.00001);
    }

    vec2 getUv(vec3 viewPos) {
      vec4 clip = projMatrix * vec4(viewPos, 1.0);
      vec3 ndc = clip.xyz / max(clip.w, 0.00001);
      return ndc.xy * 0.5 + 0.5;
    }

    void main() {
      float depth = texture2D(tDepth, vUv).r;
      if (depth >= 0.99999) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec3 p = getViewPos(vUv);
      vec3 dx = dFdx(p);
      vec3 dy = dFdy(p);
      vec3 normal = normalize(cross(dx, dy));

      // In space, reflections are strongest on upward facing track deck
      // Filter out surfaces facing away from deck plane
      vec3 viewDir = normalize(p);
      float grazing = 1.0 - max(0.0, -dot(viewDir, normal));
      float fresnel = pow(grazing, 3.0) * 0.75 + 0.08;

      vec3 rayDir = reflect(viewDir, normal);
      // If ray points towards camera or away from scene, reject
      if (rayDir.z > 0.0) {
        gl_FragColor = vec4(0.0);
        return;
      }

      // Linear raymarch: 16 steps
      vec3 rayPos = p + normal * 0.12;
      vec3 hitPos = rayPos;
      bool hit = false;
      float curStep = stepSize;

      for (int i = 0; i < 16; i++) {
        rayPos += rayDir * curStep;
        curStep *= 1.15; // Geometric progression covers more space distance

        vec2 sampleUv = getUv(rayPos);
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
          break;
        }

        vec3 scenePos = getViewPos(sampleUv);
        float deltaZ = rayPos.z - scenePos.z;

        // Check if ray entered behind surface within thickness threshold
        if (deltaZ < 0.0 && deltaZ > -5.0) {
          hit = true;
          hitPos = rayPos;

          // 4 binary refinement steps
          vec3 bMin = rayPos - rayDir * curStep;
          vec3 bMax = rayPos;
          for (int b = 0; b < 4; b++) {
            vec3 bMid = (bMin + bMax) * 0.5;
            vec2 bUv = getUv(bMid);
            vec3 bScene = getViewPos(bUv);
            if (bMid.z <= bScene.z) {
              bMax = bMid;
            } else {
              bMin = bMid;
            }
          }
          hitPos = (bMin + bMax) * 0.5;
          break;
        }
      }

      if (!hit) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec2 hitUv = getUv(hitPos);
      // Screen edge vignette falloff for reflections exiting screen
      vec2 edgeDist = min(hitUv, 1.0 - hitUv);
      float edgeAlpha = smoothstep(0.0, edgeFade, min(edgeDist.x, edgeDist.y));

      vec3 reflectCol = texture2D(tColor, hitUv).rgb;
      gl_FragColor = vec4(reflectCol * fresnel * edgeAlpha, 1.0);
    }
  `
};

// -----------------------------------------------------------------------------
// Shader 4: Bloom Isolation & Blur Pyramids
// -----------------------------------------------------------------------------
const BloomHighPassShader = {
  uniforms: {
    tColor: { value: null },
    threshold: { value: 0.85 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tColor;
    uniform float threshold;
    varying vec2 vUv;

    void main() {
      vec3 col = texture2D(tColor, vUv).rgb;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float factor = clamp((lum - threshold) / max(threshold, 0.01), 0.0, 1.0);
      gl_FragColor = vec4(col * factor, 1.0);
    }
  `
};

const GaussianBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    direction: { value: new THREE.Vector2(1, 0) },
    resolution: { value: new THREE.Vector2() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec2 texel = direction / resolution;
      vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;

      sum += texture2D(tDiffuse, vUv + texel * 1.3846153846).rgb * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - texel * 1.3846153846).rgb * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + texel * 3.2307692308).rgb * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - texel * 3.2307692308).rgb * 0.0702702703;

      gl_FragColor = vec4(sum, 1.0);
    }
  `
};

// -----------------------------------------------------------------------------
// Shader 5: LookPass Composite
// Tone mapping, chromatic aberration, vignette, and film grain
// -----------------------------------------------------------------------------
const LookCompositeShader = {
  uniforms: {
    tScene: { value: null },
    tAO: { value: null },
    tSSR: { value: null },
    tBloom: { value: null },
    time: { value: 0 },
    exposure: { value: 1.08 },
    contrast: { value: 1.06 },
    saturation: { value: 1.12 },
    grainStrength: { value: 0.04 },
    vignetteFalloff: { value: 0.35 },
    vignetteDarkness: { value: 0.65 },
    chromaOffset: { value: 0.001 },
    bloomStrength: { value: 0.65 },
    waterSpray: { value: 0.0 },
    speedRatio: { value: 0.0 },
    heatShimmer: { value: 0.0 },
    canyonAO: { value: 1.0 },
    engineHeat: { value: 1.0 },
    enableShafts: { value: 1.0 },
    enableAO: { value: 1.0 },
    enableSSR: { value: 1.0 },
    enableBloom: { value: 1.0 },
    enableLook: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tScene;
    uniform sampler2D tAO;
    uniform sampler2D tSSR;
    uniform sampler2D tBloom;
    uniform float time;
    uniform float exposure;
    uniform float contrast;
    uniform float saturation;
    uniform float grainStrength;
    uniform float vignetteFalloff;
    uniform float vignetteDarkness;
    uniform float chromaOffset;
    uniform float bloomStrength;
    uniform float waterSpray;
    uniform float speedRatio;
    uniform float heatShimmer;
    uniform float canyonAO;
    uniform float engineHeat;
    uniform float enableShafts;
    uniform float enableAO;
    uniform float enableSSR;
    uniform float enableBloom;
    uniform float enableLook;
    varying vec2 vUv;

    // ACES Filmic Tone Mapping approximation
    vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec2 toCenter = vUv - 0.5;
      float dist = length(toCenter);
      vec2 dir = toCenter / max(dist, 0.0001);

      // Lens Water Pass: refractive draining film and outward-blown drops
      vec2 sampleUv = vUv;

      // Heat Shimmer Pass: atmospheric bending along the rising horizon
      if (heatShimmer > 0.005) {
        float horizonBand = smoothstep(0.35, 0.52, vUv.y) * (1.0 - smoothstep(0.52, 0.72, vUv.y));
        float wave = sin(vUv.y * 65.0 + time * 9.0) * cos(vUv.x * 45.0 + time * 6.0);
        sampleUv.y += wave * 0.0035 * heatShimmer * horizonBand;
      }

      // Engine Heat Shimmer Pass (refractive distortion ripple behind active exhaust nozzles)
      if (engineHeat > 0.5) {
        float exhaustZone = smoothstep(0.24, 0.0, abs(vUv.x - 0.5)) * smoothstep(0.28, 0.44, vUv.y) * (1.0 - smoothstep(0.48, 0.65, vUv.y));
        float engineRipple = sin(vUv.y * 110.0 + time * 28.0) * cos(vUv.x * 90.0 + time * 20.0);
        sampleUv += vec2(engineRipple * 0.0045 * engineHeat * exhaustZone);
      }

      if (waterSpray > 0.005) {
        vec2 dropUv = vUv * vec2(16.0, 9.0) + dir * (speedRatio * 1.8 * waterSpray);
        vec2 id = floor(dropUv);
        vec2 f = fract(dropUv) - 0.5;
        float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
        if (h > 0.6) {
          float d = length(f);
          if (d < 0.38) {
            vec2 dropNorm = (f / 0.38) * (1.0 - d / 0.38);
            sampleUv += dropNorm * 0.035 * waterSpray;
          }
        }
      }

      // 1. Chromatic Aberration with radial falloff
      vec3 col;
      if (enableLook > 0.5) {
        float shift = chromaOffset * pow(dist, 1.4);
        float r = texture2D(tScene, sampleUv + dir * shift).r;
        float g = texture2D(tScene, sampleUv).g;
        float b = texture2D(tScene, sampleUv - dir * shift).b;
        col = vec3(r, g, b);
      } else {
        col = texture2D(tScene, sampleUv).rgb;
      }

      // 2. Ambient Occlusion Composite
      if (enableAO > 0.5) {
        float ao = texture2D(tAO, vUv).r;
        if (canyonAO > 0.5 && ao < 0.5) {
          ao = mix(ao, clamp(ao * 1.6 + 0.2, 0.0, 1.0), 0.55);
        }
        col *= ao;
      }

      // 3. Screen-Space Reflections
      if (enableSSR > 0.5) {
        vec3 ssr = texture2D(tSSR, vUv).rgb;
        col += ssr;
      }

      // 4. Bloom Composite & Atmospheric Light Shafts
      if (enableBloom > 0.5) {
        vec3 bloom = texture2D(tBloom, vUv).rgb;
        col += bloom * bloomStrength;
      }

      // Broad light shafts: emerge only from broad light sources, suppressing single-pixel glint artifacts
      if (enableShafts > 0.5) {
        vec2 sunScreen = vec2(0.62, 0.32);
        float shaftDist = length(vUv - sunScreen);
        float shaft = max(0.0, 1.0 - shaftDist * 0.95);
        float broadMask = smoothstep(0.55, 0.05, shaftDist);
        col += vec3(1.0, 0.95, 0.82) * (pow(shaft, 3.0) * broadMask * 0.20);
      }

      // 5. Look Pass: Tone Mapping & Film Optics
      if (enableLook > 0.5) {
        col *= exposure;
        col = ACESFilm(col);

        // Contrast
        col = ((col - 0.5) * contrast) + 0.5;

        // Saturation
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(luma), col, saturation);

        // Vignette
        float vig = smoothstep(0.85, 0.85 - vignetteFalloff, dist);
        col *= mix(1.0 - vignetteDarkness, 1.0, vig);

        // Film Grain (procedural high-frequency noise)
        float noise = fract(sin(dot(vUv + fract(time * 0.173), vec2(12.9898, 78.233))) * 43758.5453);
        col += (noise - 0.5) * grainStrength;
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

export class PostPipeline {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.look = new LookController(options);

    // Pass toggles (1..5)
    this.enabled = true; // Key 1: Master toggle
    this.enableAO = true; // Key 2: GTAO
    this.enableSSR = true; // Key 3: Deck SSR
    this.enableBloom = true; // Key 4: Bloom
    this.enableLook = true; // Key 5: Film Optics (Tone mapping, grain, chroma, vignette)
    this.enableShafts = true;
    this.canyonAO = true;
    this.engineHeat = true;
    this.waterSpray = 0.0;

    // GTAO material caching and occluders
    this.aoOccluders = new Set();
    this.gtaoNormalMaterials = new Map();
    this._hiddenAOObjects = [];

    this.fsTriangle = new FullScreenTriangle();

    this.width = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;
    this.height = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;

    this._setupTargets();
    this._setupMaterials();
    this._bindKeys();
  }

  _setupTargets() {
    const w = this.width;
    const h = this.height;

    // 1. Full-res Scene Target (RGBA16F + Depth Texture) with single MSAA resolve per frame
    this.sceneTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      samples: 4, // Single MSAA resolve per frame
      depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType)
    });
    this.sceneTarget.resolveDepth = false; // Avoid redundant depth copy pass

    // 2. Half-res AO Targets
    const aoW = Math.max(1, Math.floor(w / 2));
    const aoH = Math.max(1, Math.floor(h / 2));
    this.aoTarget = new THREE.WebGLRenderTarget(aoW, aoH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RedFormat,
      type: THREE.HalfFloatType
    });
    this.aoBlurTarget = new THREE.WebGLRenderTarget(aoW, aoH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RedFormat,
      type: THREE.HalfFloatType
    });

    // 3. Half-res SSR Target
    this.ssrTarget = new THREE.WebGLRenderTarget(aoW, aoH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });

    // 4. Bloom Targets (Quarter-res pyramid)
    const bW = Math.max(1, Math.floor(w / 4));
    const bH = Math.max(1, Math.floor(h / 4));
    this.bloomHighPassTarget = new THREE.WebGLRenderTarget(bW, bH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });
    this.bloomBlurH = new THREE.WebGLRenderTarget(bW, bH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });
    this.bloomBlurV = new THREE.WebGLRenderTarget(bW, bH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });
  }

  _setupMaterials() {
    this.matGTAO = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GTAOShader.uniforms),
      vertexShader: GTAOShader.vertexShader,
      fragmentShader: GTAOShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.matBilateral = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BilateralBlurShader.uniforms),
      vertexShader: BilateralBlurShader.vertexShader,
      fragmentShader: BilateralBlurShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.matSSR = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DeckSSRShader.uniforms),
      vertexShader: DeckSSRShader.vertexShader,
      fragmentShader: DeckSSRShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.matBloomHighPass = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BloomHighPassShader.uniforms),
      vertexShader: BloomHighPassShader.vertexShader,
      fragmentShader: BloomHighPassShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.matGaussianBlur = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GaussianBlurShader.uniforms),
      vertexShader: GaussianBlurShader.vertexShader,
      fragmentShader: GaussianBlurShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.matLookComposite = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(LookCompositeShader.uniforms),
      vertexShader: LookCompositeShader.vertexShader,
      fragmentShader: LookCompositeShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });
  }

  _bindKeys() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      // Toggle passes with keys 1..5
      if (e.key === '1') {
        this.enabled = !this.enabled;
        console.log(`[Post] Master Pipeline: ${this.enabled ? 'ON' : 'OFF'}`);
      } else if (e.key === '2') {
        this.enableAO = !this.enableAO;
        console.log(`[Post] GTAO: ${this.enableAO ? 'ON' : 'OFF'}`);
      } else if (e.key === '3') {
        this.enableSSR = !this.enableSSR;
        console.log(`[Post] Deck SSR: ${this.enableSSR ? 'ON' : 'OFF'}`);
      } else if (e.key === '4') {
        this.enableBloom = !this.enableBloom;
        console.log(`[Post] Bloom: ${this.enableBloom ? 'ON' : 'OFF'}`);
      } else if (e.key === '5') {
        this.enableLook = !this.enableLook;
        console.log(`[Post] Film Look: ${this.enableLook ? 'ON' : 'OFF'}`);
      }
    });
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;

    this.sceneTarget.setSize(width, height);
    const halfW = Math.max(1, Math.floor(width / 2));
    const halfH = Math.max(1, Math.floor(height / 2));
    this.aoTarget.setSize(halfW, halfH);
    this.aoBlurTarget.setSize(halfW, halfH);
    this.ssrTarget.setSize(halfW, halfH);

    const quadW = Math.max(1, Math.floor(width / 4));
    const quadH = Math.max(1, Math.floor(height / 4));
    this.bloomHighPassTarget.setSize(quadW, quadH);
    this.bloomBlurH.setSize(quadW, quadH);
    this.bloomBlurV.setSize(quadW, quadH);
  }

  getGTAONormalKey(obj) {
    const instanced = obj.isInstancedMesh ? 1 : 0;
    const instanceColor = (obj.isInstancedMesh && obj.instanceColor) ? 2 : 0;
    const skinned = obj.isSkinnedMesh ? 4 : 0;
    const morphPos = (obj.morphTargetInfluences && obj.geometry && obj.geometry.morphAttributes && obj.geometry.morphAttributes.position) ? 8 : 0;
    const morphNorm = (obj.morphTargetInfluences && obj.geometry && obj.geometry.morphAttributes && obj.geometry.morphAttributes.normal) ? 16 : 0;
    const isOccluder = (this.aoOccluders && this.aoOccluders.has(obj)) ? 32 : 0;
    return (instanced ? 1 : 0) | (instanceColor ? 2 : 0) | (skinned ? 4 : 0) | (morphPos ? 8 : 0) | (morphNorm ? 16 : 0) | (isOccluder ? 32 : 0);
  }

  getGTAONormalMaterial(obj) {
    const key = this.getGTAONormalKey(obj);
    if (!this.gtaoNormalMaterials.has(key)) {
      const mat = new THREE.MeshNormalMaterial();
      mat.depthTest = true;
      mat.depthWrite = true;
      this.gtaoNormalMaterials.set(key, mat);
    }
    return this.gtaoNormalMaterials.get(key);
  }

  overrideVisibility() {
    this._hiddenAOObjects = [];
    if (!this.scene) return;
    this.scene.traverse((obj) => {
      if (obj.isPoints || obj.isLine || obj.isLineSegments || (obj.userData && obj.userData.noAO)) {
        if (obj.visible) {
          obj.visible = false;
          this._hiddenAOObjects.push(obj);
        }
      }
    });
  }

  restoreVisibility() {
    if (!this._hiddenAOObjects) return;
    for (let i = 0; i < this._hiddenAOObjects.length; i++) {
      this._hiddenAOObjects[i].visible = true;
    }
    this._hiddenAOObjects = [];
  }

  render(dt, telemetry = {}) {
    // 1. Update Look Optics telemetry
    this.look.update(dt, telemetry);

    // If master toggle is disabled, render scene directly to screen
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 2. Render 3D Scene into full-res target
    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    const depthTex = this.sceneTarget.depthTexture;
    const invProj = this.camera.projectionMatrixInverse;
    const proj = this.camera.projectionMatrix;

    // 3. GTAO Pass (Half-Res)
    if (this.enableAO) {
      this.overrideVisibility();
      const uAO = this.matGTAO.uniforms;
      uAO.tDepth.value = depthTex;
      uAO.resolution.value.set(this.aoTarget.width, this.aoTarget.height);
      uAO.cameraNear.value = this.camera.near;
      uAO.cameraFar.value = this.camera.far;
      uAO.projMatrix.value.copy(proj);
      uAO.invProjMatrix.value.copy(invProj);
      uAO.radius.value = this.look.params.gtaoRadius;
      uAO.intensity.value = this.look.params.gtaoIntensity;
      uAO.exponent.value = this.look.params.gtaoExponent;
      this.fsTriangle.render(this.renderer, this.matGTAO, this.aoTarget);

      // Bilateral Blur Horizontal
      const uB = this.matBilateral.uniforms;
      uB.tAO.value = this.aoTarget.texture;
      uB.tDepth.value = depthTex;
      uB.direction.value.set(1.0, 0.0);
      uB.resolution.value.set(this.aoTarget.width, this.aoTarget.height);
      this.fsTriangle.render(this.renderer, this.matBilateral, this.aoBlurTarget);

      // Bilateral Blur Vertical
      uB.tAO.value = this.aoBlurTarget.texture;
      uB.direction.value.set(0.0, 1.0);
      this.fsTriangle.render(this.renderer, this.matBilateral, this.aoTarget);
      this.restoreVisibility();
    }

    // 4. Deck SSR Pass (Half-Res)
    if (this.enableSSR) {
      const uSSR = this.matSSR.uniforms;
      uSSR.tColor.value = this.sceneTarget.texture;
      uSSR.tDepth.value = depthTex;
      uSSR.resolution.value.set(this.ssrTarget.width, this.ssrTarget.height);
      uSSR.invProjMatrix.value.copy(invProj);
      uSSR.projMatrix.value.copy(proj);
      uSSR.maxDistance.value = this.look.params.ssrMaxDistance;
      uSSR.stepSize.value = this.look.params.ssrStepSize;
      uSSR.edgeFade.value = this.look.params.ssrEdgeFade;
      this.fsTriangle.render(this.renderer, this.matSSR, this.ssrTarget);
    }

    // 5. Bloom Pass (Quarter-Res)
    if (this.enableBloom) {
      const uHP = this.matBloomHighPass.uniforms;
      uHP.tColor.value = this.sceneTarget.texture;
      uHP.threshold.value = this.look.params.bloomThreshold;
      this.fsTriangle.render(this.renderer, this.matBloomHighPass, this.bloomHighPassTarget);

      // Horizontal blur
      const uG = this.matGaussianBlur.uniforms;
      uG.tDiffuse.value = this.bloomHighPassTarget.texture;
      uG.direction.value.set(1.0, 0.0);
      uG.resolution.value.set(this.bloomBlurH.width, this.bloomBlurH.height);
      this.fsTriangle.render(this.renderer, this.matGaussianBlur, this.bloomBlurH);

      // Vertical blur
      uG.tDiffuse.value = this.bloomBlurH.texture;
      uG.direction.value.set(0.0, 1.0);
      this.fsTriangle.render(this.renderer, this.matGaussianBlur, this.bloomBlurV);
    }

    // Water spray simulation: increases when passing through waterfall, drains under airflow
    if (telemetry.waterSpray || telemetry.inWaterfall) {
      this.waterSpray = Math.min(1.0, this.waterSpray + dt * 2.8);
    } else {
      this.waterSpray = Math.max(0.0, this.waterSpray - dt * 0.32);
    }

    // 6. Look & Composite Pass (Render to Screen)
    const uComp = this.matLookComposite.uniforms;
    uComp.tScene.value = this.sceneTarget.texture;
    uComp.tAO.value = this.aoTarget.texture;
    uComp.tSSR.value = this.ssrTarget.texture;
    uComp.tBloom.value = this.bloomBlurV.texture;
    uComp.time.value += dt;
    uComp.exposure.value = this.look.currentExposure;
    uComp.contrast.value = this.look.params.contrast;
    uComp.saturation.value = this.look.params.saturation;
    uComp.grainStrength.value = this.look.params.grainStrength;
    uComp.vignetteFalloff.value = this.look.params.vignetteFalloff;
    uComp.vignetteDarkness.value = this.look.params.vignetteDarkness;
    uComp.chromaOffset.value = this.look.currentChroma;
    uComp.bloomStrength.value = this.look.currentBloomStrength;
    uComp.waterSpray.value = this.waterSpray;
    uComp.speedRatio.value = Math.min(1.5, (telemetry.speed || 0) / 250.0);
    uComp.heatShimmer.value = (telemetry.heat || (telemetry.world && telemetry.world.heat)) ? 1.0 : 0.0;
    uComp.canyonAO.value = (this.canyonAO !== false && telemetry.canyonAO !== false) ? 1.0 : 0.0;
    uComp.engineHeat.value = (this.engineHeat !== false && telemetry.engineHeat !== false) ? 1.0 : 0.0;
    uComp.enableShafts.value = this.enableShafts ? 1.0 : 0.0;

    uComp.enableAO.value = this.enableAO ? 1.0 : 0.0;
    uComp.enableSSR.value = this.enableSSR ? 1.0 : 0.0;
    uComp.enableBloom.value = this.enableBloom ? 1.0 : 0.0;
    uComp.enableLook.value = this.enableLook ? 1.0 : 0.0;

    // Output to main screen canvas
    this.fsTriangle.render(this.renderer, this.matLookComposite, null);
  }

  async compileAsync(renderer) {
    if (!renderer || !renderer.compileAsync) return;
    const mats = [
      this.matGTAO,
      this.matBilateral,
      this.matSSR,
      this.matBloomHighPass,
      this.matGaussianBlur,
      this.matLookComposite
    ];
    await Promise.all(mats.map(m => {
      this.fsTriangle.mesh.material = m;
      return renderer.compileAsync(this.fsTriangle.scene, this.fsTriangle.camera);
    }));
  }

  async rebuildShaders(renderer = null) {
    const rend = renderer || this.renderer;
    this._setupMaterials();
    return this.compileAsync(rend);
  }

  dispose() {
    this.fsTriangle.dispose();
    this.sceneTarget.dispose();
    this.aoTarget.dispose();
    this.aoBlurTarget.dispose();
    this.ssrTarget.dispose();
    this.bloomHighPassTarget.dispose();
    this.bloomBlurH.dispose();
    this.bloomBlurV.dispose();
  }
}

export class LensWaterPass {
  constructor() {
    this.uniforms = {
      tDiffuse: { value: null },
      uSpeed: { value: 0.0 },
      uIntensity: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 dir = vUv - 0.5;
          float r = length(dir);
          vec2 normDir = r > 0.001 ? dir / r : vec2(0.0);
          vec2 dropUv = vUv * vec2(16.0, 9.0) + dir * (uSpeed * 0.005 * uIntensity);
          vec2 dropCell = fract(dropUv) - 0.5;
          float d = length(dropCell);
          vec2 uv = vUv;
          if (d < 0.28) {
            vec2 dropNorm = (dropCell / 0.28) * smoothstep(0.28, 0.05, d);
            uv += dropNorm * 0.035 * uIntensity;
          }
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!renderer) return;
    this.uniforms.tDiffuse.value = readBuffer ? readBuffer.texture : null;
    renderer.setRenderTarget(writeBuffer || null);
    renderer.render(this.fsQuad, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  }
}

export class ShaftPass {
  constructor() {
    this.uniforms = {
      tDiffuse: { value: null },
      uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
      uIntensity: { value: 1.0 },
      uDecay: { value: 0.95 },
      uDensity: { value: 0.84 },
      uWeight: { value: 0.58 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uSunPos;
        uniform float uIntensity;
        uniform float uDecay;
        uniform float uDensity;
        uniform float uWeight;
        varying vec2 vUv;
        void main() {
          vec2 delta = (vUv - uSunPos) * (1.0 / 16.0) * uDensity;
          vec2 coord = vUv;
          vec4 col = texture2D(tDiffuse, coord);
          float illum = 1.0;
          for (int i = 0; i < 16; i++) {
            coord -= delta;
            vec4 samp = texture2D(tDiffuse, coord);
            samp *= illum * uWeight;
            col += samp;
            illum *= uDecay;
          }
          gl_FragColor = col * uIntensity;
        }
      `
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!renderer) return;
    this.uniforms.tDiffuse.value = readBuffer ? readBuffer.texture : null;
    renderer.setRenderTarget(writeBuffer || null);
    renderer.render(this.fsQuad, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  }
}

