// 3D 動物顯示（three.js）
// three.js 是在網頁上用手機顯示晶片（WebGL）畫 3D 的工具庫。
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { clone as skeletonClone } from '../vendor/three/utils/SkeletonUtils.js';
import { RoomEnvironment } from '../vendor/three/environments/RoomEnvironment.js';
import { CATALOG_BY_ID, RARITY } from './data.js';

const loader = new GLTFLoader();
const gltfCache = new Map();
function loadSpecies(sp) {
  if (!gltfCache.has(sp)) {
    const p = loader.loadAsync(`models/${sp}.glb`).catch((e) => { gltfCache.delete(sp); throw e; });
    gltfCache.set(sp, p);
  }
  return gltfCache.get(sp);
}
export function preloadSpecies(list) { list.forEach((sp) => loadSpecies(sp).catch(() => {})); }
export function prepare(entryId) {
  const e = CATALOG_BY_ID[entryId];
  return e ? loadSpecies(e.sp).then(() => true, () => false) : Promise.resolve(false);
}

const findClip = (clips, names) => {
  for (const n of names) { const c = clips.find((x) => x.name === n); if (c) return c; }
  return clips[0] || null;
};

/* ---------- 小貼圖（粒子、光暈） ---------- */
const texCache = {};
function canvasTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'star') {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 9 : 30, a = (i * Math.PI) / 4 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  } else if (kind === 'stripes') {
    c.width = 128; c.height = 32;
    const cols = ['#ff8fb8', '#fff3a8', '#8fd8ff', '#b9f2c9'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 16, 0, 16, 32); }
  } else {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (kind === 'stripes') { t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); }
  texCache[kind] = t;
  return t;
}

/* ---------- 配件（用基本形狀組成） ---------- */
function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...extra });
}
function makeAccessory(kind) {
  const g = new THREE.Group();
  if (kind === 'crown') {
    const gold = std('#ffcc33', { metalness: 0.8, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.16, 20, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), gold);
      spike.position.set(Math.cos(a) * 0.32, 0.17, Math.sin(a) * 0.32);
      g.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(['#ff6fa8', '#6fd0ff', '#9dff8f', '#c08fff', '#ff9f5a'][i], { emissiveIntensity: 0.4 }));
      gem.material.emissive = gem.material.color.clone();
      gem.position.set(Math.cos(a) * 0.33, 0.29, Math.sin(a) * 0.33);
      g.add(gem);
    }
  } else if (kind === 'party') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 24), std('#ffffff', { map: canvasTex('stripes') }));
    cone.position.y = 0.3; cone.rotation.z = -0.18;
    g.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), std('#fff6a8'));
    pom.position.set(0.055, 0.62, 0); g.add(pom);
  } else if (kind === 'bow') {
    const m = std('#ff7fb2');
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 16), m);
      wing.rotation.z = (s * Math.PI) / 2; wing.position.x = s * 0.15;
      g.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), m);
    g.add(knot);
    g.position.x = 0.25; g.rotation.z = -0.3;
  } else if (kind === 'flower') {
    const petal = std('#ffb3d1');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), petal);
      p.scale.set(1, 0.5, 1); p.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13);
      g.add(p);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), std('#ffe066'));
    c.position.y = 0.03; g.add(c);
    g.position.x = 0.22; g.rotation.z = -0.35;
  } else if (kind === 'halo') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 32),
      std('#fff2a0', { emissive: '#ffd84a', emissiveIntensity: 0.9, metalness: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.22;
    g.add(ring);
  }
  return g;
}

/* ---------- 特效（粒子） ---------- */
const FX_COLORS = {
  sparkle: ['#ffffff', '#ffe27a', '#ffb3d9'],
  gold: ['#ffe27a', '#ffcc33', '#fff6c8'],
  rainbow: ['#ff8fb8', '#ffe27a', '#8fd8ff', '#b9f2c9', '#c9a8ff'],
  galaxy: ['#ffffff', '#b9a8ff', '#7fc9ff'],
  diamond: ['#ffffff', '#bff0ff', '#e3d6ff'],
  aurora: ['#9ff0cf', '#a6dbff', '#e3b8ff'],
  sakura: ['#ffc2dc', '#ff9fc6', '#ffffff'],
};
function makeParticles(fx, count = 36) {
  const cols = FX_COLORS[fx] || FX_COLORS.sparkle;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.7;
    seed.push({ a, r, y: Math.random() * 2.4, s: 0.15 + Math.random() * 0.35 });
    pos.set([Math.cos(a) * r, 0, Math.sin(a) * r], i * 3);
    c.set(cols[i % cols.length]); col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: fx === 'sparkle' ? 0.13 : 0.17, map: canvasTex(fx === 'sakura' ? 'glow' : 'star'),
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      const s = seed[i];
      const y = (s.y + t * s.s) % 2.4;
      const a = s.a + t * 0.3;
      pos[i * 3] = Math.cos(a) * s.r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * s.r;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
function makeGlow(color) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex('glow'), color, transparent: true, depthWrite: false, opacity: 0.6,
  }));
  sp.scale.set(3.6, 3.6, 1); sp.position.set(0, 1, -0.6);
  return sp;
}

