import * as THREE from 'three';

// Uniforms shared by every patched material, updated once per frame.
export const shared = {
  uTime: { value: 0 },
  uCaustic: { value: 1 },          // caustic strength (fades with depth)
  uGlyphGlow: { value: 0.55 },     // teal glyphs, brighter as shards return
  uCityLight: { value: 0.0 },      // warm city lights, only on at the ending
};

const CAUSTIC_GLSL = /* glsl */`
uniform float uTime;
uniform float uCaustic;
varying vec3 vWorldPosC;
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 1.7 + t * 0.9 + sin(p.y * 1.3 + t * 0.7) * 1.6);
  float b = sin(p.y * 1.9 - t * 0.8 + sin(p.x * 1.1 - t * 0.6) * 1.6);
  float c = sin((p.x + p.y) * 1.3 + t * 0.5 + sin(p.x * 0.7 - p.y * 0.9 + t) * 1.3);
  float v = (a + b + c) / 3.0;
  return pow(1.0 - abs(v), 7.0);
}
float caustics(vec3 wp) {
  vec2 p = wp.xz * 0.32;
  float t = uTime;
  float c = causticLayer(p, t) * 0.65 + causticLayer(p * 1.7 + 3.1, t * 1.3) * 0.5;
  return c * smoothstep(-95.0, -4.0, wp.y);
}
`;

