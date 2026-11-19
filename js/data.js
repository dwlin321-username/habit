// 資料層：存檔、日期、動物圖鑑、抽獎規則、每日習慣
// 所有資料存在 localStorage（瀏覽器內建的小型儲存空間），關掉 App 也會保留。

export const STORAGE_KEY = 'ypym-data-v1';

/* ---------- 日期工具 ---------- */
// 「一天」從凌晨 4 點開始算：熬夜到 2 點仍算前一天
export const DAY_START_HOUR = 4;
const pad = (n) => String(n).padStart(2, '0');
export function dayKey(d = new Date()) {
  const t = new Date(d.getTime() - DAY_START_HOUR * 3600e3);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function daysBetween(fromKey, toKey) {
  return Math.round((keyToDate(toKey) - keyToDate(fromKey)) / 86400e3);
}
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export function prettyDay(key) {
  const d = keyToDate(key);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEK[d.getDay()]}）`;
}
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- 何時 ---------- */
export const WHEN_PRESETS = [
  { id: 'morning', label: '🌅 早上', time: '09:00' },
  { id: 'noon', label: '🍱 中午', time: '12:00' },
  { id: 'afternoon', label: '☕ 下午', time: '15:00' },
  { id: 'evening', label: '🌙 晚上', time: '20:00' },
];
export function whenLabel(when) {
  if (!when) return '';
  const p = WHEN_PRESETS.find((x) => x.id === when.preset);
  return p ? `${p.label} ${when.time}` : `⏰ ${when.time}`;
}

/* ---------- 稀有度與圖鑑（低多邊形動物） ---------- */
export const RARITY = {
  common: { label: '普通', color: '#bfc3d9', shards: 1, order: 0 },
  rare: { label: '稀有', color: '#7cc4ff', shards: 3, order: 1 },
  epic: { label: '史詩', color: '#b48cff', shards: 9, order: 2 },
  legend: { label: '傳說', color: '#ffc93c', shards: 9, order: 3 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legend'];

export const SPECIES = {
  shiba: '柴犬', pom: '白色狐狸犬', cat: '三花貓', rabbit: '白兔', panda: '熊貓', bear: '小熊',
  pig: '小豬', chick: '小雞', penguin: '企鵝', fox: '狐狸', frog: '青蛙',
  hamster: '倉鼠', koala: '無尾熊', sheep: '綿羊', cow: '乳牛', owl: '貓頭鷹',
  duck: '鴨鴨', hedgehog: '刺蝟', seal: '海豹', turtle: '烏龜', capybara: '水豚',
};
// 稀有：普通版 + 1 個招牌配件
const RARE = [
  ['shiba', '圍巾柴犬', ['scarf']], ['pom', '蝴蝶結狐狸犬', ['bow:#E5484D']], ['cat', '蝴蝶結貓咪', ['bow']],
  ['rabbit', '草莓帽兔兔', ['strawberryHat']], ['panda', '竹子熊貓', ['bamboo']], ['bear', '蜂蜜小熊', ['honey']],
  ['pig', '花圈小豬', ['flowerCrown']], ['chick', '蛋殼小雞', ['eggshell']], ['penguin', '毛帽企鵝', ['beanie']],
  ['fox', '眼鏡狐狸', ['glasses']], ['frog', '荷葉青蛙', ['lotus']], ['hamster', '瓜子倉鼠', ['seed']],
  ['koala', '樹葉無尾熊', ['eucalyptus']], ['sheep', '鈴鐺綿羊', ['bell']], ['cow', '草帽乳牛', ['strawHat']],
  ['capybara', '柚子水豚', ['yuzu']],
];
// 史詩：整套造型 + 閃亮粒子
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
// 傳說：神獸變身
const LEGEND = [
  ['fox', '九尾仙狐', 'ninetail'], ['cat', '黃金招財貓', 'lucky'], ['rabbit', '天使兔兔', 'angel'],
  ['sheep', '彩虹獨角羊', 'unicorn'], ['penguin', '星空企鵝', 'galaxy'],
];
export const CATALOG = [
  ...Object.entries(SPECIES).map(([sp, name]) => ({ id: sp, sp, rarity: 'common', name, acc: [] })),
  ...RARE.map(([sp, name, acc]) => ({ id: `${sp}_r`, sp, rarity: 'rare', name, acc })),
  ...EPIC.map(([sp, name, acc, fx]) => ({ id: `${sp}_e`, sp, rarity: 'epic', name, acc, fx: fx || 'sparkle' })),
  ...LEGEND.map(([sp, name, form]) => ({ id: `${sp}_l`, sp, rarity: 'legend', name, acc: [], form, fx: form })),
];
export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e]));

/* ---------- 習慣貼紙 ---------- */
export const WATER_STICKERS = ['💧', '🐳', '🫧', '🌊', '🐬', '🧊', '🥤', '🐟', '🍉', '🍋', '🦭', '🐙', '🫐', '🌧️', '🐠', '🧋'];
export const EXERCISE_STICKERS = ['💪', '🔥', '🏅', '⚡', '🌟', '🏃', '🚴', '🧘', '🏸', '⚽', '🏀', '🎽', '🥇', '🌈', '🤸', '🏊'];
export const EXERCISE_IDEAS = ['散步', '跑步', '瑜伽', '重訓', '跳繩', '騎腳踏車', '游泳', '伸展'];

/* ---------- 存檔 ---------- */
export function defaultHabits() {
  return { waterGoal: 1000, exFavs: [...EXERCISE_IDEAS], water: {}, exercise: {} };
}
export function defaultState() {
  return {
    version: 2,
    tasks: {},        // id -> task
    days: {},         // 'YYYY-MM-DD' -> { plan: [taskId], when: {taskId: {preset,time}}, where: {taskId: ''}, planned, completed: [] }
    collection: {},   // entryId -> { count, at }
    shards: 0,
    legend: { count: 0, granted: 0 }, // 累計完成的 3⭐ 任務數、已發放的傳說數
    favorite: null,
    lastBackup: 0,
    habits: defaultHabits(),
    createdAt: Date.now(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = migrate(JSON.parse(raw));
    return s;
  } catch (e) {
    console.warn('讀取資料失敗', e);
    return defaultState();
  }
}

// 舊版（第一版 3D 模型）動物的稀有度
function oldRarity(id) {
  if (id.startsWith('legend_')) return 'legend';
  if (/_(crown|party|bow|flower|halo)$/.test(id)) return 'epic';
  if (/_(sakura|mint|lemon|lavender|sky|peach)$/.test(id)) return 'rare';
  return 'common';
}
// 舊動物換成同稀有度的新動物（優先換到還沒擁有的）
function migrateAnimals(s) {
  const map = {};
  const old = Object.keys(s.collection || {}).filter((id) => !CATALOG_BY_ID[id]);
  if (!old.length) return;
  const next = {};
  for (const [id, v] of Object.entries(s.collection)) if (CATALOG_BY_ID[id]) next[id] = { ...v };
  for (const id of old) {
    const r = oldRarity(id);
    const pool = CATALOG.filter((e) => e.rarity === r);
    const free = pool.filter((e) => !next[e.id]);
    const pickFrom = free.length ? free : pool;
    const e = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    map[id] = e.id;
    if (next[e.id]) next[e.id].count += s.collection[id].count;
    else next[e.id] = { ...s.collection[id] };
  }
  s.collection = next;
  if (s.favorite && map[s.favorite]) s.favorite = map[s.favorite];
  for (const day of Object.values(s.days || {})) {
    for (const c of day.completed || []) if (map[c.entryId]) c.entryId = map[c.entryId];
  }
}
function migrate(s) {
  const d = defaultState();
  const out = { ...d, ...s, legend: { ...d.legend, ...(s.legend || {}) }, habits: { ...defaultHabits(), ...(s.habits || {}) } };
  migrateAnimals(out);
  if (out.favorite && !out.collection[out.favorite]) out.favorite = Object.keys(out.collection)[0] || null;
  out.version = 2;
  return out;
}
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('儲存失敗', e);
    return false;
  }
}
export function validateImport(obj) {
  return obj && typeof obj === 'object' && obj.tasks && obj.days && obj.collection;
}
export function importState(obj) {
  return migrate(obj);
}

export function getDay(state, key) {
  if (!state.days[key]) {
    state.days[key] = { plan: [], when: {}, where: {}, planned: false, completed: [], reviewed: false };
  }
  return state.days[key];
}

/* ---------- 任務 ---------- */
export function newTask(fields) {
  return {
    id: uid(),
    title: '',
    type: 'must',       // 'must' 🐸 必須做 / 'want' 🌱 想做
    difficulty: 1,      // 1~3 ⭐
    firstStep: '',
    steps: [],          // [{id, text, done}]
    deadline: '',       // 'YYYY-MM-DD'
    where: '',
    status: 'todo',     // 'todo' | 'done'
    startedAt: 0,
    doneAt: 0,
    postpone: 0,
    createdAt: Date.now(),
    ...fields,
  };
}

/* 找出「之前某天排了但沒完成、也還沒處理」的任務 */
export function pendingFromPast(state, todayKey) {
  const out = [];
  const seen = new Set();
  const keys = Object.keys(state.days).filter((k) => k < todayKey).sort().reverse();
  for (const k of keys) {
    const day = state.days[k];
    for (const id of day.plan) {
      const t = state.tasks[id];
      if (!t || t.status !== 'todo' || seen.has(id)) continue;
      if (day.resolved && day.resolved[id]) continue;
      seen.add(id);
      out.push({ task: t, fromKey: k });
    }
  }
  return out;
}
export function markResolved(state, fromKey, taskId) {
  const day = state.days[fromKey];
  if (!day) return;
  day.resolved = day.resolved || {};
  day.resolved[taskId] = true;
}

/* ---------- 抽獎 ---------- */
// 難度決定稀有度：保底 + 15% 機率升一級；3⭐ 保底史詩並累計傳說進度
export function rarityFor(difficulty, rng = Math.random) {
  if (difficulty >= 3) return 'epic';
  if (difficulty === 2) return rng() < 0.15 ? 'epic' : 'rare';
  return rng() < 0.15 ? 'rare' : 'common';
}

function grant(state, entry) {
  const c = state.collection[entry.id];
  if (c) {
    c.count += 1;
    const shards = RARITY[entry.rarity].shards;
    state.shards += shards;
    return { entry, isNew: false, shards };
  }
  state.collection[entry.id] = { count: 1, at: Date.now() };
  if (!state.favorite) state.favorite = entry.id;
  return { entry, isNew: true, shards: 0 };
}

// 完全隨機抽一隻（可能重複）
export function rollAnimal(state, difficulty, rng = Math.random) {
  const rarity = rarityFor(difficulty, rng);
  const pool = CATALOG.filter((e) => e.rarity === rarity);
  return grant(state, pool[Math.floor(rng() * pool.length)]);
}

// 用碎片兌換：優先給還沒擁有的
export const EXCHANGE = { rare: 3, epic: 9 };
export function exchange(state, rarity, rng = Math.random) {
  const cost = EXCHANGE[rarity];
  if (state.shards < cost) return null;
  state.shards -= cost;
  const all = CATALOG.filter((e) => e.rarity === rarity);
  const unowned = all.filter((e) => !state.collection[e.id]);
  const pool = unowned.length ? unowned : all;
  return grant(state, pool[Math.floor(rng() * pool.length)]);
}

// 每累計完成 5 件 3⭐ 任務，解鎖 1 隻還沒擁有的傳說
export const LEGEND_EVERY = 5;
export function checkLegend(state, rng = Math.random) {
  const earned = Math.floor(state.legend.count / LEGEND_EVERY);
  if (earned <= state.legend.granted) return null;
  state.legend.granted += 1;
  const unowned = CATALOG.filter((e) => e.rarity === 'legend' && !state.collection[e.id]);
  if (!unowned.length) {
    state.shards += RARITY.legend.shards;
    return { entry: null, isNew: false, shards: RARITY.legend.shards, legendAllOwned: true };
  }
  return grant(state, unowned[Math.floor(rng() * unowned.length)]);
}

/* 完成任務：一次處理所有獎勵，並先存檔（就算動畫中途關掉 App，獎勵也不會不見） */
export function completeTask(state, taskId, todayKey, rng = Math.random) {
  const snapshot = JSON.stringify(state);
  const task = state.tasks[taskId];
  if (!task || task.status === 'done') return null;
  task.status = 'done';
  task.doneAt = Date.now();
  if (!task.startedAt) task.startedAt = task.doneAt;

  const rewards = [rollAnimal(state, task.difficulty, rng)];
  if (task.difficulty >= 3) {
    state.legend.count += 1;
    const lg = checkLegend(state, rng);
    if (lg) rewards.push({ ...lg, legendBonus: true });
  }

  const day = getDay(state, todayKey);
  if (!day.plan.includes(taskId)) day.plan.push(taskId);
  day.completed.push({ taskId, title: task.title, entryId: rewards[0].entry.id, at: task.doneAt, difficulty: task.difficulty });
  saveState(state);
  return { rewards, snapshot, task };
}

export function ownedCount(state, rarity) {
  return CATALOG.filter((e) => (!rarity || e.rarity === rarity) && state.collection[e.id]).length;
}

/* =========================================================
   每日習慣：喝水、運動
   完成時在對應月曆的當天格子貼一張貼紙；取消完成時貼紙會拿掉。
   ========================================================= */
const pickSticker = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];

export function waterDay(state, key) {
  return state.habits.water[key] || { logs: [], sticker: null, goal: state.habits.waterGoal };
}
export function waterTotal(state, key) {
  return waterDay(state, key).logs.reduce((a, l) => a + l.ml, 0);
}
export function waterGoalOf(state, key) {
  const d = state.habits.water[key];
  return (d && d.goal) || state.habits.waterGoal;
}
// 依目前喝水量更新貼紙；回傳新得到的貼紙（沒有就回傳 null）
function syncWater(state, key) {
  const d = state.habits.water[key];
  if (!d) return null;
  const done = d.logs.reduce((a, l) => a + l.ml, 0) >= (d.goal || state.habits.waterGoal);
  if (done && !d.sticker) { d.sticker = pickSticker(WATER_STICKERS); return d.sticker; }
  if (!done && d.sticker) d.sticker = null;
  return null;
}
export function addWater(state, key, ml) {
  const h = state.habits;
  if (!h.water[key]) h.water[key] = { logs: [], sticker: null, goal: h.waterGoal };
  h.water[key].logs.push({ ml, at: Date.now() });
  return syncWater(state, key);
}
export function undoWater(state, key) {
  const d = state.habits.water[key];
  if (!d || !d.logs.length) return;
  d.logs.pop();
  syncWater(state, key);
}
export function setWaterGoal(state, ml, todayKey) {
  state.habits.waterGoal = ml;
  // 今天的目標也跟著改；過去的紀錄保持當時的目標
  if (state.habits.water[todayKey]) state.habits.water[todayKey].goal = ml;
  return syncWater(state, todayKey);
}

export function exerciseDay(state, key) {
  return state.habits.exercise[key] || { items: [], sticker: null };
}
function syncExercise(state, key) {
  const d = state.habits.exercise[key];
  if (!d) return null;
  const done = d.items.some((i) => i.done);
  if (done && !d.sticker) { d.sticker = pickSticker(EXERCISE_STICKERS); return d.sticker; }
  if (!done && d.sticker) d.sticker = null;
  return null;
}
export function addExercise(state, key, name) {
  const h = state.habits;
  if (!h.exercise[key]) h.exercise[key] = { items: [], sticker: null };
  h.exercise[key].items.push({ id: uid(), name, done: false });
  return syncExercise(state, key);
}
export function toggleExercise(state, key, id) {
  const d = state.habits.exercise[key];
  const it = d && d.items.find((i) => i.id === id);
  if (!it) return null;
  it.done = !it.done;
  return syncExercise(state, key);
}
export function deleteExercise(state, key, id) {
  const d = state.habits.exercise[key];
  if (!d) return;
  d.items = d.items.filter((i) => i.id !== id);
  syncExercise(state, key);
}