/* ---------- 外觀（顏色、材質） ---------- */
// 把原本貼圖轉成「亮度」再染色：五官（深色）保留，身體變成指定顏色
const recolorCache = new Map();
function recolor(map, key, gain = 1.7, lift = 0.18) {
  if (!map || !map.image) return map;
  const ck = map.uuid + key;
  if (recolorCache.has(ck)) return recolorCache.get(ck);
  const img = map.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
    const v = Math.min(1, l < 0.12 ? l : l * gain + lift) * 255; // 很暗的地方（眼睛）維持深色
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  const tex = map.clone();
  tex.image = c;
  tex.needsUpdate = true;
  recolorCache.set(ck, tex);
  return tex;
}
function applyLook(m, e) {
  m.envMapIntensity = 0.6;
  m.roughness = 0.75; m.metalness = 0;
  // 原始貼圖偏暗：用貼圖本身當自發光，讓顏色更明亮可愛
  if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.32; }
  if (e.tint) {
    m.color.set(e.tint);
    m.emissive = new THREE.Color(e.tint); m.emissiveIntensity = 0.4;
  }
  switch (e.fx) {
    case 'gold':
      m.map = m.emissiveMap = recolor(m.map, 'g');
      m.color.set('#ffd34d'); m.metalness = 0.55; m.roughness = 0.3;
      m.emissive = new THREE.Color('#ffb300'); m.emissiveIntensity = 0.18; m.envMapIntensity = 1.3; break;
    case 'galaxy':
      m.color.set('#a596ff'); m.emissive = new THREE.Color('#3b1d9a'); m.emissiveIntensity = 0.6; break;
    case 'diamond':
      m.color.set('#e2f7ff'); m.metalness = 0.3; m.roughness = 0.08;
      m.emissive = new THREE.Color('#9be3ff'); m.emissiveIntensity = 0.25; m.envMapIntensity = 1.4; break;
    case 'sakura':
      m.map = m.emissiveMap = recolor(m.map, 'g');
      m.color.set('#ffb8d8'); m.emissive = new THREE.Color('#ff8fbf'); m.emissiveIntensity = 0.35; break;
    case 'rainbow': case 'aurora':
      m.map = m.emissiveMap = recolor(m.map, 'g');
      m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.2; break;
    default: break;
  }
}

/* ---------- 組出一隻動物 ---------- */
export async function buildAnimal(entryId, { particles = true } = {}) {
  const e = CATALOG_BY_ID[entryId];
  if (!e) throw new Error('unknown animal ' + entryId);
  const gltf = await loadSpecies(e.sp);
  const model = skeletonClone(gltf.scene);
  const mats = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      const m = o.material.clone();
      applyLook(m, e);
      o.material = m; mats.push(m);
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const idleClip = findClip(gltf.animations, ['Idle', 'Flying']);
  const happyClip = findClip(gltf.animations, ['Dance', 'Jump', 'Yes', 'Flying', 'Idle']);
  let current = null;
  if (idleClip) { current = mixer.clipAction(idleClip); current.play(); mixer.update(0); }

  // 縮放到高度約 2，置中、站在地上
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(2 / Math.max(size.x, size.y, size.z));
  pivot.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const ctr = box.getCenter(new THREE.Vector3());
  model.position.x -= ctr.x; model.position.z -= ctr.z; model.position.y -= box.min.y;
  pivot.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);

  const extras = [];
  let acc = null, head = null, accOffset = 0;
  if (e.acc) {
    acc = makeAccessory(e.acc);
    head = model.getObjectByName('Head');
    const hp = new THREE.Vector3();
    if (head) head.getWorldPosition(hp); else hp.set(0, box.max.y, 0);
    accOffset = box.max.y - hp.y - 0.06;
    acc.position.set(hp.x + acc.position.x, box.max.y - 0.06, hp.z);
    acc.userData.baseX = acc.position.x - hp.x;
    pivot.add(acc);
  }
  if (particles && e.fx) {
    const pts = makeParticles(e.fx, e.rarity === 'legend' ? 48 : 28);
    pivot.add(pts); extras.push(pts);
  }
  let glow = null;
  if (e.rarity === 'legend' || e.rarity === 'epic') {
    glow = makeGlow(RARITY[e.rarity].color);
    if (e.rarity === 'epic') glow.material.opacity = 0.45;
    pivot.add(glow);
  }

  const tmp = new THREE.Vector3();
  const update = (dt, t) => {
    mixer.update(dt);
    if (acc && head) {
      head.getWorldPosition(tmp); pivot.worldToLocal(tmp);
      acc.position.set(tmp.x + acc.userData.baseX, tmp.y + accOffset, tmp.z);
    }
    if (e.fx === 'rainbow') mats.forEach((m) => m.color.setHSL((t * 0.12) % 1, 0.75, 0.72));
    if (e.fx === 'aurora') mats.forEach((m) => m.color.setHSL(0.45 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.8)), 0.7, 0.75));
    for (const x of extras) x.userData.update && x.userData.update(t);
    if (glow) glow.material.rotation = t * 0.2;
  };
  const play = (clip) => {
    if (!clip) return;
    const next = mixer.clipAction(clip);
    if (current === next) return;
    next.reset().play();
    if (current) current.crossFadeTo(next, 0.25, false);
    current = next;
  };
  const dispose = () => {
    mats.forEach((m) => m.dispose());
    for (const ch of pivot.children) {
      if (ch === model) continue;
      ch.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  };
  return {
    entry: e, pivot, update, dispose,
    playIdle: () => play(idleClip), playHappy: () => play(happyClip),
  };
}

