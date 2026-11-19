// 低多邊形 3D 動物：全部用程式「捏」出來（球、圓錐、圓柱、方塊）
// 不需要下載任何模型檔。每隻動物由「物種」+「配件／變身」組成。
import * as THREE from 'three';

/* =========================================================
   圖鑑清單：普通 20、稀有 15、史詩 10、傳說 5
   ========================================================= */
export const LP_SPECIES = {
  shiba: '柴犬', pom: '白色狐狸犬', cat: '三花貓', rabbit: '白兔', panda: '熊貓', bear: '小熊',
  pig: '小豬', chick: '小雞', penguin: '企鵝', fox: '狐狸', frog: '青蛙',
  hamster: '倉鼠', koala: '無尾熊', sheep: '綿羊', cow: '乳牛', owl: '貓頭鷹',
  duck: '鴨鴨', hedgehog: '刺蝟', seal: '海豹', turtle: '烏龜', capybara: '水豚',
};
const RARE = [
  ['shiba', '圍巾柴犬', ['scarf']], ['pom', '蝴蝶結狐狸犬', ['bow:#E5484D']], ['cat', '蝴蝶結貓咪', ['bow']], ['rabbit', '草莓帽兔兔', ['strawberryHat']],
  ['panda', '竹子熊貓', ['bamboo']], ['bear', '蜂蜜小熊', ['honey']], ['pig', '花圈小豬', ['flowerCrown']],
  ['chick', '蛋殼小雞', ['eggshell']], ['penguin', '毛帽企鵝', ['beanie']], ['fox', '眼鏡狐狸', ['glasses']],
  ['frog', '荷葉青蛙', ['lotus']], ['hamster', '瓜子倉鼠', ['seed']], ['koala', '樹葉無尾熊', ['eucalyptus']],
  ['sheep', '鈴鐺綿羊', ['bell']], ['cow', '草帽乳牛', ['strawHat']], ['capybara', '柚子水豚', ['yuzu']],
];
const EPIC = [
  ['shiba', '騎士柴犬', ['knightHelmet', 'cape:#E5484D', 'shield']],
  ['pom', '魔法師狐狸犬', ['wizardHat', 'cape:#6E5BC8', 'starWand']],
  ['rabbit', '公主兔兔', ['crown', 'cape:#B48CFF', 'starWand']],
  ['fox', '偵探狐狸', ['detectiveHat', 'bowtie', 'magnifier']],
  ['owl', '魔法師貓頭鷹', ['wizardHat', 'starWand']],
  ['duck', '水手鴨鴨', ['sailorCap', 'neckerchief']],
  ['seal', '派對海豹', ['partyHat', 'balloon']],
  ['turtle', '探險家烏龜', ['explorerHat', 'binoculars', 'map']],
  ['bear', '主廚小熊', ['chefHat', 'apron', 'spatula']],
  ['capybara', '溫泉水豚', ['towel', 'bucket'], 'steam'],
  ['penguin', '太空人企鵝', ['spaceHelmet', 'jetpack']],
];
const LEGEND = [
  ['fox', '九尾仙狐', 'ninetail'], ['cat', '黃金招財貓', 'lucky'], ['rabbit', '天使兔兔', 'angel'],
  ['sheep', '彩虹獨角羊', 'unicorn'], ['penguin', '星空企鵝', 'galaxy'],
];
export const LP_CATALOG = [
  ...Object.entries(LP_SPECIES).map(([sp, name]) => ({ id: sp, sp, rarity: 'common', name, acc: [] })),
  ...RARE.map(([sp, name, acc]) => ({ id: `${sp}_r`, sp, rarity: 'rare', name, acc })),
  ...EPIC.map(([sp, name, acc, fx]) => ({ id: `${sp}_e`, sp, rarity: 'epic', name, acc, fx: fx || 'sparkle' })),
  ...LEGEND.map(([sp, name, form]) => ({ id: `${sp}_l`, sp, rarity: 'legend', name, acc: [], form, fx: form })),
];
export const LP_BY_ID = Object.fromEntries(LP_CATALOG.map((e) => [e.id, e]));

/* =========================================================
   基本形狀工具
   ========================================================= */
const GEO = {
  ico1: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  smooth: new THREE.SphereGeometry(1, 18, 12),
  dome: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
};
const SHARED = new Set(Object.values(GEO));
const matCache = new Map();
let PAINT = null; // 變身時統一換材質（例如全身黃金）

function M(spec, { flat = true, raw = false } = {}) {
  if (!raw && PAINT && typeof spec === 'string') spec = PAINT(spec) || spec;
  const s = typeof spec === 'string' ? { color: spec } : spec;
  if (s.isMaterial) return s;
  const key = JSON.stringify([s, flat]);
  if (!s.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: s.color, flatShading: flat, roughness: s.rough ?? 0.82, metalness: s.metal ?? 0,
    emissive: s.emissive || '#000000', emissiveIntensity: s.ei ?? 0,
    transparent: s.opacity !== undefined, opacity: s.opacity ?? 1, depthWrite: s.opacity === undefined,
    side: s.double ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (!s.unique) matCache.set(key, m); else m.userData.unique = true;
  return m;
}
function place(m, parent, pos, rot, scl) {
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scl) m.scale.set(scl[0], scl[1], scl[2]);
  parent.add(m);
  return m;
}
const grp = (parent, pos, rot) => place(new THREE.Group(), parent, pos, rot);
// 橢圓球：r 半徑、s 各軸比例
function ball(parent, color, r, pos, s = [1, 1, 1], o = {}) {
  const g = o.smooth ? GEO.smooth : o.detail === 2 ? GEO.ico2 : GEO.ico1;
  return place(new THREE.Mesh(g, M(color, { flat: !o.smooth, raw: o.raw })), parent, pos, o.rot, [r * s[0], r * s[1], r * s[2]]);
}
function dome(parent, color, r, pos, s = [1, 1, 1], rot) {
  return place(new THREE.Mesh(GEO.dome, M(color)), parent, pos, rot, [r * s[0], r * s[1], r * s[2]]);
}
const cone = (parent, color, r, h, seg, pos, rot, scl) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), M(color)), parent, pos, rot, scl);
const cyl = (parent, color, rt, rb, h, seg, pos, rot, scl, open) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open), M(color)), parent, pos, rot, scl);
const box = (parent, color, w, h, d, pos, rot) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color)), parent, pos, rot);
const torus = (parent, color, R, t, rs, ts, arc, pos, rot, scl) => place(new THREE.Mesh(new THREE.TorusGeometry(R, t, rs, ts, arc ?? Math.PI * 2), M(color)), parent, pos, rot, scl);
function star(parent, color, r, depth, pos, rot) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return place(new THREE.Mesh(g, M(color)), parent, pos, rot);
}

/* =========================================================
   Q 版身體：大頭 + 小身體
   ========================================================= */
// head 群組裡：頭的中心在 (0, cy, 0)，半徑 rx/ry/rz
function surfZ(H, x, y) {
  const k = 1 - (x / H.rx) ** 2 - ((y - H.cy) / H.ry) ** 2;
  return H.rz * Math.sqrt(Math.max(0, k));
}
function surfY(H, x, z = 0) {
  const k = 1 - (x / H.rx) ** 2 - (z / H.rz) ** 2;
  return H.cy + H.ry * Math.sqrt(Math.max(0, k));
}

function chibi(c, opt = {}) {
  const root = new THREE.Group();
  const body = grp(root, [0, 0, 0]);
  const A = { root, body, ears: [], arms: [], eyes: [], tails: [], wings: [], spin: [] };
  const one = !!opt.oneBody;
  if (!one) {
    const bs = opt.bodyScale || [1, 0.98, 0.9];
    ball(body, c.body, 0.46, [0, 0.5, 0], bs, { detail: 2 });
    if (c.belly) ball(body, c.belly, 0.34, [0, 0.46, 0.17], [1, 1.02, 0.75], { detail: 2 });
  }
  // 腳
  const fy = opt.footY ?? 0.07;
  for (const s of [-1, 1]) ball(body, c.feet || c.body, opt.footR || 0.13, [s * (opt.footX || 0.2), fy, 0.12], [1, 0.6, 1.3]);
  // 手（可擺動，手上可以拿東西）
  const armY = opt.armY ?? 0.74, armX = opt.armX ?? 0.37;
  for (const s of [-1, 1]) {
    const a = grp(body, [s * armX, armY, 0.04]);
    a.rotation.z = s * (opt.armOut ?? 0.38);
    a.userData.s = s; a.userData.base = a.rotation.z;
    if (opt.wingArms) ball(a, c.arms || c.body, 0.17, [s * 0.02, -0.16, -0.02], [0.45, 1.25, 0.85]);
    else ball(a, c.arms || c.body, 0.12, [s * 0.02, -0.15, 0.03], [0.85, 1.35, 0.85]);
    a.userData.hand = [s * 0.03, -0.3, 0.07];
    A.arms.push(a);
  }
  // 頭
  const head = grp(root, [0, one ? 0 : 0.9, 0]);
  A.head = head;
  const H = one
    ? { cy: opt.cy ?? 0.66, rx: opt.rx ?? 0.6, ry: opt.ry ?? 0.66, rz: opt.rz ?? 0.56 }
    : { cy: 0.32, rx: 0.52 * (opt.hs?.[0] ?? 1.08), ry: 0.52 * (opt.hs?.[1] ?? 0.95), rz: 0.52 * (opt.hs?.[2] ?? 0.98) };
  A.H = H;
  ball(head, c.head || c.body, 1, [0, H.cy, 0], [H.rx, H.ry, H.rz], { detail: 2 });
  // 錨點：配件要放的位置
  A.anchor = {
    top: { parent: head, pos: [0, surfY(H, 0) - 0.06, 0], r: H.rx },
    face: { parent: head, pos: [0, H.cy + (opt.eyeDy ?? 0.02), surfZ(H, 0, H.cy) + 0.02] },
    neck: { parent: one ? head : root, pos: one ? [0, H.cy - H.ry * 0.25, 0] : [0, 0.88, 0], r: one ? H.rx * 0.92 : 0.36 },
    back: { parent: body, pos: one ? [0, H.cy - 0.05, -H.rz * 0.92] : [0, 0.55, -0.38] },
    belly: { parent: body, pos: one ? [0, H.cy - 0.2, H.rz * 0.92] : [0, 0.45, 0.36] },
    tail: { parent: body, pos: one ? [0, 0.3, -H.rz * 0.85] : [0, 0.32, -0.4] },
  };
  return A;
}

