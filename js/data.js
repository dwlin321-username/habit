// 資料層：存檔、日期、動物圖鑑、抽獎規則
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

/* ---------- 稀有度與圖鑑 ---------- */
export const RARITY = {
  common: { label: '普通', color: '#bfc3d9', shards: 1, order: 0 },
  rare: { label: '稀有', color: '#7cc4ff', shards: 3, order: 1 },
  epic: { label: '史詩', color: '#b48cff', shards: 9, order: 2 },
  legend: { label: '傳說', color: '#ffc93c', shards: 9, order: 3 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legend'];

export const SPECIES = {
  panda: '熊貓噗噗', penguin: '企鵝啾啾', chicken: '小雞嗶嗶', pig: '小豬嚕嚕',
  bee: '蜜蜂嗡嗡', crab: '螃蟹夾夾', bat: '蝙蝠啪啪', deer: '小鹿角角',
  yeti: '雪怪毛毛', yellowdragon: '小龍噴噴', cthulhu: '章魚觸觸', ghost: '幽靈飄飄',
  mushroom: '蘑菇菇菇', cactus: '仙人掌刺刺', alien: '外星咕咕', alien_tall: '外星長長',
  cyclops: '獨眼眨眨', greendemon: '小角綠綠',
};
const short = (sp) => SPECIES[sp].slice(-2); // 例如「噗噗」

const TINTS = {
  sakura: ['櫻花', '#ffb3cf'], mint: ['薄荷', '#9ff0cf'], lemon: ['檸檬', '#fff08a'],
  lavender: ['薰衣草', '#d2bcff'], sky: ['天空', '#a6dbff'], peach: ['蜜桃', '#ffc4a3'],
};
const ACC_NAME = { crown: '皇冠', party: '派對帽', bow: '蝴蝶結', flower: '小花', halo: '天使' };

function buildCatalog() {
  const list = [];
  for (const sp of Object.keys(SPECIES)) {
    list.push({ id: sp, sp, rarity: 'common', name: SPECIES[sp] });
  }
  const rare = [
    ['panda', 'sakura'], ['penguin', 'sky'], ['chicken', 'peach'], ['pig', 'lavender'],
    ['bee', 'mint'], ['crab', 'lemon'], ['bat', 'lavender'], ['deer', 'sakura'],
    ['yeti', 'mint'], ['ghost', 'sky'], ['mushroom', 'peach'], ['cactus', 'sakura'],
  ];
  for (const [sp, t] of rare) {
    list.push({ id: `${sp}_${t}`, sp, rarity: 'rare', name: `${TINTS[t][0]}${short(sp)}`, tint: TINTS[t][1] });
  }
  const epic = [
    ['panda', 'crown', 'sakura'], ['penguin', 'party', 'sky'], ['chicken', 'bow', 'lemon'],
    ['pig', 'flower', 'peach'], ['yellowdragon', 'crown', 'mint'], ['cthulhu', 'party', 'lavender'],
    ['alien', 'halo', 'mint'], ['cyclops', 'bow', 'sakura'],
  ];
  for (const [sp, acc, t] of epic) {
    list.push({
      id: `${sp}_${acc}`, sp, rarity: 'epic', name: `${ACC_NAME[acc]}${short(sp)}`,
      tint: TINTS[t][1], acc, fx: 'sparkle',
    });
  }
  const legend = [
    ['yellowdragon', 'gold', '黃金神龍', 'crown'],
    ['panda', 'rainbow', '彩虹噗噗', 'halo'],
    ['ghost', 'galaxy', '星空飄飄', 'crown'],
    ['yeti', 'diamond', '鑽石毛毛', 'crown'],
    ['penguin', 'aurora', '極光啾啾', 'halo'],
    ['deer', 'sakura', '櫻吹雪角角', 'flower'],
  ];
  for (const [sp, fx, name, acc] of legend) {
    list.push({ id: `legend_${sp}`, sp, rarity: 'legend', name, fx, acc });
  }
  // 防呆：確認沒有重複的 id
  const ids = new Set(list.map((e) => e.id));
  if (ids.size !== list.length) console.error('圖鑑 id 重複');
  return list;
}
export const CATALOG = buildCatalog();
export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e]));

/* ---------- 貼紙 ---------- */
export const STICKERS = ['💖', '⭐', '🌈', '🍓', '🧁', '🍩', '🌸', '🍀', '🦄', '🍰', '🍭', '🌟',
  '🎀', '🍑', '🍒', '🌻', '🍪', '🍦', '🌙', '🎈', '🍉', '🐾', '🫧', '🍬', '🌷', '🥞', '🍡', '🪐'];

/* ---------- 存檔 ---------- */
export function defaultState() {
  return {
    version: 1,
    tasks: {},        // id -> task
    days: {},         // 'YYYY-MM-DD' -> { plan: [taskId], when: {taskId: {preset,time}}, where: {taskId: ''}, planned, completed: [], sticker, reviewed }
    collection: {},   // entryId -> { count, at }
    shards: 0,
    legend: { count: 0, granted: 0 }, // 累計完成的 3⭐ 任務數、已發放的傳說數
    favorite: null,
    lastBackup: 0,
    createdAt: Date.now(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('讀取資料失敗', e);
    return defaultState();
  }
}
function migrate(s) {
  const d = defaultState();
  return { ...d, ...s, legend: { ...d.legend, ...(s.legend || {}) } };
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
    state.days[key] = { plan: [], when: {}, where: {}, planned: false, completed: [], sticker: null, reviewed: false };
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

  let sticker = null;
  if (!day.sticker) {
    sticker = STICKERS[Math.floor(rng() * STICKERS.length)];
    day.sticker = sticker;
  }
  saveState(state);
  return { rewards, sticker, snapshot, task };
}

export function ownedCount(state, rarity) {
  return CATALOG.filter((e) => (!rarity || e.rarity === rarity) && state.collection[e.id]).length;
}