/* ---------- 共用場景設定 ---------- */
function setupScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6e8, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 4, 3);
  scene.add(key);
  return scene;
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';
    container.appendChild(this.canvas);
    this.scene = setupScene(this.renderer);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 2.2, 7.2);
    this.camera.lookAt(0, 1.0, 0);
    this.clock = new THREE.Clock();
    this.t = 0;
    this.animal = null;
    this.running = false;
    this.userRot = 0;
    this.mode = 'idle';
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
  async show(entryId, { mode = 'idle' } = {}) {
    const my = ++this.token;
    const a = await buildAnimal(entryId);
    if (my !== this.token) { a.dispose(); return; }
    if (this.animal) { this.scene.remove(this.animal.pivot); this.animal.dispose(); }
    this.animal = a;
    this.scene.add(a.pivot);
    this.mode = mode;
    this.userRot = 0;
    this.t = 0;
    if (mode === 'celebrate') a.playHappy(); else a.playIdle();
    this.start();
  }
  mount(container) {
    if (this.container === container) return;
    this.ro.unobserve(this.container);
    this.container = container;
    container.appendChild(this.canvas);
    this.ro.observe(container);
    this._resize();
  }
  clear() {
    this.token++;
    if (this.animal) { this.scene.remove(this.animal.pivot); this.animal.dispose(); this.animal = null; }
    this._render();
  }
  playHappy() {
    if (!this.animal) return;
    this.animal.playHappy();
    this.mode = 'celebrate'; this.t = 0;
    clearTimeout(this._back);
    this._back = setTimeout(() => { if (this.animal) { this.animal.playIdle(); this.mode = 'idle'; } }, 3500);
  }
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
        const p = a.pivot;
        if (this.mode === 'celebrate' && this.t < 1.6) {
          // 出場：跳一下並轉一圈
          p.position.y = Math.abs(Math.sin(this.t * 6)) * 0.45 * Math.exp(-this.t * 1.5);
          p.rotation.y = this.userRot + (1 - Math.min(this.t / 1.2, 1)) * Math.PI * 2 + Math.sin(this.t * 0.6) * 0.25;
        } else {
          p.position.y = 0;
          const sway = this.interactive ? 0 : Math.sin(this.t * 0.7) * 0.35;
          p.rotation.y = this.userRot + sway + (this.interactive ? Math.sin(this.t * 0.5) * 0.15 : 0);
          const breathe = 1 + Math.sin(this.t * 2.2) * 0.015;
          p.scale.set(1, breathe, 1);
        }
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
const THUMB_CACHE = 'ypym-thumbs-v1';
const thumbMem = new Map();
let thumbR = null, thumbScene = null, thumbCam = null, queue = Promise.resolve();
function thumbRenderer() {
  if (thumbR) return thumbR;
  thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbR.setPixelRatio(1);
  thumbR.setSize(256, 256, false);
  thumbR.outputColorSpace = THREE.SRGBColorSpace;
  thumbR.toneMapping = THREE.ACESFilmicToneMapping;
  thumbR.toneMappingExposure = 1.15;
  thumbScene = setupScene(thumbR);
  thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  thumbCam.position.set(1.6, 2.1, 6.4);
  thumbCam.lookAt(0, 1.0, 0);
  return thumbR;
}
async function renderThumb(entryId) {
  const r = thumbRenderer();
  const a = await buildAnimal(entryId, { particles: false });
  a.update(0, 0);
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