// 臉：眼睛、亮點、腮紅、嘴巴（用光滑的球，表情比較可愛）
function face(A, o = {}) {
  const H = A.H, head = A.head;
  const ey = H.cy + (o.eyeDy ?? 0.02), ex = o.eyeX ?? 0.19, er = o.eyeR ?? 0.07;
  for (const s of [-1, 1]) {
    const z = surfZ(H, ex, ey) - 0.01 + (o.eyeOut ?? 0);
    if (o.eyeRing) ball(head, o.eyeRing, er * 2.1, [s * ex, ey, z - 0.03], [1, 1, 0.35], { smooth: true });
    const e = ball(head, '#2B2233', er, [s * ex, ey, z], [1, o.sleepy ? 0.45 : 1.18, 0.6], { smooth: true, raw: true });
    e.material = M({ color: '#2B2233', rough: 0.25 }, { flat: false, raw: true });
    e.userData.sy = e.scale.y;
    A.eyes.push(e);
    if (!o.sleepy) {
      const hl = ball(head, '#FFFFFF', er * 0.32, [s * ex + 0.022, ey + 0.035, z + er * 0.5], [1, 1, 1], { smooth: true, raw: true });
      A.eyes.push(hl); hl.userData.hl = true;
    }
    if (o.blush !== false) {
      const bx = o.blushX ?? 0.31, by = ey - 0.11;
      ball(head, o.blush || '#FF9DB8', 0.065, [s * bx, by, surfZ(H, bx, by) - 0.012], [1.3, 0.7, 0.4], { smooth: true, raw: true });
    }
  }
  let mz = surfZ(H, 0, ey - 0.17);
  if (o.muzzle) {
    const ms = o.muzzleS || [1.35, 0.95, 0.8], my = ey - (o.muzzleDy ?? 0.15);
    const mzz = surfZ(H, 0, my) - 0.17 * ms[2] * 0.55;
    ball(head, o.muzzle, 0.17, [0, my, mzz], ms, { detail: 2 });
    mz = mzz + 0.17 * ms[2] - 0.01;
    if (o.nose !== false) ball(head, o.nose || '#3A2A35', 0.045, [0, my + 0.07, mz - 0.005], [1.3, 0.9, 0.8], { smooth: true, raw: true });
  } else if (o.nose) {
    ball(head, o.nose, 0.04, [0, ey - 0.08, surfZ(H, 0, ey - 0.08)], [1.3, 0.9, 0.8], { smooth: true, raw: true });
  }
  if (o.mouth !== false) {
    const my = o.muzzle ? ey - (o.muzzleDy ?? 0.15) - 0.06 : ey - 0.15;
    const z = o.muzzle ? mz - 0.03 : surfZ(H, 0, my) + 0.004;
    for (const s of [-1, 1]) torus(head, '#4A2E3A', 0.028, 0.009, 4, 8, Math.PI, [s * 0.028, my, z], [0, 0, Math.PI]);
  }
  return A;
}

/* ---------- 耳朵、尾巴 ---------- */
function earTri(A, color, inner, o = {}) {
  const H = A.H, x = o.x ?? 0.3, h = o.h ?? 0.3, r = o.r ?? 0.15;
  for (const s of [-1, 1]) {
    const g = grp(A.head, [s * x, surfY(H, x) - 0.08, o.z ?? -0.02], [o.tiltX ?? 0, 0, -s * (o.tilt ?? 0.38)]);
    cone(g, color, r, h, 4, [0, h / 2, 0], [0, Math.PI / 4, 0], [1, 1, 0.55]);
    if (inner) cone(g, inner, r * 0.55, h * 0.62, 4, [0, h * 0.36, 0.05], [0, Math.PI / 4, 0], [1, 1, 0.4]);
    if (o.tip) cone(g, o.tip, r * 0.42, h * 0.32, 4, [0, h * 0.84, 0], [0, Math.PI / 4, 0], [1, 1, 0.6]);
    g.userData.s = s; g.userData.base = g.rotation.z;
    A.ears.push(g);
  }
}
function earRound(A, color, inner, o = {}) {
  const H = A.H, x = o.x ?? 0.36, r = o.r ?? 0.15;
  for (const s of [-1, 1]) {
    const g = grp(A.head, [s * x, surfY(H, x) - (o.dy ?? 0.08), o.z ?? -0.02], [0, 0, -s * (o.tilt ?? 0.25)]);
    ball(g, color, r, [0, r * 0.6, 0], [1, 1, 0.55], { detail: o.detail || 1 });
    if (inner) ball(g, inner, r * 0.6, [0, r * 0.55, r * 0.3], [1, 1, 0.4], { smooth: true });
    g.userData.s = s; g.userData.base = g.rotation.z;
    A.ears.push(g);
  }
}
function earLong(A, color, inner) {
  const H = A.H;
  for (const s of [-1, 1]) {
    const g = grp(A.head, [s * 0.17, surfY(H, 0.17) - 0.08, -0.04], [0, 0, -s * 0.12]);
    ball(g, color, 0.11, [0, 0.33, 0], [1, 3.3, 0.62], { detail: 1 });
    ball(g, inner, 0.065, [0, 0.33, 0.05], [1, 3.6, 0.4], { smooth: true });
    g.userData.s = s; g.userData.base = g.rotation.z;
    A.ears.push(g);
  }
}
function tailGroup(A, rotX = 0) {
  const t = grp(A.anchor.tail.parent, A.anchor.tail.pos, [rotX, 0, 0]);
  A.tails.push(t);
  return t;
}

/* =========================================================
   20 種動物
   ========================================================= */
