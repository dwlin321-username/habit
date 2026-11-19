// 3D 舞台：把低多邊形動物畫在畫面上（three.js）
// three.js 是在網頁上用手機顯示晶片（WebGL）畫 3D 的工具庫。
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/environments/RoomEnvironment.js';
import { buildLowPoly } from './lowpoly.js';

// 動物是用程式即時組出來的，不用下載，所以「準備」一定成功
export function prepare() { return Promise.resolve(true); }

export async function buildAnimal(entryId, opts) {
  return buildLowPoly(entryId, opts);
}

/* ---------- 共用場景設定 ---------- */
function setupScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6e8, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2, 4, 3);
  scene.add(key);
  return scene;
}
function makeRenderer(alpha = true, preserve = false) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: preserve });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  return r;
}
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

/* ---------- 可放在畫面上的 3D 舞台 ---------- */
export class Stage {
  constructor(container, { interactive = false } = {}) {
    this.container = container;
    this.interactive = interactive;
    this.renderer = makeRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';
    container.appendChild(this.canvas);
    this.scene = setupScene(this.renderer);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.9, 6.2);
    this.camera.lookAt(0, 1.0, 0);
    this.clock = new THREE.Clock();
    this.t = 0;
    this.animal = null;
    this.running = false;
    this.userRot = 0;
    this.token = 0;
    this._loop = this._loop.bind(this);
    this._resize();
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(container);
    if (interactive) this._bindDrag();
    this.canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); this.stop(); });
  }
  _resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.running) this._render();
  }
  _bindDrag() {
    let x0 = null, r0 = 0;
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', (e) => { x0 = e.clientX; r0 = this.userRot; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (x0 !== null) this.userRot = r0 + (e.clientX - x0) * 0.012; });
    const up = () => { x0 = null; };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }
  mount(container) {
    if (this.container === container) return;
    this.ro.unobserve(this.container);
    this.container = container;
    container.appendChild(this.canvas);
    this.ro.observe(container);
    this._resize();
  }
  async show(entryId, { mode = 'idle' } = {}) {
    const my = ++this.token;
    const a = await buildAnimal(entryId);
    if (my !== this.token) { a.dispose(); return; }
    if (this.animal) { this.scene.remove(this.animal.pivot); this.animal.dispose(); }
    this.animal = a;
    this.scene.add(a.pivot);
    this.userRot = this.interactive ? -0.5 : 0;
    this.t = 0;
    if (mode === 'celebrate') a.playHappy();
    this.start();
  }
  clear() {
    this.token++;
    if (this.animal) { this.scene.remove(this.animal.pivot); this.animal.dispose(); this.animal = null; }
    this._render();
  }
  playHappy() { if (this.animal) this.animal.playHappy(); }
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; }
  _loop() {
    if (!this.running) return;
    if (!document.hidden) {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.t += dt;
      const a = this.animal;
      if (a) {
        a.update(dt, this.t);
        const sway = this.interactive ? Math.sin(this.t * 0.5) * 0.15 : Math.sin(this.t * 0.7) * 0.4;
        a.pivot.rotation.y = this.userRot + sway;
      }
      this._render();
    } else {
      this.clock.getDelta();
    }
    requestAnimationFrame(this._loop);
  }
  _render() { this.renderer.render(this.scene, this.camera); }
  dispose() {
    this.stop(); this.clear();
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/* ---------- 圖鑑縮圖（第一次產生後存起來，下次直接用） ---------- */
const THUMB_CACHE = 'ypym-thumbs-v2';
const thumbMem = new Map();
let thumbR = null, thumbScene = null, thumbCam = null, queue = Promise.resolve();
function thumbRenderer() {
  if (thumbR) return thumbR;
  thumbR = makeRenderer(true, true);
  thumbR.setPixelRatio(1);
  thumbR.setSize(256, 256, false);
  thumbScene = setupScene(thumbR);
  thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  thumbCam.position.set(1.7, 1.65, 4.3);
  thumbCam.lookAt(0, 1.02, 0);
  return thumbR;
}
async function renderThumb(entryId) {
  const r = thumbRenderer();
  const a = await buildAnimal(entryId, { particles: false });
  a.update(0.016, 0.3);
  a.pivot.rotation.y = -0.3;
  thumbScene.add(a.pivot);
  r.render(thumbScene, thumbCam);
  const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png'));
  thumbScene.remove(a.pivot);
  a.dispose();
  return blob;
}
export function getThumb(entryId) {
  if (thumbMem.has(entryId)) return thumbMem.get(entryId);
  const p = (queue = queue.then(async () => {
    const key = `thumb/${entryId}.png`;
    let cache = null;
    try { cache = await caches.open(THUMB_CACHE); } catch { /* 無痕模式等情況 */ }
    if (cache) {
      const hit = await cache.match(key);
      if (hit) return URL.createObjectURL(await hit.blob());
    }
    const blob = await renderThumb(entryId);
    if (cache) { try { await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'image/png' } })); } catch { /* 空間不足 */ } }
    return URL.createObjectURL(blob);
  }).catch((e) => { thumbMem.delete(entryId); console.warn('縮圖失敗', entryId, e); return null; }));
  thumbMem.set(entryId, p);
  return p;
}
