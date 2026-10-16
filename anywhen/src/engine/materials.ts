// Shared low-poly materials, global shader uniforms, and the instanced character shader.
import * as THREE from 'three';

export const GLOBAL = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uWind: { value: 0.3 },
  uPlayer: { value: new THREE.Vector3() },
  uNearRadius: { value: 600 },
};

const glowVertex = (s: string) =>
  s.replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
const glowFragment = (s: string) =>
  s.replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uNight;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.25 + uNight * 1.35);');

/** Flat-shaded vertex-coloured material with optional night glow (aGlow attribute). */
export function lowPoly(opts: { side?: THREE.Side; glow?: boolean; wind?: boolean; transparent?: boolean; opacity?: number } = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  if (opts.glow || opts.wind) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = GLOBAL.uNight;
      sh.uniforms.uTime = GLOBAL.uTime;
      sh.uniforms.uWind = GLOBAL.uWind;
      if (opts.glow) {
        sh.vertexShader = glowVertex(sh.vertexShader);
        sh.fragmentShader = glowFragment(sh.fragmentShader);
      }
      if (opts.wind) {
        // sway tops of plants: displacement grows with height above the instance origin
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 iw = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          #else
            vec3 iw = vec3(0.0);
          #endif
          float sway = max(0.0, transformed.y) * 0.04 * uWind;
          transformed.x += sin(uTime * 1.7 + iw.x * 0.21 + iw.z * 0.13) * sway;
          transformed.z += cos(uTime * 1.3 + iw.z * 0.17) * sway * 0.6;`);
      }
    };
    m.customProgramCacheKey = () => `lp${opts.glow ? 'g' : ''}${opts.wind ? 'w' : ''}`;
  }
  return m;
}

export const MATS = {
  terrain: lowPoly(),
  building: lowPoly({ side: THREE.DoubleSide, glow: true }),
  flora: lowPoly({ side: THREE.DoubleSide, wind: true }),
  floraStatic: lowPoly({ side: THREE.DoubleSide }),
  prop: lowPoly({ side: THREE.DoubleSide, glow: true }),
};

// ---------------------------------------------------------------------------
// Instanced characters (people and animals). Geometry carries aPart (body part id) and aSlot
// (colour slot). Instances carry aAnim (phase, amount, mode, extra) and five colours.
// Limb animation happens in the vertex shader so hundreds of characters cost a few draw calls.

const ANIM_GLSL = `
attribute float aPart;
attribute float aSlot;
attribute vec4 aAnim;
attribute vec3 aC0;
attribute vec3 aC1;
attribute vec3 aC2;
attribute vec3 aC3;
attribute vec3 aC4;
uniform vec3 uPiv[10];
uniform float uKind;
uniform float uTime;
varying float vCGlow;
mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
vec3 rotAbout(vec3 p, vec3 piv, mat3 m){ return piv + m * (p - piv); }
vec3 animHuman(vec3 p){
  float ph = aAnim.x, amt = aAnim.y, mode = aAnim.z, ex = aAnim.w;
  float sw = sin(ph) * amt;
  float bob = abs(cos(ph)) * 0.05 * amt;
  int part = int(aPart + 0.5);
  if (mode > 3.5 && mode < 4.5) return vec3(0.0); // hidden indoors
  // limbs
  if (part == 4 || part == 5) {
    float s = part == 4 ? 1.0 : -1.0;
    float a = sw * 0.75 * s;
    if (mode > 1.5 && mode < 2.5) a = -1.45;                    // sit
    if (mode > 4.5 && mode < 5.5) a = sin(ph * 1.3) * 0.5 * s;  // swim kick
    if (mode > 5.5 && mode < 6.5) a = -0.6 + sin(ph) * 0.5 * s; // climb
    if (mode > 6.5 && mode < 7.5) a = -1.3;                     // ride
    if (mode > 7.5 && mode < 8.5) a = -0.4 * s;                 // jump
    if (mode > 9.5 && mode < 10.5) a = -0.9 + sw * 0.3 * s;     // crouch
    if (mode > 10.5 && mode < 11.5) a = 0.15 * s;               // glide
    p = rotAbout(p, uPiv[part], rX(a));
  } else if (part == 2 || part == 3) {
    float s = part == 2 ? 1.0 : -1.0;
    float a = -sw * 0.6 * s;
    float z = 0.0;
    if (mode > 0.5 && mode < 1.5) a = part == 3 ? -1.2 + sin(ph * 2.0) * 0.7 : -0.5;        // work
    if (mode > 2.5 && mode < 3.5) a = part == 3 ? -0.9 + sin(uTime * 3.0 + ex) * 0.35 : 0.1; // talk
    if (mode > 4.5 && mode < 5.5) { a = -2.6 + sin(ph * 1.3 + s) * 1.2; }                    // swim strokes
    if (mode > 5.5 && mode < 6.5) a = -2.7 + sin(ph) * 0.4 * s;                            // climb
    if (mode > 6.5 && mode < 7.5) a = -0.8;                                                // ride
    if (mode > 7.5 && mode < 8.5) { a = -2.6; z = 0.3 * s; }                               // jump arms up
    if (mode > 10.5 && mode < 11.5) { a = 0.0; z = 1.3 * s; }                              // glide arms out
    if (mode > 11.5) { a = part == 3 ? -2.8 + sin(uTime * 8.0) * 0.3 : 0.0; }             // wave
    p = rotAbout(p, uPiv[part], rZ(z) * rX(a));
  } else if (part == 6) {
    p = rotAbout(p, uPiv[6], rX(sw * 0.12));
  } else if (part == 1 || part == 7) {
    float nod = (mode > 2.5 && mode < 3.5) ? sin(uTime * 2.3 + ex) * 0.08 : 0.0;
    p = rotAbout(p, uPiv[1], rY(sin(uTime * 0.4 + ex) * 0.15) * rX(nod));
  }
  // whole body
  p.y += bob;
  if (mode > 1.5 && mode < 2.5) p.y -= 0.42;                       // sit
  if (mode > 9.5 && mode < 10.5) { p.y -= 0.35; p = rotAbout(p, vec3(0.0, 0.9, 0.0), rX(0.35)); } // crouch
  if (mode > 4.5 && mode < 5.5) { p = rotAbout(p, vec3(0.0, 1.0, 0.0), rX(1.35)); p.y -= 0.9; }   // swim: horizontal
  if (mode > 10.5 && mode < 11.5) p = rotAbout(p, vec3(0.0, 1.0, 0.0), rX(0.5));                 // glide lean
  if (mode > 8.5 && mode < 9.5) { p = rotAbout(p, vec3(0.0, 0.0, 0.0), rX(-1.5)); p.y += 0.15; } // knocked down
  if (mode > 6.5 && mode < 7.5) p.y -= 0.35;                       // ride (sitting)
  return p;
}
vec3 animAnimal(vec3 p){
  float ph = aAnim.x, amt = aAnim.y, mode = aAnim.z, ex = aAnim.w;
  int part = int(aPart + 0.5);
  float sw = sin(ph) * amt;
  // kinds: 0 quadruped, 1 biped (theropod), 2 bird, 3 fish, 4 hopper, 5 drone
  if (uKind < 0.5 || uKind > 3.5 && uKind < 4.5) {
    if (part >= 2 && part <= 5) {
      float phase = (part == 2 || part == 5) ? 1.0 : -1.0;
      float a = sw * 0.55 * phase;
      if (uKind > 3.5) { a = (part >= 4) ? -abs(sw) * 0.9 : sw * 0.3; }
      if (mode > 0.5 && mode < 1.5) a = 0.0; // resting
      p = rotAbout(p, uPiv[part], rX(a));
    }
    if (part == 1) {
      float graze = (mode > 1.5 && mode < 2.5) ? 0.7 + sin(uTime * 2.0 + ex) * 0.1 : sin(ph * 0.5) * 0.05 * amt;
      p = rotAbout(p, uPiv[1], rX(graze));
    }
    if (part == 6) p = rotAbout(p, uPiv[6], rY(sin(uTime * 2.0 + ex) * 0.3));
    if (uKind > 3.5) p.y += abs(sin(ph)) * 0.5 * amt;
    else p.y += abs(cos(ph)) * 0.04 * amt;
  } else if (uKind < 1.5) {
    if (part == 2 || part == 3) {
      float s = part == 2 ? 1.0 : -1.0;
      p = rotAbout(p, uPiv[part], rX(sw * 0.7 * s));
    }
    if (part == 1) p = rotAbout(p, uPiv[1], rX(sin(ph * 2.0) * 0.06 * amt + ((mode > 1.5 && mode < 2.5) ? 0.6 : 0.0)));
    if (part == 6) p = rotAbout(p, uPiv[6], rY(sin(ph) * 0.15 * amt + sin(uTime + ex) * 0.08));
    p.y += abs(cos(ph)) * 0.06 * amt;
  } else if (uKind < 2.5) {
    if (part == 7 || part == 8) {
      float s = part == 7 ? 1.0 : -1.0;
      float flap = (mode > 0.5 && mode < 1.5) ? 0.1 : sin(uTime * (mode > 2.5 ? 4.0 : 12.0) + ex) * 0.9;
      p = rotAbout(p, uPiv[part], rZ(flap * s));
    }
    if (part == 2 || part == 3) p = rotAbout(p, uPiv[part], rX(sw * 0.5));
  } else if (uKind < 3.5) {
    float wv = sin(p.z * 1.5 - uTime * 4.0 * max(0.3, amt) + ex) * 0.12 * (0.5 + p.z * 0.2);
    p.x += wv * max(0.0, -p.z + 0.5);
  }
  if (uKind > 4.5) {
    if (part == 7) p = rotAbout(p, uPiv[7], rY(uTime * 30.0));
    p.y += sin(uTime * 2.0 + ex) * 0.1;
  }
  if (mode > 3.5 && mode < 4.5) { p = rotAbout(p, vec3(0.0), rZ(1.4)); } // lying down (sleep)
  return p;
}
`;

export interface CharMaterialSet { mat: THREE.MeshLambertMaterial; depth: THREE.MeshDepthMaterial; uniforms: { uPiv: { value: THREE.Vector3[] }; uKind: { value: number } } }

export function characterMaterial(kind: 'human' | number, pivots: THREE.Vector3[]): CharMaterialSet {
  const uniforms = { uPiv: { value: padPivots(pivots) }, uKind: { value: kind === 'human' ? 0 : kind } };
  const fn = kind === 'human' ? 'animHuman' : 'animAnimal';
  const inject = (sh: THREE.WebGLProgramParametersWithUniforms, depth: boolean) => {
    sh.uniforms.uPiv = uniforms.uPiv;
    sh.uniforms.uKind = uniforms.uKind;
    sh.uniforms.uTime = GLOBAL.uTime;
    sh.uniforms.uNight = GLOBAL.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + ANIM_GLSL)
      .replace('#include <begin_vertex>', `vec3 transformed = ${fn}(vec3(position));`);
    if (!depth) {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
        #ifdef USE_COLOR
          int sl = int(aSlot + 0.5);
          vColor = sl == 0 ? aC0 : sl == 1 ? aC1 : sl == 2 ? aC2 : sl == 3 ? aC3 : sl == 4 ? aC4 : color.rgb;
        #endif
        vCGlow = aSlot > 5.5 ? 1.0 : 0.0;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCGlow;\nuniform float uNight;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vCGlow * (0.6 + uNight);');
    }
  };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => inject(sh, false);
  mat.customProgramCacheKey = () => 'char-' + fn;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => inject(sh, true);
  depth.customProgramCacheKey = () => 'chardepth-' + fn;
  return { mat, depth, uniforms };
}

function padPivots(p: THREE.Vector3[]): THREE.Vector3[] {
  const out = p.slice(0, 10);
  while (out.length < 10) out.push(new THREE.Vector3());
  return out;
}