const SP = {
  shiba(c) {
    c = { fur: '#E9A35E', white: '#FFF6EA', ...c };
    const A = chibi({ body: c.fur, belly: c.white, arms: c.fur, feet: c.white });
    face(A, { muzzle: c.white, nose: '#3A2A35' });
    for (const s of [-1, 1]) ball(A.head, c.white, 0.13, [s * 0.3, A.H.cy - 0.13, surfZ(A.H, 0.3, A.H.cy - 0.13) - 0.07], [1.2, 0.9, 0.7]);
    ball(A.head, c.white, 0.05, [0.14, A.H.cy + 0.16, surfZ(A.H, 0.14, A.H.cy + 0.16) - 0.02], [1.4, 0.8, 0.5]);
    ball(A.head, c.white, 0.05, [-0.14, A.H.cy + 0.16, surfZ(A.H, 0.14, A.H.cy + 0.16) - 0.02], [1.4, 0.8, 0.5]);
    earTri(A, c.fur, '#FFD9C7', { tilt: 0.3 });
    const t = tailGroup(A, -0.6);
    torus(t, c.fur, 0.13, 0.065, 5, 10, Math.PI * 1.6, [0, 0.12, -0.05], [0, Math.PI / 2, 0.4]);
    return A;
  },
  pom(c) {
    c = { fur: '#FFFFFF', fluff: '#FAF7FF', cream: '#FFF3E4', ...c };
    const A = chibi({ body: c.fur, arms: c.fur, feet: c.fur });
    // 蓬蓬的毛領（圍在臉的外圈和胸前）
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.sin(a) > -0.05) continue;
      ball(A.head, c.fluff, 0.15, [Math.cos(a) * 0.5, A.H.cy + Math.sin(a) * 0.4 - 0.02, -0.04], [1, 1, 0.9]);
    }
    for (const s of [-1, 1]) ball(A.head, c.fluff, 0.14, [s * 0.52, A.H.cy + 0.02, -0.06], [0.9, 1.1, 0.9]);
    for (const [x, y, z, r] of [[0, 0.72, 0.3, 0.2], [0.2, 0.7, 0.24, 0.17], [-0.2, 0.7, 0.24, 0.17], [0.12, 0.55, 0.36, 0.15], [-0.12, 0.55, 0.36, 0.15]]) ball(A.body, c.fluff, r, [x, y, z]);
    face(A, { muzzle: c.cream, muzzleS: [1.05, 0.85, 0.9], nose: '#2B2233', eyeR: 0.075 });
    earTri(A, c.fur, '#FFC2D4', { h: 0.3, r: 0.14, x: 0.27, tilt: 0.25, z: 0.02 });
    // 捲在背上的大蓬尾巴
    const t = tailGroup(A, -0.2);
    for (const [y, z, r] of [[0.12, -0.02, 0.17], [0.3, 0.02, 0.19], [0.45, 0.12, 0.17], [0.5, 0.27, 0.14]]) ball(t, c.fluff, r, [0, y, z]);
    return A;
  },
  cat(c) {
    c = { fur: '#FFFBF5', orange: '#F7A35C', black: '#4A4150', ...c };
    const A = chibi({ body: c.fur, arms: c.fur, feet: c.fur });
    face(A, { nose: '#FF8FA8' });
    ball(A.head, c.orange, 0.2, [0.25, A.H.cy + 0.27, surfZ(A.H, 0.25, A.H.cy + 0.27) - 0.13], [1.2, 1, 0.8]);
    ball(A.head, c.black, 0.16, [-0.3, A.H.cy + 0.22, surfZ(A.H, 0.3, A.H.cy + 0.22) - 0.12], [1.1, 1, 0.8]);
    ball(A.body, c.orange, 0.17, [0.22, 0.6, -0.22], [1, 1, 1]);
    ball(A.body, c.black, 0.14, [-0.2, 0.45, -0.28], [1, 1, 1]);
    earTri(A, c.fur, '#FFC2D4', { tilt: 0.28, h: 0.26 });
    A.ears[0].children[0].material = M(c.black); A.ears[1].children[0].material = M(c.orange);
    for (const s of [-1, 1]) for (const k of [0, 1]) cyl(A.head, '#C9B9C6', 0.004, 0.004, 0.16, 3, [s * 0.36, A.H.cy - 0.08 - k * 0.04, surfZ(A.H, 0.33, A.H.cy - 0.08) + 0.01], [0, 0, Math.PI / 2 + s * (k ? -0.15 : 0.1)]);
    const t = tailGroup(A, -0.5);
    let p = t;
    for (let i = 0; i < 5; i++) { p = grp(p, [0, i ? 0.1 : 0, 0], [0.32, 0, 0]); ball(p, i > 2 ? c.orange : c.fur, 0.06, [0, 0.05, 0], [1, 1.3, 1]); }
    return A;
  },
  rabbit(c) {
    c = { fur: '#FFFFFF', inner: '#FFC2D4', ...c };
    const A = chibi({ body: c.fur, belly: '#FFF3F7', arms: c.fur, feet: c.fur });
    face(A, { nose: '#FF8FA8' });
    box(A.head, '#FFFFFF', 0.05, 0.05, 0.02, [0, A.H.cy - 0.2, surfZ(A.H, 0, A.H.cy - 0.2) + 0.005]);
    earLong(A, c.fur, c.inner);
    const t = tailGroup(A);
    ball(t, c.fur, 0.11, [0, 0, -0.03]);
    return A;
  },
  panda(c) {
    c = { white: '#FFFFFF', black: '#3A3442', ...c };
    const A = chibi({ body: c.white, arms: c.black, feet: c.black });
    for (const s of [-1, 1]) ball(A.head, c.black, 0.1, [s * 0.19, A.H.cy + 0.0, surfZ(A.H, 0.19, A.H.cy) - 0.04], [1.05, 1.35, 0.5], { rot: [0, 0, s * 0.5] });
    face(A, { nose: '#3A3442', eyeOut: 0.025, eyeR: 0.055 });
    earRound(A, c.black, null, { r: 0.14 });
    ball(A.body, c.black, 0.36, [0, 0.72, -0.02], [1.32, 0.3, 1.05]);
    return A;
  },
  bear(c) {
    c = { fur: '#B98055', light: '#F2D3B3', ...c };
    const A = chibi({ body: c.fur, belly: c.light, arms: c.fur, feet: c.fur });
    face(A, { muzzle: c.light, nose: '#3A2A35' });
    earRound(A, c.fur, c.light, { r: 0.15 });
    const t = tailGroup(A); ball(t, c.fur, 0.08, [0, 0, -0.02]);
    return A;
  },
  pig(c) {
    c = { skin: '#FFB5C8', dark: '#F28AA8', ...c };
    const A = chibi({ body: c.skin, arms: c.skin, feet: c.dark });
    face(A, { mouth: false, blushX: 0.33 });
    const sy = A.H.cy - 0.1, sz = surfZ(A.H, 0, sy);
    cyl(A.head, c.dark, 0.12, 0.13, 0.08, 8, [0, sy, sz + 0.01], [Math.PI / 2, 0, 0], [1.25, 1, 0.9]);
    for (const s of [-1, 1]) ball(A.head, '#B8577A', 0.025, [s * 0.045, sy, sz + 0.05], [1, 1.4, 0.6], { smooth: true });
    for (const s of [-1, 1]) {
      const g = grp(A.head, [s * 0.3, surfY(A.H, 0.3) - 0.06, 0.08], [0.7, 0, -s * 0.45]);
      cone(g, c.skin, 0.14, 0.24, 4, [0, 0.12, 0], [0, Math.PI / 4, 0], [1, 1, 0.5]);
      g.userData.s = s; g.userData.base = g.rotation.z; A.ears.push(g);
    }
    const t = tailGroup(A);
    torus(t, c.dark, 0.06, 0.022, 4, 10, Math.PI * 1.7, [0, 0.02, -0.03], [0, Math.PI / 2, 0]);
    return A;
  },
  chick(c) {
    c = { body: '#FFE27A', beak: '#FFA94D', ...c };
    const A = chibi({ body: c.body, feet: c.beak, arms: c.body }, { oneBody: true, cy: 0.62, rx: 0.6, ry: 0.6, rz: 0.56, wingArms: true, armY: 0.6, armX: 0.56, armOut: 0.5, footX: 0.18 });
    face(A, { mouth: false, eyeDy: 0.12, eyeX: 0.2 });
    const by = A.H.cy + 0.02;
    cone(A.head, c.beak, 0.08, 0.14, 4, [0, by, surfZ(A.H, 0, by) + 0.05], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.7]);
    for (let i = 0; i < 3; i++) ball(A.head, '#FF8080', 0.07, [(i - 1) * 0.07, surfY(A.H, 0) + 0.03 - Math.abs(i - 1) * 0.03, 0.03], [0.8, 1.2, 0.7]);
    const t = tailGroup(A, -0.4);
    cone(t, c.body, 0.1, 0.18, 4, [0, 0.1, 0], [-0.6, 0, 0]);
    return A;
  },
  penguin(c) {
    c = { back: '#3D4466', belly: '#FFFFFF', beak: '#FFB347', ...c };
    const A = chibi({ body: c.back, feet: c.beak, arms: c.back }, { oneBody: true, cy: 0.68, rx: 0.55, ry: 0.7, rz: 0.52, wingArms: true, armY: 0.66, armX: 0.52, armOut: 0.35, footX: 0.17 });
    ball(A.head, c.belly, 1, [0, A.H.cy - 0.06, 0.12], [A.H.rx * 0.82, A.H.ry * 0.86, A.H.rz * 0.85], { detail: 2 });
    face(A, { mouth: false, eyeDy: 0.14, eyeOut: 0.0 });
    const by = A.H.cy + 0.04;
    cone(A.head, c.beak, 0.07, 0.13, 4, [0, by, surfZ(A.H, 0, by) + 0.04], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.6]);
    A.paletteKeys = c;
    return A;
  },
  fox(c) {
    c = { fur: '#F48C4C', white: '#FFF6EE', tip: '#4A3A44', ...c };
    const A = chibi({ body: c.fur, belly: c.white, arms: c.fur, feet: c.tip });
    for (const s of [-1, 1]) ball(A.head, c.white, 0.17, [s * 0.24, A.H.cy - 0.12, surfZ(A.H, 0.24, A.H.cy - 0.12) - 0.1], [1.3, 0.9, 0.75]);
    face(A, { muzzle: c.white, muzzleS: [1.2, 0.85, 0.95], nose: '#3A2A35' });
    earTri(A, c.fur, c.white, { h: 0.34, tip: c.tip, tilt: 0.32 });
    if (!c.noTail) {
      const t = tailGroup(A, -0.9);
      ball(t, c.fur, 0.2, [0, 0.22, 0], [0.85, 1.6, 0.85], { detail: 1 });
      ball(t, c.white, 0.12, [0, 0.5, 0], [0.9, 1, 0.9]);
    }
    return A;
  },
  frog(c) {
    c = { skin: '#8EDB8A', belly: '#E9FAD9', ...c };
    const A = chibi({ body: c.skin, belly: c.belly, arms: c.skin, feet: c.skin }, { hs: [1.2, 0.82, 0.98] });
    for (const s of [-1, 1]) ball(A.head, c.skin, 0.15, [s * 0.24, A.H.cy + 0.26, 0.2], [1, 1, 1], { detail: 1 });
    face(A, { eyeDy: 0.27, eyeX: 0.24, eyeOut: 0, mouth: false, blushX: 0.38 });
    torus(A.head, '#4A2E3A', 0.16, 0.012, 4, 12, Math.PI, [0, A.H.cy - 0.04, surfZ(A.H, 0, A.H.cy - 0.12) - 0.02], [0, 0, Math.PI], [1, 0.45, 1]);
    return A;
  },
  hamster(c) {
    c = { fur: '#F5B87A', white: '#FFF8EE', ...c };
    const A = chibi({ body: c.white, arms: c.fur, feet: '#FFC6C6' }, { bodyScale: [1.1, 0.95, 0.95] });
    ball(A.body, c.fur, 0.47, [0, 0.55, -0.06], [1.06, 0.9, 0.88], { detail: 2 });
    for (const s of [-1, 1]) ball(A.head, c.white, 0.2, [s * 0.3, A.H.cy - 0.12, surfZ(A.H, 0.3, A.H.cy - 0.12) - 0.12], [1.15, 0.95, 0.9], { detail: 2 });
    face(A, { nose: '#FF8FA8', eyeR: 0.065 });
    earRound(A, c.fur, '#FFC6C6', { r: 0.1, x: 0.3 });
    return A;
  },
  koala(c) {
    c = { fur: '#AEB4C4', light: '#E9ECF4', ...c };
    const A = chibi({ body: c.fur, belly: c.light, arms: c.fur, feet: c.fur });
    face(A, { mouth: true, eyeX: 0.22, eyeDy: 0.05 });
    ball(A.head, '#4A4458', 0.1, [0, A.H.cy - 0.06, surfZ(A.H, 0, A.H.cy - 0.06) + 0.01], [1, 1.25, 0.8], { smooth: true });
    earRound(A, c.fur, c.light, { r: 0.22, x: 0.42, dy: 0.18, tilt: 0.6, detail: 1 });
    return A;
  },
  sheep(c) {
    c = { wool: '#FFFDF8', face: '#5E5468', ...c };
    const A = chibi({ body: c.wool, arms: c.face, feet: c.face }, { hs: [0.92, 0.95, 0.95] });
    A.head.children[0].material = M(c.face);
    face(A, { blush: '#FF9DB8', eyeR: 0.06 });
    A.wool = [];
    const wcols = c.rainbow ? null : c.wool;
    let i = 0;
    for (const [x, y, z] of [[0, 0.62, 0.32], [0.3, 0.6, 0.18], [-0.3, 0.6, 0.18], [0.36, 0.38, 0], [-0.36, 0.38, 0], [0, 0.32, 0.32], [0.24, 0.3, -0.25], [-0.24, 0.3, -0.25], [0, 0.68, -0.25], [0.2, 0.75, 0.05], [-0.2, 0.75, 0.05]]) {
      const w = ball(A.body, wcols || `hsl(${(i * 33) % 360},85%,78%)`, 0.24, [x, y, z]);
      if (c.rainbow) { w.material = M({ color: `hsl(${(i * 33) % 360},85%,78%)`, unique: true }); w.userData.hue = (i * 33) / 360; }
      A.wool.push(w); i++;
    }
    for (const [x, z] of [[0, 0.1], [0.16, 0.02], [-0.16, 0.02], [0.08, -0.12], [-0.08, -0.12]]) {
      const w = ball(A.head, wcols || `hsl(${(i * 33) % 360},85%,78%)`, 0.13, [x, surfY(A.H, x, z) - 0.02, z]);
      if (c.rainbow) { w.material = M({ color: '#fff', unique: true }); w.userData.hue = (i * 33) / 360; }
      A.wool.push(w); i++;
    }
    for (const s of [-1, 1]) {
      const g = grp(A.head, [s * 0.42, A.H.cy + 0.08, 0], [0, 0, -s * 1.3]);
      ball(g, c.face, 0.1, [0, 0.1, 0], [0.7, 1.4, 0.5]);
      g.userData.s = s; g.userData.base = g.rotation.z; A.ears.push(g);
    }
    return A;
  },
  cow(c) {
    c = { white: '#FFFFFF', spot: '#3E3848', pink: '#FFB8C8', ...c };
    const A = chibi({ body: c.white, arms: c.white, feet: c.spot });
    ball(A.head, c.spot, 0.17, [-0.24, A.H.cy + 0.22, surfZ(A.H, 0.24, A.H.cy + 0.22) - 0.12], [1.1, 1, 0.8]);
    ball(A.body, c.spot, 0.17, [0.26, 0.58, 0.2], [1, 1, 1]);
    ball(A.body, c.spot, 0.15, [-0.24, 0.4, -0.25], [1, 1, 1]);
    ball(A.body, c.spot, 0.12, [0.1, 0.36, 0.36], [1, 1, 0.6]);
    face(A, { muzzle: c.pink, muzzleS: [1.6, 0.95, 0.75], nose: false, mouth: false, eyeDy: 0.07 });
    const my = A.H.cy + 0.07 - 0.15, mz = surfZ(A.H, 0, my) + 0.03;
    for (const s of [-1, 1]) ball(A.head, '#C9708C', 0.022, [s * 0.07, my + 0.02, mz], [1, 1.3, 0.5], { smooth: true });
    for (const s of [-1, 1]) cone(A.head, '#FFF0C2', 0.045, 0.14, 5, [s * 0.2, surfY(A.H, 0.2) + 0.02, 0], [0, 0, -s * 0.4]);
    for (const s of [-1, 1]) {
      const g = grp(A.head, [s * 0.44, A.H.cy + 0.12, 0], [0, 0, -s * 1.2]);
      ball(g, c.white, 0.1, [0, 0.1, 0], [0.7, 1.3, 0.45]);
      g.userData.s = s; g.userData.base = g.rotation.z; A.ears.push(g);
    }
    const t = tailGroup(A, -0.3);
    cyl(t, c.white, 0.02, 0.02, 0.22, 4, [0, -0.1, -0.03]);
    ball(t, c.spot, 0.05, [0, -0.22, -0.03]);
    return A;
  },
  owl(c) {
    c = { body: '#B79BD8', belly: '#F4ECFF', disc: '#FFF8FF', beak: '#FFC15E', ...c };
    const A = chibi({ body: c.body, feet: c.beak, arms: c.body }, { oneBody: true, cy: 0.66, rx: 0.6, ry: 0.66, rz: 0.55, wingArms: true, armY: 0.64, armX: 0.57, armOut: 0.25, footX: 0.16 });
    ball(A.head, c.belly, 1, [0, A.H.cy - 0.12, 0.14], [A.H.rx * 0.75, A.H.ry * 0.72, A.H.rz * 0.85], { detail: 2 });
    face(A, { mouth: false, eyeDy: 0.16, eyeX: 0.21, eyeR: 0.085, eyeRing: c.disc, eyeOut: 0.03 });
    const by = A.H.cy + 0.06;
    cone(A.head, c.beak, 0.06, 0.12, 4, [0, by, surfZ(A.H, 0, by) + 0.04], [Math.PI / 2 + 0.3, Math.PI / 4, 0], [1, 1, 0.6]);
    earTri(A, c.body, null, { x: 0.36, h: 0.2, r: 0.1, tilt: 0.5 });
    for (let i = 0; i < 3; i++) cone(A.head, '#9C80C4', 0.035, 0.06, 3, [(i - 1) * 0.1, A.H.cy - 0.18, surfZ(A.H, (i - 1) * 0.1, A.H.cy - 0.18) + 0.01], [Math.PI / 2 + Math.PI, 0, 0], [1, 1, 0.5]);
    return A;
  },
  duck(c) {
    c = { body: '#FFFFFF', bill: '#FFB347', ...c };
    const A = chibi({ body: c.body, arms: c.body, feet: c.bill }, { wingArms: true, armOut: 0.3 });
    face(A, { mouth: false, eyeDy: 0.07 });
    const by = A.H.cy - 0.06, bz = surfZ(A.H, 0, by);
    ball(A.head, c.bill, 0.13, [0, by, bz + 0.03], [1.25, 0.38, 1.05]);
    ball(A.head, c.bill, 0.1, [0, by - 0.045, bz + 0.02], [1.1, 0.3, 0.9]);
    ball(A.head, c.body, 0.1, [0, surfY(A.H, 0) + 0.02, -0.05], [0.4, 1, 0.8]);
    const t = tailGroup(A, -1.1);
    cone(t, c.body, 0.13, 0.22, 4, [0, 0.1, 0], [0, Math.PI / 4, 0], [1, 1, 0.6]);
    return A;
  },
  hedgehog(c) {
    c = { face: '#F7DFC4', spine: '#9C7A63', ...c };
    const A = chibi({ body: c.face, arms: c.face, feet: c.face });
    face(A, { nose: '#3A2A35', muzzle: c.face, muzzleS: [1.1, 0.9, 1.1] });
    earRound(A, c.face, '#FFC2D4', { r: 0.09, x: 0.33, z: 0.08 });
    // 背上的刺
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const u = i / 40, phi = Math.acos(1 - 1.4 * u), th = i * 2.399;
      const d = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      if (d.z > 0.25) continue;
      pts.push(d);
    }
    for (const d of pts) {
      const g = grp(A.head, [d.x * A.H.rx * 0.92, A.H.cy + d.y * A.H.ry * 0.92, d.z * A.H.rz * 0.92 - 0.04]);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      cone(g, c.spine, 0.09, 0.26, 4, [0, 0.1, 0]);
    }
    for (let i = 0; i < 14; i++) {
      const th = Math.PI * (0.2 + (i % 7) * 0.1) + Math.PI * 0.05, y = i < 7 ? 0.62 : 0.4;
      const d = new THREE.Vector3(Math.cos(th) * 0.9, (y - 0.5) * 1.2, -Math.abs(Math.sin(th)) - 0.3).normalize();
      const g = grp(A.body, [d.x * 0.42, y, d.z * 0.4]);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      cone(g, c.spine, 0.08, 0.22, 4, [0, 0.08, 0]);
    }
    return A;
  },
  seal(c) {
    c = { body: '#CBD6E6', belly: '#F2F6FB', ...c };
    const A = chibi({ body: c.body, arms: c.body, feet: c.body }, { oneBody: true, cy: 0.62, rx: 0.56, ry: 0.64, rz: 0.56, wingArms: true, armY: 0.4, armX: 0.5, armOut: 0.9, footX: 0.2, footR: 0.14 });
    ball(A.head, c.belly, 1, [0, A.H.cy - 0.18, 0.12], [A.H.rx * 0.72, A.H.ry * 0.62, A.H.rz * 0.82], { detail: 2 });
    face(A, { muzzle: '#F7F9FC', muzzleS: [1.35, 0.85, 0.8], nose: '#3A3442', eyeDy: 0.18, eyeX: 0.2 });
    const my = A.H.cy + 0.18 - 0.15;
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ball(A.head, '#9AA5B8', 0.012, [s * (0.06 + (k % 2) * 0.04), my - 0.02 + (k - 1) * 0.03, surfZ(A.H, 0.08, my) + 0.05], [1, 1, 1], { smooth: true });
    return A;
  },
  turtle(c) {
    c = { skin: '#A8DDA0', shell: '#B88A5C', plate: '#E2C08C', belly: '#FFF1C9', ...c };
    const A = chibi({ body: c.skin, belly: c.belly, arms: c.skin, feet: c.skin });
    face(A, {});
    const sh = grp(A.body, [0, 0.52, -0.3], [-0.25, 0, 0]);
    dome(sh, c.shell, 0.5, [0, 0, 0], [1, 1, 0.8], [-Math.PI / 2, 0, 0]);
    torus(sh, c.plate, 0.47, 0.05, 4, 16, null, [0, 0, 0.01], [0, 0, 0], [1, 0.8, 1]);
    for (const [x, y] of [[0, 0], [0.22, 0.12], [-0.22, 0.12], [0.22, -0.12], [-0.22, -0.12], [0, 0.24], [0, -0.24]]) {
      const z = 0.5 * Math.sqrt(Math.max(0, 1 - (x / 0.5) ** 2 - (y / 0.4) ** 2));
      const g = grp(sh, [x, y, -z]);
      const n = new THREE.Vector3(x / 0.25, y / 0.16, -z / 0.25).normalize();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      cyl(g, c.plate, 0.1, 0.11, 0.05, 6, [0, 0, 0]);
    }
    A.anchor.back.pos = [0, 0.52, -0.62];
    return A;
  },
  capybara(c) {
    c = { fur: '#B58A66', dark: '#8A6448', ...c };
    const A = chibi({ body: c.fur, arms: c.fur, feet: c.dark }, { hs: [1.0, 0.92, 1.12] });
    face(A, { sleepy: true, muzzle: c.dark, muzzleS: [1.25, 1.05, 0.9], muzzleDy: 0.12, nose: '#3A2A35', eyeDy: 0.06, eyeX: 0.21, blush: '#F5A3A3' });
    earRound(A, c.dark, null, { r: 0.08, x: 0.3 });
    return A;
  },
};