// Adds moving caustic light to any Lambert/Phong material.
export function patchCaustics(material, { instanced = false, sway = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uCaustic = shared.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosC;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
${sway ? SWAY_VERTEX : ''}`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 wpC = vec4(transformed, 1.0);
          ${instanced ? '#ifdef USE_INSTANCING\n wpC = instanceMatrix * wpC;\n#endif' : ''}
          vWorldPosC = (modelMatrix * wpC).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CAUSTIC_GLSL)
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float upF = clamp(dot(normal, upV), 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * caustics(vWorldPosC) * uCaustic * (0.25 + upF) * vec3(0.55, 0.85, 0.95);
        }
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => `caustic-${instanced}-${sway}`;
  return material;
}

// Kelp / seagrass sway. Uses the instance position as a phase and bends with height.
const SWAY_VERTEX = /* glsl */`
  {
    vec3 ip = vec3(0.0);
    #ifdef USE_INSTANCING
      ip = instanceMatrix[3].xyz;
    #endif
    float ph = ip.x * 0.13 + ip.z * 0.17;
    float hgt = max(position.y, 0.0);
    float bend = hgt * 0.05 + hgt * hgt * 0.003;
    transformed.x += sin(uTime * 0.9 + ph + hgt * 0.15) * bend;
    transformed.z += cos(uTime * 0.7 + ph * 1.3 + hgt * 0.11) * bend * 0.7;
  }
`;

function glowPatch(material, uniformName) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms[uniformName] = shared[uniformName];
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float ${uniformName};`)
      .replace('#include <opaque_fragment>', `outgoingLight *= ${uniformName};\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `glow-${uniformName}`;
  return material;
}

let cache = null;

export function getMaterials() {
  if (cache) return cache;
  const terrain = patchCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const stone = patchCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const shiny = patchCaustics(new THREE.MeshPhongMaterial({
    vertexColors: true, flatShading: true, shininess: 70, specular: 0x8a7a40,
  }));
  const glow = glowPatch(new THREE.MeshBasicMaterial({ vertexColors: true }), 'uGlyphGlow');
  const cityLight = glowPatch(new THREE.MeshBasicMaterial({ vertexColors: true }), 'uCityLight');
  const emissive = new THREE.MeshBasicMaterial({ vertexColors: true }); // always-on glowing things (life, lava)
  const kelp = patchCaustics(
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    { instanced: true, sway: true }
  );
  const instanced = patchCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { instanced: true });
  const glass = new THREE.MeshPhongMaterial({
    color: 0xbfefff, transparent: true, opacity: 0.25, shininess: 90, side: THREE.DoubleSide, depthWrite: false,
  });
  const airPocket = new THREE.MeshPhongMaterial({
    color: 0xdffaff, emissive: 0x335566, shininess: 120, specular: 0xffffff,
    transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
  });
  cache = { terrain, stone, shiny, glow, cityLight, emissive, kelp, instanced, glass, airPocket };
  return cache;
}

// ---- Glyphs: eight original symbols drawn with canvas strokes ----
export const GLYPHS = ['sun', 'moon', 'wave', 'eye', 'flame', 'trident', 'star', 'spiral'];
export const GLYPH_LABEL = {
  sun: 'Sun', moon: 'Moon', wave: 'Wave', eye: 'Eye', flame: 'Flame', trident: 'Trident', star: 'Star', spiral: 'Spiral',
};

export function drawGlyph(ctx, glyph, cx, cy, s, color = '#6ff7e8', lw = 0.09) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  switch (glyph) {
    case 'sun':
      ctx.arc(0, 0, 0.22, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * 0.32, Math.sin(a) * 0.32);
        ctx.lineTo(Math.cos(a) * 0.44, Math.sin(a) * 0.44);
      }
      break;
    case 'moon':
      ctx.arc(0, 0, 0.36, Math.PI * 0.35, Math.PI * 1.65);
      ctx.arc(0.16, 0, 0.27, Math.PI * 1.45, Math.PI * 0.55, true);
      ctx.closePath();
      break;
    case 'wave':
      for (let row = -1; row <= 1; row++) {
        const y = row * 0.2;
        ctx.moveTo(-0.42, y);
        for (let x = -0.42; x <= 0.42; x += 0.04) ctx.lineTo(x, y + Math.sin(x * 11) * 0.07);
      }
      break;
    case 'eye':
      ctx.moveTo(-0.44, 0);
      ctx.quadraticCurveTo(0, -0.42, 0.44, 0);
      ctx.quadraticCurveTo(0, 0.42, -0.44, 0);
      ctx.moveTo(0.13, 0);
      ctx.arc(0, 0, 0.13, 0, Math.PI * 2);
      break;
    case 'flame':
      ctx.moveTo(0, -0.44);
      ctx.bezierCurveTo(0.3, -0.15, 0.32, 0.18, 0, 0.4);
      ctx.bezierCurveTo(-0.32, 0.18, -0.3, -0.15, 0, -0.44);
      ctx.moveTo(0, -0.08);
      ctx.bezierCurveTo(0.12, 0.05, 0.1, 0.2, 0, 0.26);
      ctx.bezierCurveTo(-0.1, 0.2, -0.12, 0.05, 0, -0.08);
      break;
    case 'trident':
      ctx.moveTo(0, 0.45); ctx.lineTo(0, -0.42);
      ctx.moveTo(-0.28, -0.3); ctx.lineTo(-0.28, -0.05); ctx.quadraticCurveTo(-0.28, 0.1, 0, 0.1);
      ctx.quadraticCurveTo(0.28, 0.1, 0.28, -0.05); ctx.lineTo(0.28, -0.3);
      ctx.moveTo(-0.08, -0.32); ctx.lineTo(0, -0.44); ctx.lineTo(0.08, -0.32);
      break;
    case 'star':
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.44 : 0.18;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'spiral':
      for (let i = 0; i <= 80; i++) {
        const a = i * 0.16;
        const r = 0.02 + i * 0.0053;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    default:
      ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

const glyphTexCache = new Map();
// Glyph on a stone tile. bg null = transparent.
export function glyphTexture(glyph, { bg = '#2b3b45', color = '#6ff7e8', size = 128 } = {}) {
  const key = `${glyph}|${bg}|${color}|${size}`;
  if (glyphTexCache.has(key)) return glyphTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = size * 0.04;
    ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
  }
  if (glyph) drawGlyph(ctx, glyph, size / 2, size / 2, size * 0.8, color);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glyphTexCache.set(key, tex);
  return tex;
}

// Material showing a glyph that brightens with the global glyph glow.
const glyphMatCache = new Map();
export function glyphMaterial(glyph, opts = {}) {
  const key = `${glyph}|${JSON.stringify(opts)}`;
  if (glyphMatCache.has(key)) return glyphMatCache.get(key);
  const m = new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, opts), transparent: !opts.bg && opts.bg !== undefined });
  glyphMatCache.set(key, m);
  return m;
}
