// WebGL renderer + post pass (era colour grading, vignette, time-travel swirl, fades).
import * as THREE from 'three';

export interface Quality { pixelRatio: number; shadows: boolean; shadowMap: number; shadowExtent: number; flora: number }
export const QUALITY: Record<string, Quality> = {
  low: { pixelRatio: 0.75, shadows: false, shadowMap: 1024, shadowExtent: 60, flora: 0.5 },
  medium: { pixelRatio: 1, shadows: true, shadowMap: 1536, shadowExtent: 80, flora: 0.8 },
  high: { pixelRatio: 1.5, shadows: true, shadowMap: 2048, shadowExtent: 110, flora: 1 },
};

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.3, 9000);
  private rt: THREE.WebGLRenderTarget;
  private post: THREE.ShaderMaterial;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quality: Quality = QUALITY.medium;
  readonly uniforms = {
    tDiffuse: { value: null as THREE.Texture | null },
    uTint: { value: new THREE.Color('#ffffff') },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0.35 },
    uSwirl: { value: 0 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color('#ffffff') },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uAspect: { value: 1 },
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.post = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uVignette;
        uniform float uSwirl; uniform float uFade; uniform vec3 uFadeColor; uniform float uTime; uniform float uFlash; uniform float uAspect; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          if (uSwirl > 0.001) {
            vec2 c = uv - 0.5; c.x *= uAspect; float r = length(c);
            float a = uSwirl * 9.0 * (1.0 - smoothstep(0.0, 0.9, r)) + uSwirl * uTime * 2.0 * (1.0 - r);
            float s = sin(a), co = cos(a); c = mat2(co, -s, s, co) * c * (1.0 - uSwirl * 0.35 * (1.0 - r)); c.x /= uAspect; uv = c + 0.5;
          }
          vec3 col = texture2D(tDiffuse, uv).rgb;
          col *= uTint;
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, uSat);
          col = (col - 0.5) * uContrast + 0.5;
          if (uSwirl > 0.001) col += vec3(0.25, 0.55, 0.9) * uSwirl * 0.6 * (0.5 + 0.5 * sin(length(uv - 0.5) * 40.0 - uTime * 8.0));
          vec2 v = vUv - 0.5; col *= 1.0 - uVignette * dot(v, v) * 1.6;
          col = mix(col, uFadeColor, uFade);
          col += uFlash;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.post.toneMapped = true;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.gl.shadowMap.enabled = q.shadows;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.quality.pixelRatio;
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.uniforms.uAspect.value = w / h;
  }

  stats = { calls: 0, triangles: 0 };
  render() {
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.setRenderTarget(this.rt);
    this.gl.render(this.scene, this.camera);
    this.stats.calls = this.gl.info.render.calls;
    this.stats.triangles = this.gl.info.render.triangles;
    this.gl.setRenderTarget(null);
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.uniforms.tDiffuse.value = this.rt.texture;
    this.gl.render(this.postScene, this.postCam);
  }

  /** Small JPEG of the current frame (call right after render). */
  snapshot(w = 320): string {
    const src = this.gl.domElement;
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round((w * src.height) / src.width);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }
}