/* =========================================================
   配件
   ========================================================= */
function at(A, name) {
  const a = A.anchor[name];
  return grp(a.parent, a.pos);
}
// 手上拿的東西：抵銷手臂角度，讓物品保持直立
function hand(A, s = 1, lean = 0) {
  const arm = A.arms[s > 0 ? 1 : 0];
  const g = grp(arm, arm.userData.hand);
  g.rotation.z = -arm.userData.base - s * lean;
  g.rotation.x = -arm.rotation.x;
  return g;
}
function raiseArm(A, s = 1, amt = 1.15) {
  const arm = A.arms[s > 0 ? 1 : 0];
  arm.rotation.z = arm.userData.base = s * amt;
  arm.rotation.x = -0.3;
}
const ACC = {
  scarf(A) {
    const a = A.anchor.neck, g = at(A, 'neck');
    torus(g, '#E5484D', a.r * 0.95, 0.085, 6, 14, null, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    box(g, '#E5484D', 0.13, 0.28, 0.07, [0.16, -0.14, a.r * 0.82], [0, 0, 0.25]);
    for (let i = 0; i < 3; i++) box(g, '#FFFFFF', 0.13, 0.025, 0.075, [0.19 - 0.015 * i, -0.06 - i * 0.08, a.r * 0.82 + 0.003], [0, 0, 0.25]);
  },
  bow(A, color) {
    const t = A.anchor.top, g = grp(t.parent, [t.pos[0] + t.r * 0.45, t.pos[1] - 0.06, 0.12], [0, 0, -0.45]);
    for (const s of [-1, 1]) cone(g, color || '#FF7FB2', 0.13, 0.24, 6, [s * 0.12, 0, 0], [0, 0, (s * Math.PI) / 2]);
    ball(g, color ? '#C93A40' : '#FF5E9C', 0.07, [0, 0, 0.02]);
  },
  strawberryHat(A) {
    const g = at(A, 'top');
    ball(g, '#FF6B7A', 0.33, [0, 0.08, 0], [1, 0.75, 1], { detail: 1 });
    for (let i = 0; i < 12; i++) { const a = i * 2.4, y = 0.05 + (i % 3) * 0.06; ball(g, '#FFF3A0', 0.022, [Math.cos(a) * 0.3, y, Math.sin(a) * 0.3], [1, 1.4, 1], { smooth: true }); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cone(g, '#6CCB75', 0.07, 0.16, 3, [Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]); }
    cyl(g, '#4FA35A', 0.02, 0.02, 0.12, 5, [0, 0.38, 0]);
  },
  bamboo(A) {
    const g = hand(A, 1);
    for (let i = 0; i < 3; i++) { cyl(g, '#7FCB6A', 0.045, 0.045, 0.2, 6, [0, -0.05 + i * 0.21, 0]); torus(g, '#5FA84E', 0.048, 0.015, 4, 8, null, [0, 0.05 + i * 0.21, 0], [Math.PI / 2, 0, 0]); }
    for (const s of [-1, 1]) ball(g, '#8FDB7A', 0.06, [s * 0.09, 0.55, 0], [1.6, 0.45, 0.8], { rot: [0, 0, s * 0.5] });
  },
  honey(A) {
    const g = hand(A, 1);
    cyl(g, '#FFB84D', 0.13, 0.11, 0.2, 8, [0, 0.03, 0.05]);
    cyl(g, '#E59A2E', 0.14, 0.14, 0.04, 8, [0, 0.15, 0.05]);
    ball(g, '#FFD45C', 0.06, [0.06, 0.12, 0.15], [1, 1.5, 0.6]);
    box(g, '#FFF6DE', 0.12, 0.07, 0.01, [0, 0.03, 0.17]);
  },
  flowerCrown(A) {
    const t = A.anchor.top, g = at(A, 'top');
    torus(g, '#7FCB6A', t.r * 0.62, 0.025, 4, 16, null, [0, -0.04, 0], [Math.PI / 2, 0, 0]);
    const cols = ['#FF9EC1', '#FFE27A', '#B9A8FF', '#FFFFFF', '#9FE3C8', '#FFB89A', '#FF9EC1'];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, f = grp(g, [Math.cos(a) * t.r * 0.62, -0.02, Math.sin(a) * t.r * 0.62]);
      for (let k = 0; k < 5; k++) { const b = (k / 5) * Math.PI * 2; ball(f, cols[i], 0.04, [Math.cos(b) * 0.045, 0.02, Math.sin(b) * 0.045], [1, 0.6, 1]); }
      ball(f, '#FFD45C', 0.03, [0, 0.04, 0]);
    }
  },
  eggshell(A) {
    const g = at(A, 'top');
    dome(g, '#FFFBF0', 0.3, [0, -0.02, 0], [1, 0.95, 1]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; cone(g, '#FFFBF0', 0.06, 0.1, 3, [Math.cos(a) * 0.28, -0.06, Math.sin(a) * 0.28], [Math.PI, a, 0]); }
    g.rotation.z = 0.15;
  },
  beanie(A) {
    const t = A.anchor.top, g = at(A, 'top');
    dome(g, '#7CC4FF', t.r * 0.86, [0, -0.12, 0], [1, 0.8, 1]);
    torus(g, '#FFFFFF', t.r * 0.84, 0.06, 6, 16, null, [0, -0.12, 0], [Math.PI / 2, 0, 0]);
    ball(g, '#FFFFFF', 0.11, [0, t.r * 0.66 - 0.06, 0]);
  },
  glasses(A) {
    const g = at(A, 'face');
    for (const s of [-1, 1]) {
      torus(g, '#5B4A6B', 0.1, 0.016, 5, 14, null, [s * 0.19, 0, 0.03]);
      ball(g, { color: '#DDF2FF', opacity: 0.35 }, 0.095, [s * 0.19, 0, 0.025], [1, 1, 0.1], { smooth: true });
    }
    cyl(g, '#5B4A6B', 0.012, 0.012, 0.18, 4, [0, 0.02, 0.04], [0, 0, Math.PI / 2]);
  },
  lotus(A) {
    raiseArm(A, 1, 0.9);
    const g = hand(A, 1, -0.25);
    cyl(g, '#5FA84E', 0.022, 0.022, 1.45, 5, [0, 0.68, 0]);
    const leaf = grp(g, [0, 1.42, 0], [0.12, 0, 0.18]);
    ball(leaf, '#7FD37A', 0.58, [0, 0, 0], [1, 0.16, 1], { detail: 2 });
    ball(leaf, '#9BE394', 0.4, [0, 0.03, 0], [1, 0.14, 1]);
    ball(leaf, '#BDF0A8', 0.06, [0, 0.1, 0]);
  },
  seed(A) {
    const g = grp(A.anchor.belly.parent, [0, 0.5, 0.42], [0.2, 0, 0.3]);
    ball(g, '#4A4458', 0.1, [0, 0, 0], [0.7, 1.4, 0.45]);
    for (const s of [-1, 1]) ball(g, '#FFFFFF', 0.025, [s * 0.035, 0, 0.035], [0.5, 4, 0.5]);
    for (const s of [-1, 1]) { const a = A.arms[s > 0 ? 1 : 0]; a.rotation.z = a.userData.base = s * 0.05; a.rotation.x = -0.6; }
  },
  eucalyptus(A) {
    const g = hand(A, 1);
    cyl(g, '#8A6A55', 0.018, 0.018, 0.5, 4, [0, 0.18, 0], [0, 0, -0.2]);
    for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1; ball(g, '#8FC9B0', 0.07, [0.04 * i * 0.3 + s * 0.08, 0.02 + i * 0.07, 0], [1.6, 0.6, 0.4], { rot: [0, 0, s * 0.6] }); }
  },
  bell(A) {
    const a = A.anchor.neck, g = at(A, 'neck');
    torus(g, '#E5484D', a.r * 0.95, 0.04, 5, 16, null, [0, 0, 0], [Math.PI / 2, 0, 0]);
    ball(g, { color: '#FFD45C', metal: 0.6, rough: 0.3 }, 0.09, [0, -0.08, a.r * 0.95]);
    box(g, '#7A5A20', 0.08, 0.012, 0.02, [0, -0.1, a.r * 0.95 + 0.08]);
  },
  strawHat(A) {
    const t = A.anchor.top, g = at(A, 'top');
    cyl(g, '#F5D48A', t.r * 1.35, t.r * 1.35, 0.04, 14, [0, -0.06, 0]);
    cyl(g, '#F5D48A', t.r * 0.55, t.r * 0.62, 0.22, 10, [0, 0.06, 0]);
    torus(g, '#E5484D', t.r * 0.6, 0.035, 4, 14, null, [0, -0.01, 0], [Math.PI / 2, 0, 0]);
    g.rotation.z = -0.1;
  },
  yuzu(A) {
    const g = at(A, 'top');
    ball(g, '#FFC93C', 0.2, [0, 0.12, 0], [1, 0.88, 1], { detail: 1 });
    cyl(g, '#6A9A4E', 0.015, 0.015, 0.06, 4, [0, 0.3, 0]);
    ball(g, '#6CCB75', 0.07, [0.07, 0.31, 0], [1.6, 0.3, 0.8], { rot: [0, 0, -0.4] });
  },
  // ---------- 史詩 ----------
  knightHelmet(A) {
    const t = A.anchor.top, g = at(A, 'top');
    dome(g, { color: '#C9D2E3', metal: 0.6, rough: 0.35 }, t.r * 1.0, [0, -0.2, 0], [1, 0.85, 1]);
    torus(g, { color: '#FFD45C', metal: 0.6, rough: 0.35 }, t.r * 0.98, 0.035, 4, 16, null, [0, -0.2, 0], [Math.PI / 2, 0, 0]);
    box(g, { color: '#FFD45C', metal: 0.6, rough: 0.35 }, 0.05, t.r * 0.9, 0.06, [0, 0.0, t.r * 0.52], [-0.6, 0, 0]);
    for (let i = 0; i < 4; i++) ball(g, '#E5484D', 0.09, [0, t.r * 0.72 + i * 0.03, -0.08 - i * 0.1], [0.6, 1, 1.2]);
  },
  cape(A, color) {
    const p = A.anchor.back.parent;
    const g = grp(p, [0, 0.82, -0.26], [0.18, 0, 0]);
    const geo = new THREE.CylinderGeometry(0.34, 0.55, 0.78, 10, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    place(new THREE.Mesh(geo, M({ color, double: true })), g, [0, -0.39, 0.12], [0, Math.PI, 0]);
    torus(g, '#FFD45C', 0.33, 0.03, 4, 12, Math.PI, [0, 0.02, 0.13], [Math.PI / 2, 0, 0]);
    A.cape = g;
  },
  shield(A) {
    const g = hand(A, -1);
    const s = grp(g, [0, 0.02, 0.12]);
    cyl(s, '#7CC4FF', 0.2, 0.2, 0.05, 8, [0, 0, 0], [Math.PI / 2, 0, 0]);
    torus(s, '#FFD45C', 0.2, 0.025, 4, 8, null, [0, 0, 0]);
    box(s, '#FFFFFF', 0.06, 0.24, 0.02, [0, 0, 0.03]); box(s, '#FFFFFF', 0.24, 0.06, 0.02, [0, 0, 0.03]);
  },
  crown(A) {
    const t = A.anchor.top, g = at(A, 'top');
    const gold = { color: '#FFD45C', metal: 0.7, rough: 0.25, emissive: '#7A5200', ei: 0.2 };
    cyl(g, gold, 0.24, 0.22, 0.13, 10, [0, 0.0, 0], null, null, true);
    g.children[0].material = M({ ...gold, double: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cone(g, gold, 0.06, 0.16, 4, [Math.cos(a) * 0.22, 0.13, Math.sin(a) * 0.22]);
      ball(g, ['#FF6FA8', '#6FD0FF', '#9DFF8F', '#C08FFF', '#FF9F5A'][i], 0.035, [Math.cos(a) * 0.23, 0.02, Math.sin(a) * 0.23], [1, 1, 1], { smooth: true });
    }
    g.rotation.z = 0.12;
  },
  starWand(A) {
    raiseArm(A, 1, 0.9);
    const g = hand(A, 1);
    cyl(g, '#FFF3C2', 0.018, 0.018, 0.4, 5, [0, 0.14, 0]);
    const st = star(g, { color: '#FFE27A', emissive: '#FFC93C', ei: 0.5 }, 0.12, 0.05, [0, 0.38, 0]);
    A.spin.push(st);
  },
  detectiveHat(A) {
    const t = A.anchor.top, g = at(A, 'top');
    dome(g, '#A47E5C', t.r * 0.82, [0, -0.1, 0], [1, 0.75, 1.05]);
    for (const s of [-1, 1]) cone(g, '#8F6B4B', 0.16, 0.05, 6, [0, -0.1, s * t.r * 0.86], [s * Math.PI / 2, 0, 0], [1.4, 1, 1]);
    for (const s of [-1, 1]) ball(g, '#8F6B4B', 0.1, [s * t.r * 0.75, -0.18, 0], [0.4, 1, 0.8]);
    ball(g, '#6B4F38', 0.04, [0, t.r * 0.6 - 0.1, 0]);
  },
  bowtie(A) {
    const a = A.anchor.neck, g = grp(a.parent, [a.pos[0], a.pos[1] - 0.02, a.r * 0.95]);
    for (const s of [-1, 1]) cone(g, '#6B4F38', 0.07, 0.13, 4, [s * 0.065, 0, 0], [0, 0, (s * Math.PI) / 2], [1, 1, 0.5]);
    ball(g, '#4A3528', 0.035, [0, 0, 0.01]);
  },
  magnifier(A) {
    raiseArm(A, 1, 0.8);
    const g = hand(A, 1);
    cyl(g, '#6B4F38', 0.025, 0.025, 0.2, 5, [0, 0.05, 0]);
    torus(g, '#FFD45C', 0.11, 0.022, 5, 14, null, [0, 0.27, 0.02]);
    ball(g, { color: '#CDEBFF', opacity: 0.45 }, 0.1, [0, 0.27, 0.02], [1, 1, 0.12], { smooth: true });
  },
  wizardHat(A) {
    const t = A.anchor.top, g = at(A, 'top');
    cyl(g, '#6E5BC8', t.r * 1.2, t.r * 1.2, 0.04, 14, [0, -0.06, 0]);
    const tip = grp(g, [0, -0.04, 0], [0, 0, -0.12]);
    cone(tip, '#6E5BC8', t.r * 0.62, 0.55, 10, [0, 0.27, 0]);
    torus(g, '#FFD45C', t.r * 0.6, 0.03, 4, 14, null, [0, 0.0, 0], [Math.PI / 2, 0, 0]);
    star(tip, { color: '#FFE27A', emissive: '#FFC93C', ei: 0.4 }, 0.06, 0.02, [0.05, 0.22, t.r * 0.42], [0, 0, 0.2]);
    star(tip, { color: '#FFE27A', emissive: '#FFC93C', ei: 0.4 }, 0.04, 0.02, [-0.06, 0.38, t.r * 0.25], [0, 0, -0.3]);
  },
  sailorCap(A) {
    const t = A.anchor.top, g = at(A, 'top');
    cyl(g, '#FFFFFF', t.r * 0.5, t.r * 0.55, 0.16, 12, [0, 0.0, 0]);
    torus(g, '#3D5A99', t.r * 0.53, 0.035, 4, 14, null, [0, -0.04, 0], [Math.PI / 2, 0, 0]);
    g.rotation.z = -0.25;
  },
  neckerchief(A) {
    const a = A.anchor.neck, g = at(A, 'neck');
    torus(g, '#3D5A99', a.r * 0.95, 0.05, 5, 14, null, [0, 0, 0], [Math.PI / 2, 0, 0]);
    cone(g, '#3D5A99', 0.17, 0.25, 3, [0, -0.15, a.r * 0.82], [Math.PI, 0, 0], [1, 1, 0.3]);
    ball(g, '#E5484D', 0.06, [0, -0.03, a.r * 0.95]);
  },
  partyHat(A) {
    const g = at(A, 'top');
    const c = place(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 10), M({ color: '#FF9EC1' })), g, [0, 0.17, 0]);
    for (let i = 0; i < 3; i++) torus(g, ['#FFE27A', '#7CC4FF', '#9FE3C8'][i], 0.17 - i * 0.05, 0.022, 4, 12, null, [0, 0.04 + i * 0.11, 0], [Math.PI / 2, 0, 0]);
    ball(g, '#FFE27A', 0.06, [0, 0.4, 0]);
    g.rotation.z = -0.2; void c;
  },
  balloon(A) {
    raiseArm(A, 1, 1.0);
    const g = hand(A, 1, 0.35);
    cyl(g, '#FFFFFF', 0.007, 0.007, 1.15, 3, [0, 0.57, 0]);
    const b = grp(g, [0, 1.3, 0]);
    ball(b, { color: '#FF6B7A', rough: 0.35 }, 0.22, [0, 0, 0], [1, 1.15, 1], { detail: 2 });
    ball(b, '#FFFFFF', 0.05, [-0.07, 0.09, 0.17], [1, 1.3, 0.5], { smooth: true });
    cone(b, '#FF6B7A', 0.04, 0.05, 5, [0, -0.26, 0], [Math.PI, 0, 0]);
    A.balloon = b;
  },
  explorerHat(A) {
    const t = A.anchor.top, g = at(A, 'top');
    dome(g, '#E9D3A4', t.r * 0.82, [0, -0.08, 0], [1, 0.85, 1]);
    cyl(g, '#E9D3A4', t.r * 1.15, t.r * 1.15, 0.03, 14, [0, -0.08, 0]);
    torus(g, '#8A6A48', t.r * 0.8, 0.03, 4, 14, null, [0, -0.04, 0], [Math.PI / 2, 0, 0]);
  },
  binoculars(A) {
    const a = A.anchor.neck, g = at(A, 'neck');
    torus(g, '#6B4F38', a.r * 0.95, 0.02, 4, 14, null, [0, 0, 0], [Math.PI / 2 + 0.3, 0, 0]);
    for (const s of [-1, 1]) { cyl(g, '#4A4458', 0.05, 0.055, 0.14, 8, [s * 0.065, -0.2, a.r * 0.95 + 0.02], [Math.PI / 2, 0, 0]); ball(g, '#9FD8FF', 0.035, [s * 0.065, -0.2, a.r * 0.95 + 0.09], [1, 1, 0.3], { smooth: true }); }
  },
  map(A) {
    const g = hand(A, -1);
    box(g, '#FFF1C9', 0.26, 0.2, 0.012, [0, 0.05, 0.08], [-0.3, 0, 0.1]);
    box(g, '#E5484D', 0.03, 0.03, 0.014, [0.05, 0.08, 0.085], [-0.3, 0, 0.1]);
  },
  chefHat(A) {
    const t = A.anchor.top, g = at(A, 'top');
    cyl(g, '#FFFFFF', t.r * 0.55, t.r * 0.55, 0.18, 12, [0, 0.03, 0]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ball(g, '#FFFFFF', 0.15, [Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12]); }
    ball(g, '#FFFFFF', 0.17, [0, 0.27, 0]);
  },
  apron(A) {
    const b = A.anchor.belly, g = grp(b.parent, b.pos);
    ball(g, '#FFFFFF', 0.28, [0, -0.02, -0.08], [1, 1.1, 0.35]);
    box(g, '#FFB3CC', 0.14, 0.08, 0.02, [0, -0.05, 0.02]);
  },
  spatula(A) {
    raiseArm(A, 1, 0.8);
    const g = hand(A, 1);
    cyl(g, '#8A6A55', 0.02, 0.02, 0.28, 5, [0, 0.1, 0]);
    box(g, { color: '#DDE3EE', metal: 0.5, rough: 0.35 }, 0.14, 0.16, 0.02, [0, 0.32, 0]);
  },
  towel(A) {
    const g = at(A, 'top');
    box(g, '#FFFFFF', 0.3, 0.07, 0.24, [0, 0.0, 0], [0, 0.2, 0.08]);
    box(g, '#9FD8FF', 0.3, 0.075, 0.04, [0, 0.0, 0.06], [0, 0.2, 0.08]);
  },
  bucket(A) {
    const g = hand(A, -1);
    cyl(g, '#C99A6B', 0.13, 0.11, 0.16, 10, [0, 0.03, 0.08]);
    for (const y of [-0.02, 0.08]) torus(g, '#7A5A40', 0.125, 0.012, 4, 12, null, [0, y, 0.08], [Math.PI / 2, 0, 0]);
    cyl(g, '#9FD8FF', 0.115, 0.115, 0.01, 10, [0, 0.105, 0.08]);
  },
  spaceHelmet(A) {
    const H = A.H;
    ball(A.head, { color: '#DDF2FF', opacity: 0.28, rough: 0.05, metal: 0.2 }, 1, [0, H.cy + 0.08, 0.03], [H.rx * 1.18, H.ry * 0.95, H.rz * 1.25], { smooth: true });
    torus(A.head, { color: '#DDE3EE', metal: 0.5, rough: 0.35 }, H.rx * 0.95, 0.06, 6, 18, null, [0, H.cy - 0.3, 0], [Math.PI / 2, 0, 0]);
    ball(A.head, '#FF6B7A', 0.04, [H.rx * 0.6, H.cy + 0.55, 0], [1, 1, 1], { smooth: true });
    cyl(A.head, '#DDE3EE', 0.01, 0.01, 0.15, 4, [H.rx * 0.6, H.cy + 0.47, 0]);
  },
  jetpack(A) {
    const g = at(A, 'back');
    for (const s of [-1, 1]) {
      cyl(g, { color: '#DDE3EE', metal: 0.5, rough: 0.35 }, 0.1, 0.1, 0.4, 8, [s * 0.12, 0, -0.06]);
      cone(g, '#FF6B7A', 0.1, 0.12, 8, [s * 0.12, 0.26, -0.06]);
      const f = cone(g, { color: '#FFB347', emissive: '#FF8A00', ei: 0.8 }, 0.07, 0.18, 6, [s * 0.12, -0.3, -0.06], [Math.PI, 0, 0]);
      (A.flames = A.flames || []).push(f);
    }
  },
};

/* =========================================================
   傳說變身
   ========================================================= */
const GOLD = { color: '#FFD45C', metal: 0.75, rough: 0.28, emissive: '#B57E00', ei: 0.25 };
const FORMS = {
  ninetail() {
    const A = SP.fox({ fur: '#FFF6FB', white: '#FFFFFF', tip: '#9FC8FF', noTail: true });
    ball(A.head, '#FF7FB2', 0.04, [0, A.H.cy + 0.26, surfZ(A.H, 0, A.H.cy + 0.26) - 0.01], [0.8, 1.5, 0.4], { smooth: true });
    for (let i = 0; i < 9; i++) {
      const a = ((i - 4) / 4) * 1.1;
      const t = grp(A.anchor.tail.parent, A.anchor.tail.pos, [-0.4, 0, a]);
      t.userData.fan = a;
      ball(t, '#FFF6FB', 0.13, [0, 0.36, 0], [0.8, 2.7, 0.8]);
      ball(t, { color: '#A8D4FF', emissive: '#6FB4FF', ei: 0.6 }, 0.1, [0, 0.74, 0], [0.9, 1.2, 0.9]);
      A.tails.push(t);
    }
    return A;
  },
  lucky() {
    const keep = ['#4A2E3A', '#C9B9C6', '#FF8FA8', '#FFC2D4'];
    PAINT = (c) => (keep.includes(c) ? null : GOLD);
    const A = SP.cat({ fur: '#FFD45C', orange: '#FFD45C', black: '#FFD45C' });
    PAINT = null;
    ACC.bell(A);
    raiseArm(A, 1, 2.6);
    A.wave = A.arms[1];
    const g = hand(A, -1);
    cyl(g, { color: '#FFE58A', metal: 0.8, rough: 0.2, emissive: '#B57E00', ei: 0.3 }, 0.12, 0.12, 0.035, 12, [0, 0.05, 0.12], [Math.PI / 2, 0, 0]);
    return A;
  },
  angel() {
    const A = SP.rabbit({});
    const g = at(A, 'back');
    for (const s of [-1, 1]) {
      const w = grp(g, [s * 0.1, 0.2, 0], [0, -s * 0.35, 0]);
      for (let i = 0; i < 5; i++) ball(w, i % 2 ? '#EEF4FF' : '#FFFFFF', 0.16 - i * 0.015, [s * (0.14 + i * 0.12), 0.1 + i * 0.09 - (i > 2 ? 0.08 : 0), 0], [1.7, 0.55, 0.35], { rot: [0, 0, s * (0.55 - i * 0.12)] });
      w.userData.s = s; A.wings.push(w);
    }
    const halo = torus(A.anchor.top.parent, { color: '#FFF2A0', emissive: '#FFD84A', ei: 0.9 }, 0.22, 0.03, 6, 20, null, [0, A.anchor.top.pos[1] + 0.48, -0.02], [Math.PI / 2, 0, 0]);
    A.halo = halo;
    return A;
  },
  unicorn() {
    const A = SP.sheep({ rainbow: true, face: '#FFF0F6' });
    const g = at(A, 'top');
    const h = cone(g, { color: '#FFE58A', metal: 0.5, rough: 0.3, emissive: '#FFC93C', ei: 0.3 }, 0.07, 0.34, 6, [0, 0.2, 0.14], [0.35, 0, 0]);
    for (let i = 0; i < 3; i++) torus(h, '#FFFFFF', 0.055 - i * 0.015, 0.008, 3, 8, null, [0, -0.08 + i * 0.08, 0], [Math.PI / 2, 0, 0]);
    return A;
  },
  galaxy() {
    const A = SP.penguin({ back: { color: '#2E2A6B', emissive: '#4B3BB8', ei: 0.45 }, belly: { color: '#E8E0FF', emissive: '#B9A8FF', ei: 0.2 } });
    const orbit = grp(A.root, [0, 0.95, 0], [0.35, 0, 0.2]);
    torus(orbit, { color: '#FFE58A', emissive: '#FFC93C', ei: 0.5 }, 0.85, 0.012, 3, 40);
    for (const [r, a, col] of [[0.09, 0, '#FF9EC1'], [0.06, 2.2, '#9FE3C8'], [0.07, 4.1, '#AEDBFF']]) ball(orbit, { color: col, emissive: col, ei: 0.35 }, r, [Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85], [1, 1, 1], { detail: 1 });
    A.spin.push(orbit); orbit.userData.axis = 'z';
    return A;
  },
};

/* =========================================================
   粒子、光暈
   ========================================================= */
const texCache = {};
function canvasTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'star') {
    g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 9 : 30, a = (i * Math.PI) / 4 - Math.PI / 2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache[kind] = t; return t;
}
const FX = {
  sparkle: { cols: ['#FFFFFF', '#FFE27A', '#FFB3D9'], tex: 'star', size: 0.12, n: 26 },
  steam: { cols: ['#FFFFFF', '#F2F6FB'], tex: 'glow', size: 0.28, n: 14, rise: true, r: 0.35 },
  ninetail: { cols: ['#9FC8FF', '#6FB4FF', '#FFFFFF'], tex: 'glow', size: 0.2, n: 30 },
  lucky: { cols: ['#FFE27A', '#FFC93C', '#FFF6C8'], tex: 'star', size: 0.16, n: 36 },
  angel: { cols: ['#FFFFFF', '#FFF6D8', '#FFE0F0'], tex: 'glow', size: 0.16, n: 34 },
  unicorn: { cols: ['#FF9EC1', '#FFE27A', '#9FE3C8', '#AEDBFF', '#C9A8FF'], tex: 'star', size: 0.15, n: 42 },
  galaxy: { cols: ['#FFFFFF', '#B9A8FF', '#7FC9FF'], tex: 'star', size: 0.13, n: 50 },
};
function makeParticles(kind) {
  const f = FX[kind]; if (!f) return null;
  const n = f.n, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    seed.push({ a: Math.random() * Math.PI * 2, r: (f.r ?? 0.9) + Math.random() * (f.r ? 0.15 : 0.7), y: Math.random() * 2.3, s: 0.15 + Math.random() * 0.35 });
    c.set(f.cols[i % f.cols.length]); col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: f.size, map: canvasTex(f.tex), vertexColors: true, transparent: true, depthWrite: false, blending: f.rise ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: f.rise ? 0.6 : 1 });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = (t) => {
    for (let i = 0; i < n; i++) {
      const s = seed[i];
      const y = f.rise ? 1.55 + ((s.y * 0.3 + t * s.s * 0.8) % 0.8) : (s.y + t * s.s) % 2.3;
      const a = s.a + t * (f.rise ? 0.1 : 0.3);
      pos[i * 3] = Math.cos(a) * s.r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * s.r * (f.rise ? 0.6 : 1);
    }
    geo.attributes.position.needsUpdate = true;
  };
  pts.userData.update(0);
  return pts;
}
function makeGlow(color, opacity) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex('glow'), color, transparent: true, depthWrite: false, opacity }));
  sp.scale.set(3.4, 3.4, 1); sp.position.set(0, 1, -0.7);
  return sp;
}
const RARITY_COLOR = { common: '#BFC3D9', rare: '#7CC4FF', epic: '#B48CFF', legend: '#FFC93C' };

/* =========================================================
   組裝 + 動畫
   ========================================================= */
export function buildLowPoly(id, { particles = true } = {}) {
  const e = LP_BY_ID[id];
  if (!e) throw new Error('unknown animal ' + id);
  const A = e.form ? FORMS[e.form]() : SP[e.sp]({});
  for (const a of e.acc) {
    const [name, arg] = a.split(':');
    ACC[name](A, arg);
  }
  const pivot = new THREE.Group();
  pivot.add(A.root);
  // 大小統一：高度約 2
  pivot.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(A.root);
  const sz = bb.getSize(new THREE.Vector3());
  const k = Math.min(2 / Math.max(sz.y, 0.1), 2.5 / Math.max(sz.x, 0.1));
  A.root.scale.setScalar(k);
  A.root.position.y = -bb.min.y * k;

  const extras = [];
  if (particles && e.fx) { const p = makeParticles(e.fx); if (p) { pivot.add(p); extras.push(p); } }
  if (e.rarity === 'epic' || e.rarity === 'legend') pivot.add(makeGlow(RARITY_COLOR[e.rarity], e.rarity === 'legend' ? 0.6 : 0.4));

  let happyT = -1, nextBlink = 1.5 + Math.random() * 2, blinkT = -1, nextSpecial = 4;
  const update = (dt, t) => {
    // 呼吸
    A.body.scale.y = 1 + Math.sin(t * 2.4) * 0.02;
    A.head.rotation.z = Math.sin(t * 0.9) * 0.05;
    A.head.rotation.x = Math.sin(t * 0.7) * 0.03;
    // 耳朵、尾巴、手
    for (const ear of A.ears) ear.rotation.z = ear.userData.base + Math.sin(t * 3 + ear.userData.s) * 0.06 + (Math.sin(t * 0.8) > 0.97 ? ear.userData.s * 0.2 : 0);
    for (const tl of A.tails) {
      if (tl.userData.fan !== undefined) tl.rotation.z = tl.userData.fan * (1 + Math.sin(t * 1.5) * 0.12) + Math.sin(t * 2 + tl.userData.fan * 2) * 0.06;
      else tl.rotation.y = Math.sin(t * 5) * 0.4;
    }
    for (const arm of A.arms) arm.rotation.z = arm.userData.base + Math.sin(t * 2 + arm.userData.s) * 0.06;
    if (A.wave) A.wave.rotation.z = A.wave.userData.base + Math.sin(t * 6) * 0.3;
    for (const w of A.wings) w.rotation.y = -w.userData.s * (0.35 + Math.sin(t * 4) * 0.3);
    for (const s of A.spin) s.rotation[s.userData.axis || 'y'] = t * (s.userData.axis ? 0.8 : 1.5);
    if (A.halo) A.halo.position.y += Math.sin(t * 2) * 0.0008;
    if (A.balloon) A.balloon.rotation.z = Math.sin(t * 1.3) * 0.12;
    if (A.cape) A.cape.rotation.x = 0.18 + Math.sin(t * 2.2) * 0.06;
    if (A.flames) A.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 20 + i) * 0.25; });
    if (A.wool && e.form === 'unicorn') A.wool.forEach((w) => w.material.color.setHSL((w.userData.hue + t * 0.08) % 1, 0.85, 0.78));
    // 眨眼
    if (blinkT < 0 && t > nextBlink) { blinkT = 0; nextBlink = t + 2.5 + Math.random() * 3; }
    if (blinkT >= 0) {
      blinkT += dt;
      const sq = blinkT < 0.07 ? 1 - blinkT / 0.07 : blinkT < 0.14 ? (blinkT - 0.07) / 0.07 : 1;
      for (const ey of A.eyes) if (!ey.userData.hl) ey.scale.y = ey.userData.sy * Math.max(0.08, sq); else ey.visible = sq > 0.6;
      if (blinkT > 0.14) blinkT = -1;
    }
    // 史詩／傳說：每隔幾秒跳一下轉一圈
    let hop = 0, spin = 0;
    if ((e.rarity === 'epic' || e.rarity === 'legend') && happyT < 0 && t > nextSpecial) { happyT = 0; nextSpecial = t + 7; }
    if (happyT >= 0) {
      happyT += dt;
      const p = happyT;
      hop = Math.abs(Math.sin(p * 7)) * 0.25 * Math.max(0, 1 - p / 1.6);
      spin = p < 1.2 ? (p / 1.2) * Math.PI * 2 : 0;
      for (const arm of A.arms) if (arm !== A.wave) arm.rotation.z = arm.userData.base + arm.userData.s * Math.sin(Math.min(p, 1.6) / 1.6 * Math.PI) * 1.2;
      if (p > 1.6) happyT = -1;
    }
    A.root.position.y = -bb.min.y * k + hop;
    A.root.rotation.y = spin;
    for (const x of extras) x.userData.update(t);
  };
  const dispose = () => {
    pivot.traverse((o) => {
      if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose();
      if (o.material && o.material.userData?.unique) o.material.dispose();
    });
  };
  update(0, 0);
  return {
    entry: e, pivot, update, dispose,
    playHappy: () => { happyT = 0; }, playIdle: () => {},
  };
}
