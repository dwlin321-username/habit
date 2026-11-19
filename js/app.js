// 要拚要猛 — 主程式（畫面與操作）
import * as D from './data.js';

let S = D.loadState();
let today = D.dayKey();
let tab = 'today';
let homeStage = null;
let threeMod = null;
let threeFailed = false;
let plannerShownThisSession = false;
const calState = { y: 0, m: 0, sel: null, mode: 'water' };
const listState = { filter: 'must' };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function save() {
  if (!D.saveState(S)) toast('⚠️ 儲存失敗，手機空間可能不足，請先到「設定」備份');
}

/* ---------- 3D（需要時才載入，失敗時改用表情符號） ---------- */
async function three() {
  if (threeMod || threeFailed) return threeMod;
  try {
    const m = await import('./stage3d.js');
    if (!m.webglAvailable()) throw new Error('no webgl');
    threeMod = m;
  } catch (e) {
    console.warn('3D 無法使用', e);
    threeFailed = true;
  }
  return threeMod;
}

/* ---------- 溫柔的鼓勵語 ---------- */
const CHEER_START = [
  '太棒了！開始就是最難的一步 💪', '你已經在做了，超猛的！🔥', '起步成功～慢慢來也沒關係 🌷',
  '開始了就是勝利 ✨', '好樣的！先專心這一小步就好 🐾',
];
const CHEER_DONE = ['完成啦！你真的很棒 💖', '又完成一件，拚得好！🔥', '今天的你超猛 ✨'];

/* ---------- 提示訊息 ---------- */
let toastTimer = null;
function toast(msg, action, ms = 2600) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ---------- 底部抽屜（Sheet）系統 ---------- */
const sheets = [];
function openSheet(build, { full = false, dismissable = true, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const el = document.createElement('div');
  el.className = 'sheet' + (full ? ' full' : '');
  back.appendChild(el);
  $('#sheet-root').appendChild(back);
  const sh = { el, back, actions: {}, data: {} };
  sh.render = () => {
    const out = build(sh);
    el.innerHTML = '<div class="grab"></div>' + out.html;
    sh.actions = out.actions || {};
    out.after && out.after(el);
  };
  sh.close = () => {
    if (!back.isConnected) return;
    back.remove();
    sheets.splice(sheets.indexOf(sh), 1);
    onClose && onClose();
    sh.onClose && sh.onClose();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b)) return;
    const fn = sh.actions[b.dataset.act];
    if (fn) fn(b, e);
  });
  el.addEventListener('input', (e) => { sh.onInput && sh.onInput(e.target); });
  el.addEventListener('change', (e) => { sh.onChange && sh.onChange(e.target); });
  back.addEventListener('click', (e) => { if (e.target === back && dismissable) sh.close(); });
  sheets.push(sh);
  sh.render();
  return sh;
}

/* ---------- 共用小元件 ---------- */
const starsHtml = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;
const typeTag = (t) => (t.type === 'must' ? '<span class="tag must">‼️ 必須做</span>' : '<span class="tag want">👍 想做</span>');
function deadlineTag(t) {
  if (t.type !== 'must' || !t.deadline || t.status === 'done') return '';
  const d = D.daysBetween(today, t.deadline);
  if (d < 0) return `<span class="tag late">已過期 ${-d} 天</span>`;
  if (d === 0) return '<span class="tag urgent">今天截止</span>';
  if (d === 1) return '<span class="tag urgent">明天截止</span>';
  if (d <= 3) return `<span class="tag soon">還有 ${d} 天</span>`;
  return `<span class="tag ok">還有 ${d} 天</span>`;
}
const rarityBadge = (r) => `<span class="badge" style="background:${D.RARITY[r].color}">${D.RARITY[r].label}</span>`;

function minutesNow() {
  const n = new Date();
  let m = n.getHours() * 60 + n.getMinutes();
  if (n.getHours() < D.DAY_START_HOUR) m += 24 * 60;
  return m;
}
function whenMinutes(when) {
  if (!when || !when.time) return 99999;
  const [h, m] = when.time.split(':').map(Number);
  let v = h * 60 + m;
  if (h < D.DAY_START_HOUR) v += 24 * 60;
  return v;
}
function lateTasks() {
  const day = S.days[today];
  if (!day) return [];
  const now = minutesNow();
  return day.plan.map((id) => S.tasks[id])
    .filter((t) => t && t.status === 'todo' && !t.startedAt && whenMinutes(day.when[t.id]) <= now);
}

function fillThumbs(root) {
  root.querySelectorAll('img[data-thumb]').forEach(async (img) => {
    const T = await three();
    if (!T) { img.replaceWith(Object.assign(document.createElement('span'), { textContent: '🐾', style: 'font-size:28px' })); return; }
    const url = await T.getThumb(img.dataset.thumb);
    if (url) { img.src = url; img.previousElementSibling?.classList?.contains('spin') && img.previousElementSibling.remove(); }
  });
}

/* =========================================================
   今天
   ========================================================= */
function viewToday() {
  const day = D.getDay(S, today);
  const tasks = day.plan.map((id) => S.tasks[id]).filter(Boolean);
  const todo = tasks.filter((t) => t.status === 'todo').sort((a, b) => whenMinutes(day.when[a.id]) - whenMinutes(day.when[b.id]));
  const done = tasks.filter((t) => t.status === 'done');
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const late = lateTasks();
  const fav = S.favorite && S.collection[S.favorite] ? D.CATALOG_BY_ID[S.favorite] : null;
  const legendLeft = D.LEGEND_EVERY - (S.legend.count % D.LEGEND_EVERY);

  let banners = '';
  if (late.length) {
    const t = late[0];
    banners += `<div class="banner alarm"><span class="bi">⏰</span><span>「${esc(t.title)}」的時間到囉～<br>先做第一步就好！${late.length > 1 ? `<br><small>（還有 ${late.length - 1} 件也到時間了）</small>` : ''}</span><button data-act="start" data-id="${t.id}">開始</button></div>`;
  }
  if (!day.planned) {
    banners += '<div class="banner info"><span class="bi">🌤️</span><span>今天還沒選任務喔</span><button data-act="plan">來選選</button></div>';
  }
  const hasData = Object.keys(S.tasks).length > 0;
  if (hasData && Date.now() - (S.lastBackup || S.createdAt) > 7 * 86400e3) {
    banners += '<div class="banner info"><span class="bi">💾</span><span>一週沒備份了，備份一下比較安心</span><button data-act="backup">備份</button></div>';
  }

  const cards = [...todo, ...done].map((t) => taskCard(t, day, late.includes(t))).join('');
  const html = `
    <div class="top">
      <div class="brand">要拚要猛<span class="fire">🔥</span></div>
      <div class="date">${D.prettyDay(today)}</div>
    </div>
    <div class="hero" id="hero">
      <div class="ground"></div>
      <div class="stage-wrap" id="home-stage"></div>
      ${fav ? `<div class="pal-name">${esc(fav.name)}</div>` : `<div class="fallback"><div class="mystery"><span class="egg-mini">🥚</span><p>完成第一件任務，孵出你的夥伴！</p></div></div>`}
      <div class="hud">
        <span class="pill">💎 ${S.shards}</span>
        <span class="pill">🌟 傳說 ${S.legend.count % D.LEGEND_EVERY}/${D.LEGEND_EVERY}</span>
      </div>
    </div>
    ${banners}
    <h2>每日習慣 <span class="sub">💧 喝水・🏃 運動</span></h2>
    ${waterCard(today)}
    ${exerciseCard(today, { compact: true })}
    <h2>今天的任務 <span class="sub">${tasks.length ? `${done.length} / ${tasks.length} 完成` : ''}</span></h2>
    ${tasks.length ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
    ${cards || `<div class="empty"><div class="big">🌱</div><p>今天還沒有任務<br>挑幾件想完成的事吧！</p></div>`}
    <button class="add-fab" data-act="add">＋ 加入今天的任務</button>
    ${done.length && !todo.length ? `<p class="muted small" style="text-align:center;margin-top:16px">今天排的都完成了！好好休息，你值得 💖</p>` : ''}
    <p class="muted small" style="text-align:center;margin-top:14px">再完成 ${legendLeft} 件 ★★★ 任務，就能解鎖傳說動物 🌟</p>
  `;
  const actions = {
    start: (b) => openLaunch(b.dataset.id),
    finish: (b) => finishTask(b.dataset.id),
    step: (b) => {
      const t = S.tasks[b.dataset.id];
      const st = t.steps.find((x) => x.id === b.dataset.step);
      if (st) { st.done = !st.done; save(); render(); }
    },
    more: (b) => openTaskMenu(b.dataset.id),
    edit: (b) => openEditor(S.tasks[b.dataset.id]),
    add: () => openPlanner({ addMode: true }),
    plan: () => openPlanner({ addMode: false }),
    backup: () => exportData(),
    ...habitActions(),
  };
  return { html, actions, after: mountHome };
}

function taskCard(t, day, isLate) {
  const when = day.when[t.id];
  const where = day.where[t.id] || t.where;
  const total = t.steps.length, doneSteps = t.steps.filter((s) => s.done).length;
  const left = total - doneSteps;
  if (t.status === 'done') {
    const rec = day.completed.find((c) => c.taskId === t.id);
    const e = rec && D.CATALOG_BY_ID[rec.entryId];
    return `<div class="card ${t.type} done">
      <div class="row">${typeTag(t)}${starsHtml(t.difficulty)}</div>
      <div class="title">${esc(t.title)}</div>
      ${e ? `<div class="reward-mini"><span class="spin" style="display:none"></span><img data-thumb="${e.id}" alt="">得到了 ${esc(e.name)}！</div>` : ''}
    </div>`;
  }
  const overdue = t.type === 'must' && t.deadline && D.daysBetween(today, t.deadline) < 0;
  return `<div class="card ${t.type} ${isLate ? 'wiggle' : ''}">
    <button class="more" data-act="more" data-id="${t.id}" aria-label="更多">⋯</button>
    <div class="row">${typeTag(t)}${starsHtml(t.difficulty)}${deadlineTag(t)}</div>
    <div class="title">${esc(t.title)}</div>
    <div class="meta">${when ? `<span>${D.whenLabel(when)}</span>` : ''}${where ? `<span>📍 ${esc(where)}</span>` : ''}${t.startedAt ? '<span>🏃 進行中</span>' : ''}</div>
    ${t.firstStep ? `<div class="firststep"><small>2 分鐘起步動作</small>🔥 ${esc(t.firstStep)}</div>` : ''}
    ${total ? `<ul class="steps">${t.steps.map((s) => `<li class="${s.done ? 'done' : ''}" data-act="step" data-id="${t.id}" data-step="${s.id}"><span class="check ${s.done ? 'on' : ''}">${s.done ? '✓' : ''}</span><span>${esc(s.text)}</span></li>`).join('')}</ul>` : ''}
    ${overdue ? '<div class="hint">過期了也沒關係，現在做也不遲！💗</div>' : ''}
    ${t.postpone >= 3 ? `<div class="hint">這件事好像有點卡住了～要不要把第一步再拆小一點？ <a data-act="edit" data-id="${t.id}" style="color:var(--pink-d);font-weight:800">拆小一點</a></div>` : ''}
    <div class="actions">
      ${t.startedAt
        ? `<button class="btn ok" data-act="finish" data-id="${t.id}" ${left ? 'disabled' : ''}>${left ? `還有 ${left} 個步驟` : '✅ 完成！'}</button>`
        : `<button class="btn go" data-act="start" data-id="${t.id}">🔥 開始</button>`}
    </div>
  </div>`;
}

async function mountHome() {
  fillThumbs($('#view'));
  const wrap = $('#home-stage');
  const fav = S.favorite && S.collection[S.favorite] ? S.favorite : null;
  if (!fav) { if (homeStage) homeStage.stop(); return; }
  const T = await three();
  if (!T || !wrap.isConnected) {
    if (!T && wrap.isConnected) wrap.innerHTML = '<div class="fallback">🐾</div>';
    return;
  }
  try {
    if (!homeStage) homeStage = new T.Stage(wrap);
    else homeStage.mount(wrap);
    if (!homeStage.animal || homeStage.animal.entry.id !== fav) await homeStage.show(fav);
    if (tab === 'today' && !sheets.length) homeStage.start();
  } catch (e) {
    console.warn(e);
    wrap.innerHTML = '<div class="fallback">🐾</div>';
  }
}

function openTaskMenu(id) {
  const t = S.tasks[id];
  openSheet((sh) => ({
    html: `<h3>${esc(t.title)}</h3><p class="lead">要做什麼呢？</p>
      <button class="btn block" data-act="edit">✏️ 編輯任務</button>
      <div style="height:8px"></div>
      <button class="btn block" data-act="remove">↩️ 移出今天（放回清單）</button>
      <div style="height:8px"></div>
      <button class="btn block ghost" data-act="cancel">取消</button>`,
    actions: {
      edit: () => { sh.close(); openEditor(t); },
      remove: () => {
        const day = D.getDay(S, today);
        day.plan = day.plan.filter((x) => x !== id);
        delete day.when[id]; delete day.where[id];
        save(); sh.close(); render(); toast('已放回清單');
      },
      cancel: () => sh.close(),
    },
  }));
}

/* ---------- 開始：只顯示 2 分鐘起步動作 ---------- */
function openLaunch(id) {
  const t = S.tasks[id];
  if (!t) return;
  openSheet((sh) => ({
    html: `<div class="launch">
      <div class="rocket">🔥</div>
      <div class="only">${t.firstStep ? '現在只要做這一小步就好' : '現在只要開始做就好'}</div>
      <div class="stepbig">${esc(t.firstStep || t.title)}</div>
      <p class="soft">只要 2 分鐘，做完想停也可以。<br>先動起來，其他的等等再說 🌷</p>
      <button class="btn go block" data-act="go">我開始了！</button>
      <div style="height:8px"></div>
      <button class="btn ghost block" data-act="later">等一下</button>
    </div>`,
    actions: {
      go: () => {
        t.startedAt = Date.now();
        save(); sh.close(); render();
        toast(pick(CHEER_START));
      },
      later: () => { sh.close(); toast('沒關係，準備好了再按開始 💗'); },
    },
  }));
}

/* ---------- 完成：抽動物、貼貼紙 ---------- */
async function finishTask(id) {
  const res = D.completeTask(S, id, today);
  if (!res) return;
  render();
  await showReward(res.rewards);
  toast(`完成「${res.task.title}」`, {
    label: '復原',
    fn: () => {
      S = D.importState(JSON.parse(res.snapshot));
      save(); render(); toast('已復原');
    },
  }, 5000);
}

async function showReward(list, sticker) {
  if (homeStage) homeStage.stop();
  const ov = document.createElement('div');
  ov.className = 'reward';
  ov.innerHTML = `
    <p class="r-title">孵化中…</p>
    <p class="r-sub">&nbsp;</p>
    <div class="stage-box"><div class="stage-wrap"></div></div>
    <div class="info"></div>
    <button class="btn go hidden">好耶！</button>`;
  document.body.appendChild(ov);
  const title = $('.r-title', ov), sub = $('.r-sub', ov), box = $('.stage-box', ov), wrap = $('.stage-wrap', ov),
    info = $('.info', ov), btn = $('.btn', ov);
  const T = await three();
  let stage = null;
  if (T) { try { stage = new T.Stage(wrap, { interactive: true }); } catch (e) { console.warn(e); } }

  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const last = i === list.length - 1;
    if (!r.entry) {
      title.textContent = '🌟 傳說全收集！';
      sub.textContent = '改送你 9 個碎片 💎';
      wrap.classList.remove('show');
    } else {
      const rar = r.entry.rarity;
      title.textContent = r.legendBonus ? '🌟 傳說蛋出現了！' : '孵化中…';
      sub.innerHTML = r.legendBonus ? `累計完成 ${D.LEGEND_EVERY} 件 ★★★ 超難任務的獎勵` : '&nbsp;';
      info.innerHTML = '';
      btn.classList.add('hidden');
      wrap.classList.remove('show');
      if (stage) stage.clear();
      const egg = document.createElement('div');
      egg.className = 'egg';
      egg.style.setProperty('--egg', `linear-gradient(160deg, #fff, ${D.RARITY[rar].color})`);
      box.appendChild(egg);
      await Promise.all([sleep(1750), T ? T.prepare(r.entry.id) : null]);
      egg.classList.add('hatch');
      const fl = document.createElement('div'); fl.className = 'flash'; box.appendChild(fl);
      confetti(rar === 'legend' ? 90 : rar === 'epic' ? 60 : 36);
      if (stage) {
        try { await stage.show(r.entry.id, { mode: 'celebrate' }); wrap.classList.add('show'); } catch (e) { console.warn(e); }
      }
      if (!stage) { wrap.innerHTML = '<div class="fallback" style="font-size:110px;display:grid;place-items:center;height:100%">🐣</div>'; wrap.classList.add('show'); }
      setTimeout(() => { egg.remove(); fl.remove(); }, 700);
      title.innerHTML = r.isNew ? `<span class="new">NEW!</span> ${esc(r.entry.name)}` : esc(r.entry.name);
      sub.textContent = r.legendBonus ? `累計完成 ${D.LEGEND_EVERY} 件 ★★★ 任務的傳說獎勵！`
        : r.isNew ? '新夥伴加入圖鑑！' : `又見面了！重複的變成 ${r.shards} 個碎片 💎`;
      info.innerHTML = rarityBadge(rar);
    }
    if (last && sticker) {
      info.innerHTML += `<div class="sticker-note">今天的貼紙 <span class="st">${sticker}</span> 已貼到月曆上！</div>`;
    }
    btn.textContent = last ? '好耶！' : '還有驚喜 →';
    btn.classList.remove('hidden');
    await new Promise((res) => { btn.onclick = res; });
  }
  if (stage) stage.dispose();
  ov.remove();
  render();
}

function confetti(n) {
  const c = document.createElement('div');
  c.className = 'confetti';
  const cols = ['#FF9EC1', '#FFE59A', '#9FE3C8', '#D3C2FF', '#AEDBFF', '#FFC9A8'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = pick(cols);
    p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 3800);
}

/* =========================================================
   每日規劃（每天第一次打開）
   ========================================================= */
function openPlanner({ addMode }) {
  const day = D.getDay(S, today);
  const P = {
    step: 'pick',
    selected: new Set(),
    when: {},
    where: {},
    pending: addMode ? [] : D.pendingFromPast(S, today),
  };
  if (P.pending.length) P.step = 'review';

  const sh = openSheet((sh) => {
    if (P.step === 'review') return plannerReview(sh, P);
    if (P.step === 'pick') return plannerPick(sh, P, day, addMode);
    return plannerWhen(sh, P, day);
  }, { full: true, onClose: () => { if (homeStage && tab === 'today') homeStage.start(); } });
  sh.onInput = (el) => { if (el.dataset.where) P.where[el.dataset.where] = el.value; };
  sh.onChange = (el) => {
    if (el.dataset.time) {
      P.when[el.dataset.time] = el.value ? { preset: 'custom', time: el.value } : undefined;
      const y = sh.el.scrollTop; sh.render(); sh.el.scrollTop = y;
    }
  };
  if (homeStage) homeStage.stop();
}

function plannerReview(sh, P) {
  const items = P.pending.map(({ task: t, fromKey }) => `
    <div class="review-item">
      <b>${esc(t.title)}</b>
      <div class="row" style="display:flex;gap:6px;flex-wrap:wrap">${typeTag(t)}${starsHtml(t.difficulty)}${deadlineTag(t)}<span class="tag ok">${D.prettyDay(fromKey)}</span></div>
      <div class="grid4">
        <button class="btn ok" data-act="cont" data-id="${t.id}" data-from="${fromKey}">▶️ 今天繼續</button>
        <button class="btn lav" data-act="smaller" data-id="${t.id}" data-from="${fromKey}">✂️ 拆得更小</button>
        <button class="btn" data-act="back" data-id="${t.id}" data-from="${fromKey}">📋 放回清單</button>
        <button class="btn danger" data-act="del" data-id="${t.id}" data-from="${fromKey}">🗑️ 刪除</button>
      </div>
    </div>`).join('');
  const resolve = (b) => {
    D.markResolved(S, b.dataset.from, b.dataset.id);
    P.pending = P.pending.filter((p) => p.task.id !== b.dataset.id);
    save();
    if (!P.pending.length) P.step = 'pick';
    sh.render();
  };
  return {
    html: `<button class="close-x" data-act="close">✕</button>
      <h3>先看看之前的任務 🌤️</h3>
      <p class="lead">這些還沒完成，沒關係！每件選一個處理方式就好。</p>
      ${items}`,
    actions: {
      close: () => sh.close(),
      cont: (b) => { const t = S.tasks[b.dataset.id]; t.postpone = (t.postpone || 0) + 1; P.selected.add(t.id); resolve(b); },
      smaller: (b) => {
        const t = S.tasks[b.dataset.id];
        t.postpone = (t.postpone || 0) + 1;
        P.selected.add(t.id); resolve(b);
        openEditor(t, { hint: '把「2 分鐘起步動作」寫得更小一點，或加入幾個小步驟 ✂️', onSaved: () => sh.render() });
      },
      back: (b) => { resolve(b); toast('已放回清單'); },
      del: (b) => {
        if (!confirm('確定要刪除這件任務嗎？')) return;
        delete S.tasks[b.dataset.id];
        resolve(b);
      },
    },
  };
}

function plannerPick(sh, P, day, addMode) {
  const backlog = Object.values(S.tasks).filter((t) => t.status === 'todo' && !day.plan.includes(t.id));
  const must = backlog.filter((t) => t.type === 'must').sort(byOrder);
  const want = backlog.filter((t) => t.type === 'want').sort(byOrder);
  const row = (t) => `<button class="pick ${P.selected.has(t.id) ? 'on' : ''}" data-act="toggle" data-id="${t.id}">
      <span class="check ${P.selected.has(t.id) ? 'on' : ''}">${P.selected.has(t.id) ? '✓' : ''}</span>
      <span class="pt"><b>${esc(t.title)}</b><span>${starsHtml(t.difficulty)} ${deadlineTag(t)}</span></span>
    </button>`;
  const n = P.selected.size;
  return {
    html: `<button class="close-x" data-act="close">✕</button>
      <h3>${addMode ? '再加一些任務 ✨' : '今天想完成哪些事？☀️'}</h3>
      <p class="lead">想選幾件都可以，點一下就能選。</p>
      ${must.length ? `<h2>‼️ 必須做</h2>${must.map(row).join('')}` : ''}
      ${want.length ? `<h2>👍 想做</h2>${want.map(row).join('')}` : ''}
      ${!backlog.length ? '<div class="empty"><div class="big">📝</div><p>清單是空的～先新增一件任務吧！</p></div>' : ''}
      <button class="add-fab" data-act="new" style="margin-top:6px">＋ 新增任務</button>
      <div style="height:80px"></div>
      <div class="foot">
        ${!addMode && !n ? '<button class="btn ghost" data-act="skip">今天先不排</button>' : ''}
        <button class="btn go" data-act="next" ${n ? '' : 'disabled'}>下一步${n ? `（${n} 件）` : ''}</button>
      </div>`,
    actions: {
      close: () => sh.close(),
      toggle: (b) => { const id = b.dataset.id; P.selected.has(id) ? P.selected.delete(id) : P.selected.add(id); sh.render(); },
      new: () => openEditor(null, { onSaved: (t) => { P.selected.add(t.id); sh.render(); } }),
      skip: () => { day.planned = true; save(); sh.close(); render(); },
      next: () => {
        for (const id of P.selected) if (P.where[id] === undefined) P.where[id] = S.tasks[id]?.where || '';
        P.step = 'when'; sh.render(); sh.el.scrollTop = 0;
      },
    },
  };
}

function plannerWhen(sh, P, day) {
  const ids = [...P.selected].filter((id) => S.tasks[id]);
  const allSet = ids.every((id) => P.when[id] && P.when[id].time);
  const items = ids.map((id) => {
    const t = S.tasks[id], w = P.when[id];
    return `<div class="plan-item">
      <b>${t.type === 'must' ? '‼️' : '👍'} ${esc(t.title)}</b>
      <div class="chips">
        ${D.WHEN_PRESETS.map((p) => `<button class="chip ${w && w.preset === p.id ? 'on' : ''}" data-act="preset" data-id="${id}" data-p="${p.id}">${p.label}</button>`).join('')}
        <input type="time" class="input time-in chip ${w && w.preset === 'custom' ? 'on' : ''}" data-time="${id}" value="${w && w.preset === 'custom' ? w.time : ''}" aria-label="自訂時間">
      </div>
      <input class="input where-in" data-where="${id}" placeholder="📍 在哪裡做？（選填，例如：書桌、圖書館）" value="${esc(P.where[id] || '')}">
    </div>`;
  }).join('');
  return {
    html: `<button class="close-x" data-act="close">✕</button>
      <h3>什麼時候做？⏰</h3>
      <p class="lead">研究發現：事先決定「何時、在哪裡」做，真的去做的機率會高很多！<br>時間到了、打開 App 時會提醒你。</p>
      ${items}
      <div style="height:80px"></div>
      <div class="foot">
        <button class="btn ghost" data-act="back">← 上一步</button>
        <button class="btn go" data-act="done" ${allSet ? '' : 'disabled'}>${allSet ? '開始今天 🔥' : '每件都要選時間喔'}</button>
      </div>`,
    actions: {
      close: () => sh.close(),
      back: () => { P.step = 'pick'; sh.render(); },
      preset: (b) => {
        const p = D.WHEN_PRESETS.find((x) => x.id === b.dataset.p);
        P.when[b.dataset.id] = { preset: p.id, time: p.time };
        sh.render();
      },
      done: () => {
        for (const id of ids) {
          if (!day.plan.includes(id)) day.plan.push(id);
          day.when[id] = P.when[id];
          day.where[id] = (P.where[id] || '').trim();
        }
        day.planned = true;
        save(); sh.close(); render();
        toast(ids.length === 1 ? '排好了！先從第一步開始 💪' : `排好 ${ids.length} 件了！一件一件來 💪`);
      },
    },
  };
}

/* =========================================================
   新增／編輯任務
   ========================================================= */

function openEditor(task, { onSaved, hint } = {}) {
  const isNew = !task;
  const d = task ? JSON.parse(JSON.stringify(task)) : D.newTask();
  const locked = !!(task && task.startedAt);
  let err = '';
  const sh = openSheet((sh) => ({
    html: `<button class="close-x" data-act="close">✕</button>
      <h3>${isNew ? '新增任務 📝' : '編輯任務 ✏️'}</h3>
      ${hint ? `<p class="lead">${esc(hint)}</p>` : '<p class="lead">寫下來，就成功一半了！</p>'}
      <div class="field"><label>任務名稱 <span class="req">*</span></label>
        <input class="input" data-f="title" value="${esc(d.title)}" placeholder="例如：寫期末報告、整理房間" maxlength="60"></div>
      <div class="field"><label>類型 <span class="req">*</span></label>
        <div class="seg">
          <button data-act="type" data-v="must" class="${d.type === 'must' ? 'on' : ''}">‼️ 必須做</button>
          <button data-act="type" data-v="want" class="${d.type === 'want' ? 'on' : ''}">👍 想做</button>
        </div></div>
      <div class="field"><label>難度 <span class="req">*</span> <span class="opt">（越難，獎勵越稀有）</span></label>
        <div class="seg">
          ${[1, 2, 3].map((n) => `<button data-act="diff" data-v="${n}" class="${d.difficulty === n ? 'on' : ''}" ${locked ? 'disabled' : ''}>${'★'.repeat(n)}<br><small>${['輕鬆', '普通', '超難'][n - 1]}</small></button>`).join('')}
        </div>
        ${locked ? '<p class="help">任務已經開始，難度就鎖定囉 🔒</p>' : '<p class="help">★ 保底普通・★★ 保底稀有・★★★ 保底史詩，並累積傳說進度</p>'}</div>
      <div class="field"><label>2 分鐘起步動作 <span class="opt">（選填）</span></label>
        <input class="input" data-f="firstStep" value="${esc(d.firstStep)}" placeholder="小到不可能失敗的第一步" maxlength="60"></div>
      ${d.type === 'must' ? `<div class="field"><label>截止日 <span class="opt">（選填）</span></label>
        <input class="input" type="date" data-f="deadline" value="${esc(d.deadline)}"></div>` : ''}
      <div class="field"><label>拆解步驟 <span class="opt">（選填，全部打勾才算完成）</span></label>
        ${d.steps.map((s, i) => `<div class="step-edit"><input class="input" data-step="${i}" value="${esc(s.text)}" placeholder="步驟 ${i + 1}" maxlength="60"><button data-act="delstep" data-i="${i}" aria-label="刪除">✕</button></div>`).join('')}
        <button class="btn small" data-act="addstep">＋ 加一個步驟</button></div>
      <div class="field"><label>通常在哪裡做 <span class="opt">（選填）</span></label>
        <input class="input" data-f="where" value="${esc(d.where)}" placeholder="例如：書桌、圖書館" maxlength="30"></div>
      ${err ? `<p class="help" style="color:#C9416F;font-weight:800">${esc(err)}</p>` : ''}
      <div style="height:70px"></div>
      <div class="foot">
        ${!isNew ? '<button class="btn danger" data-act="delete" style="flex:none">🗑️</button>' : ''}
        <button class="btn go" data-act="save">${isNew ? '新增' : '儲存'}</button>
      </div>`,
    actions: {
      close: () => sh.close(),
      type: (b) => { d.type = b.dataset.v; sh.render(); },
      diff: (b) => { d.difficulty = Number(b.dataset.v); sh.render(); },
      addstep: () => { d.steps.push({ id: D.uid(), text: '', done: false }); sh.render(); sh.el.querySelector(`[data-step="${d.steps.length - 1}"]`)?.focus(); },
      delstep: (b) => { d.steps.splice(Number(b.dataset.i), 1); sh.render(); },
      delete: () => {
        if (!confirm(`確定要刪除「${task.title}」嗎？`)) return;
        delete S.tasks[task.id];
        for (const day of Object.values(S.days)) day.plan = day.plan.filter((x) => x !== task.id);
        save(); sh.close(); render(); toast('已刪除');
      },
      save: () => {
        d.title = d.title.trim(); d.firstStep = d.firstStep.trim(); d.where = (d.where || '').trim();
        d.steps = d.steps.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);
        if (!d.title) { err = '請填寫任務名稱'; sh.render(); return; }
        if (d.type !== 'must') d.deadline = '';
        S.tasks[d.id] = isNew ? d : { ...S.tasks[d.id], ...d, startedAt: S.tasks[d.id].startedAt, status: S.tasks[d.id].status };
        save(); sh.close(); render();
        toast(isNew ? '新增好了！' : '儲存好了！');
        onSaved && onSaved(S.tasks[d.id]);
      },
    },
  }), { full: true });
  sh.onInput = (el) => {
    if (el.dataset.f) d[el.dataset.f] = el.value;
    if (el.dataset.step !== undefined) d.steps[Number(el.dataset.step)].text = el.value;
  };
  return sh;
}

/* =========================================================
   每日習慣：喝水、運動
   ========================================================= */
const WATER_STEPS = [100, 250, 500];
function waterCard(key) {
  const total = D.waterTotal(S, key), goal = D.waterGoalOf(S, key), d = D.waterDay(S, key);
  const done = total >= goal;
  return `<div class="card habit water ${done ? 'hdone' : ''}">
    <div class="row"><span class="tag water">💧 每日喝水</span>${done ? `<span class="tag ok">達標！${d.sticker || ''}</span>` : ''}</div>
    <div class="title">${total} <small class="muted">/ ${goal} ml</small></div>
    <div class="wbar"><i style="width:${Math.min(100, (total / goal) * 100)}%"></i></div>
    <div class="chips">
      ${WATER_STEPS.map((ml) => `<button class="chip wchip" data-act="w-add" data-k="${key}" data-ml="${ml}">＋${ml}</button>`).join('')}
      <button class="chip wchip" data-act="w-custom" data-k="${key}">✏️ 自訂</button>
      ${d.logs.length ? `<button class="chip" data-act="w-undo" data-k="${key}" aria-label="移除上一筆">↩️ 上一筆</button>` : ''}
    </div>
    ${done ? '' : `<p class="help">再喝 ${goal - total} ml 就達標囉！</p>`}
  </div>`;
}
function exerciseCard(key, { compact = false } = {}) {
  const d = D.exerciseDay(S, key), done = d.items.some((i) => i.done);
  const showIdeas = !compact || !d.items.length;
  return `<div class="card habit ex ${done ? 'hdone' : ''}">
    <div class="row"><span class="tag ex">🏃 每日運動</span>${done ? `<span class="tag ok">完成！${d.sticker || ''}</span>` : ''}</div>
    ${d.items.length ? `<ul class="steps">${d.items.map((i) => `<li class="${i.done ? 'done' : ''}">
        <span class="check ${i.done ? 'on' : ''}" data-act="x-toggle" data-k="${key}" data-id="${i.id}">${i.done ? '✓' : ''}</span>
        <span data-act="x-toggle" data-k="${key}" data-id="${i.id}" style="flex:1">${esc(i.name)}</span>
        <button class="x-del" data-act="x-del" data-k="${key}" data-id="${i.id}" aria-label="刪除">✕</button></li>`).join('')}</ul>`
      : '<p class="help" style="margin:6px 4px 0">今天想做什麼運動？寫下來、做完打勾就完成了！</p>'}
    <div class="ex-add"><input class="input" data-exin="${key}" placeholder="運動項目，例如：散步 20 分鐘" maxlength="30">
      <button class="btn small go" data-act="x-add" data-k="${key}">新增</button></div>
    ${showIdeas ? `<div class="chips" style="margin-top:8px">${S.habits.exFavs.map((n) => `<button class="chip" data-act="x-quick" data-k="${key}" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
  </div>`;
}
function afterHabit(sticker, type) {
  save(); render();
  if (sticker) {
    confetti(40);
    toast(type === 'water' ? `💧 喝水達標！貼紙 ${sticker} 已貼到喝水月曆` : `🏃 運動完成！貼紙 ${sticker} 已貼到運動月曆`, null, 3200);
  }
}
function habitActions() {
  return {
    'w-add': (b) => afterHabit(D.addWater(S, b.dataset.k, Number(b.dataset.ml)), 'water'),
    'w-custom': (b) => {
      const v = prompt('這次喝了多少 ml？', '300');
      if (v === null) return;
      const ml = Math.round(Number(v));
      if (!ml || ml <= 0 || ml > 5000) { toast('請輸入 1～5000 的數字'); return; }
      afterHabit(D.addWater(S, b.dataset.k, ml), 'water');
    },
    'w-undo': (b) => { D.undoWater(S, b.dataset.k); save(); render(); toast('已移除上一筆'); },
    'x-add': (b) => {
      const inp = document.querySelector(`[data-exin="${b.dataset.k}"]`);
      const v = (inp && inp.value || '').trim();
      if (!v) { toast('先寫下運動項目喔'); inp && inp.focus(); return; }
      D.addExercise(S, b.dataset.k, v); save(); render();
    },
    'x-quick': (b) => { D.addExercise(S, b.dataset.k, b.dataset.v); save(); render(); },
    'x-toggle': (b) => afterHabit(D.toggleExercise(S, b.dataset.k, b.dataset.id), 'exercise'),
    'x-del': (b) => { D.deleteExercise(S, b.dataset.k, b.dataset.id); save(); render(); },
  };
}

/* =========================================================
   清單：長按拖曳排序、向左滑刪除（類似 iPhone 備忘錄）
   ========================================================= */
const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
let suppressClick = false;
const suppress = () => { suppressClick = true; setTimeout(() => { suppressClick = false; }, 80); };

function deleteTaskWithUndo(id) {
  const t = S.tasks[id];
  if (!t) return;
  const backup = JSON.parse(JSON.stringify(t));
  const inPlans = Object.entries(S.days).filter(([, d]) => d.plan.includes(id)).map(([k, d]) => [k, d.plan.indexOf(id)]);
  delete S.tasks[id];
  for (const day of Object.values(S.days)) day.plan = day.plan.filter((x) => x !== id);
  save(); render();
  toast(`已刪除「${backup.title}」`, {
    label: '復原',
    fn: () => {
      S.tasks[id] = backup;
      for (const [k, i] of inPlans) if (S.days[k]) S.days[k].plan.splice(i, 0, id);
      save(); render(); toast('已復原');
    },
  }, 5000);
}

function bindListGestures(root, canDrag) {
  const list = root.querySelector('.tlist');
  if (!list) return;
  const OPEN = 92;           // 滑開後露出刪除鈕的寬度
  const LONG_PRESS = 420;    // 長按多久開始拖曳（毫秒）
  let st = null, openRow = null;
  const closeOpen = () => {
    if (!openRow) return;
    openRow.querySelector('.card').style.transform = '';
    openRow.classList.remove('open');
    openRow = null;
  };
  // 拖曳或滑動時，不讓畫面跟著捲動
  list.addEventListener('touchmove', (e) => { if (st && (st.mode === 'drag' || st.mode === 'swipe')) e.preventDefault(); }, { passive: false });
  list.addEventListener('contextmenu', (e) => e.preventDefault());

  const startDrag = () => {
    if (!st || st.mode !== 'pending') return;
    st.mode = 'drag';
    closeOpen();
    st.rows = [...list.querySelectorAll('.swipe')];
    st.from = st.to = st.rows.indexOf(st.row);
    st.rects = st.rows.map((r) => r.getBoundingClientRect());
    st.h = st.rects[st.from].height + 12;
    st.row.classList.add('dragging');
    try { st.row.setPointerCapture(st.pid); } catch { /* 忽略 */ }
    if (navigator.vibrate) navigator.vibrate(10);
  };
  const moveDrag = (y) => {
    const dy = y - st.y0;
    st.row.style.transform = `translateY(${dy}px) scale(1.03)`;
    const r0 = st.rects[st.from], cy = r0.top + r0.height / 2 + dy;
    let to = st.from;
    st.rects.forEach((r, i) => {
      const mid = r.top + r.height / 2;
      if (i < st.from && cy < mid) to = Math.min(to, i);
      if (i > st.from && cy > mid) to = Math.max(to, i);
    });
    st.to = to;
    st.rows.forEach((r, i) => {
      if (i === st.from) return;
      let s = 0;
      if (st.from < to && i > st.from && i <= to) s = -st.h;
      if (st.from > to && i < st.from && i >= to) s = st.h;
      r.style.transform = s ? `translateY(${s}px)` : '';
    });
  };
  const endDrag = () => {
    const ids = st.rows.map((r) => r.dataset.id);
    const [moved] = ids.splice(st.from, 1);
    ids.splice(st.to, 0, moved);
    ids.forEach((id, i) => { if (S.tasks[id]) S.tasks[id].order = i; });
    suppress();
    if (st.to !== st.from) { save(); toast('順序已更新'); }
    render();
  };

  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.swipe');
    if (!row || e.target.closest('.swipe-del')) return;
    if (openRow) { const was = openRow; closeOpen(); if (was === row) { suppress(); return; } }
    st = { row, card: row.querySelector('.card'), x0: e.clientX, y0: e.clientY, pid: e.pointerId, mode: 'pending', dx: 0 };
    if (canDrag) st.timer = setTimeout(startDrag, LONG_PRESS);
  });
  list.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.pid) return;
    const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
    if (st.mode === 'pending' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      clearTimeout(st.timer);
      if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
        st.mode = 'swipe';
        st.card.style.transition = 'none';
        try { st.row.setPointerCapture(st.pid); } catch { /* 忽略 */ }
      } else { st = null; return; }
    }
    if (st.mode === 'swipe') {
      st.dx = Math.min(0, dx);
      st.card.style.transform = `translateX(${st.dx}px)`;
    } else if (st.mode === 'drag') moveDrag(e.clientY);
  });
  const end = () => {
    if (!st) return;
    clearTimeout(st.timer);
    const s = st;
    st = null;
    if (s.mode === 'swipe') {
      s.card.style.transition = '';
      suppress();
      if (s.dx < -s.row.offsetWidth * 0.6) { deleteTaskWithUndo(s.row.dataset.id); return; }
      if (s.dx < -OPEN / 2) { s.card.style.transform = `translateX(-${OPEN}px)`; s.row.classList.add('open'); openRow = s.row; }
      else s.card.style.transform = '';
    } else if (s.mode === 'drag') { st = s; endDrag(); st = null; }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

/* =========================================================
   清單
   ========================================================= */
function viewHabitList(segHtml) {
  const h = S.habits;
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(D.addDays(today, -i));
  const html = `
    <div class="top"><div class="brand">任務清單 📋</div></div>
    ${segHtml}
    <h2>💧 每日喝水目標</h2>
    <div class="card">
      <div class="goal-row"><input class="input" type="number" inputmode="numeric" min="100" max="5000" step="50" data-goal value="${h.waterGoal}"><span>ml</span><button class="btn small go" data-act="goal-save">儲存</button></div>
      <div class="chips" style="margin-top:10px">${[1000, 1500, 2000, 2500].map((v) => `<button class="chip ${h.waterGoal === v ? 'on' : ''}" data-act="goal-set" data-v="${v}">${v} ml</button>`).join('')}</div>
      <p class="help">每天喝到這個量就算達標，會在喝水月曆得到一張貼紙。</p>
    </div>
    <h2>今天的習慣</h2>
    ${waterCard(today)}
    ${exerciseCard(today)}
    <h2>🏃 常用運動項目</h2>
    <div class="card">
      <div class="chips">${h.exFavs.map((n, i) => `<span class="chip fav">${esc(n)}<button data-act="fav-del" data-i="${i}" aria-label="刪除">✕</button></span>`).join('') || '<span class="muted small">還沒有常用項目</span>'}</div>
      <div class="ex-add" style="margin-top:10px"><input class="input" data-favin placeholder="新增常用項目，例如：跳舞" maxlength="20"><button class="btn small go" data-act="fav-add">新增</button></div>
    </div>
    <h2>最近 7 天</h2>
    <div class="card week7">
      ${days.map((k) => `<div class="w7"><b>${D.WEEK[D.keyToDate(k).getDay()]}</b><span>${D.waterDay(S, k).sticker || '·'}</span><span>${D.exerciseDay(S, k).sticker || '·'}</span></div>`).join('')}
      <div class="w7 lbl"><b>&nbsp;</b><span>💧</span><span>🏃</span></div>
    </div>
  `;
  const setGoal = (v) => {
    if (!v || v < 100 || v > 5000) { toast('請輸入 100～5000 之間的數字'); return; }
    const st = D.setWaterGoal(S, v, today);
    if (st) afterHabit(st, 'water');
    else { save(); render(); toast(`每日喝水目標改成 ${v} ml 💧`); }
  };
  return {
    html,
    actions: {
      f: (b) => { listState.filter = b.dataset.v; render(); },
      'goal-set': (b) => setGoal(Number(b.dataset.v)),
      'goal-save': () => setGoal(Math.round(Number($('[data-goal]').value))),
      'fav-del': (b) => { h.exFavs.splice(Number(b.dataset.i), 1); save(); render(); },
      'fav-add': () => {
        const v = ($('[data-favin]').value || '').trim();
        if (!v) return;
        if (!h.exFavs.includes(v)) h.exFavs.push(v);
        save(); render();
      },
      ...habitActions(),
    },
  };
}

function viewList() {
  const f = listState.filter;
  const cntAll = (type) => Object.values(S.tasks).filter((t) => t.status === 'todo' && t.type === type).length;
  const segHtml = `<div class="seg seg4" style="margin-bottom:14px">
      <button data-act="f" data-v="must" class="${f === 'must' ? 'on' : ''}">‼️ 必須做 ${cntAll('must')}</button>
      <button data-act="f" data-v="want" class="${f === 'want' ? 'on' : ''}">👍 想做 ${cntAll('want')}</button>
      <button data-act="f" data-v="habit" class="${f === 'habit' ? 'on' : ''}">💧 習慣</button>
      <button data-act="f" data-v="done" class="${f === 'done' ? 'on' : ''}">✅ 完成</button>
    </div>`;
  if (f === 'habit') return viewHabitList(segHtml);
  const todayPlan = (S.days[today] && S.days[today].plan) || [];
  let tasks = Object.values(S.tasks);
  if (f === 'done') tasks = tasks.filter((t) => t.status === 'done').sort((a, b) => b.doneAt - a.doneAt).slice(0, 60);
  else {
    tasks = tasks.filter((t) => t.status === 'todo' && t.type === f).sort(byOrder);
  }
  const cards = tasks.map((t) => `<div class="swipe" data-id="${t.id}">
    <button class="swipe-del" data-act="swipe-del" data-id="${t.id}">🗑️<br>刪除</button>
    <div class="card ${t.type} ${t.status === 'done' ? 'done' : ''}" data-act="edit" data-id="${t.id}">
      <div class="row">${starsHtml(t.difficulty)}${deadlineTag(t)}${todayPlan.includes(t.id) && t.status === 'todo' ? '<span class="tag soon">今天</span>' : ''}</div>
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${t.firstStep ? `<span>🔥 ${esc(t.firstStep)}</span>` : ''}${t.steps.length ? `<span>📝 ${t.steps.length} 個步驟</span>` : ''}${t.status === 'done' ? `<span>✅ ${new Date(t.doneAt).toLocaleDateString('zh-TW')}</span>` : ''}</div>
    </div></div>`).join('');
  const html = `
    <div class="top"><div class="brand">任務清單 📋</div></div>
    ${segHtml}
    ${f !== 'done' ? '<button class="add-fab" data-act="new" style="margin-bottom:14px">＋ 新增任務</button>' : ''}
    ${cards ? `<div class="tlist">${cards}</div><p class="muted small" style="text-align:center">${f === 'done' ? '向左滑可以刪除' : '長按可以拖曳排序・向左滑可以刪除'}</p>` : `<div class="empty"><div class="big">${f === 'done' ? '🏆' : '✨'}</div><p>${f === 'done' ? '完成的任務會出現在這裡' : '想到什麼就先丟進來，<br>每天再挑要做的！'}</p></div>`}
  `;
  return {
    html,
    actions: {
      f: (b) => { listState.filter = b.dataset.v; render(); },
      new: () => openEditor(null, { onSaved: (t) => { listState.filter = t.type; render(); } }),
      edit: (b) => { const t = S.tasks[b.dataset.id]; if (t && t.status === 'todo') openEditor(t); },
      'swipe-del': (b) => deleteTaskWithUndo(b.dataset.id),
    },
    after: (root) => bindListGestures(root, f !== 'done'),
  };
}

/* =========================================================
   月曆
   ========================================================= */
function viewCalendar() {
  if (!calState.y) { const d = D.keyToDate(today); calState.y = d.getFullYear(); calState.m = d.getMonth(); calState.sel = today; }
  const { y, m } = calState;
  const water = calState.mode === 'water';
  const first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<div class="cell blank"></div>';
  let okDays = 0, totalMl = 0, logDays = 0, exCount = 0;
  const names = {};
  for (let d = 1; d <= daysIn; d++) {
    const k = key(d);
    let sticker = null, sub = '';
    if (water) {
      const wd = S.habits.water[k], tot = D.waterTotal(S, k);
      sticker = wd && wd.sticker;
      if (tot) { totalMl += tot; logDays++; if (!sticker) sub = `<span class="amt">${tot}</span>`; }
    } else {
      const ed = S.habits.exercise[k];
      sticker = ed && ed.sticker;
      if (ed) for (const it of ed.items) if (it.done) { exCount++; names[it.name] = (names[it.name] || 0) + 1; }
      if (ed && ed.items.length && !sticker) sub = '<span class="amt">·</span>';
    }
    if (sticker) okDays++;
    const cls = ['cell', sticker ? 'has' : '', k === today ? 'today' : '', k === calState.sel ? 'sel' : '', k > today ? 'future' : ''].join(' ');
    cells += `<button class="${cls}" data-act="sel" data-k="${k}" ${k > today ? 'disabled' : ''}><span class="n">${d}</span>${sticker ? `<span class="st">${sticker}</span>` : sub}</button>`;
  }
  const top = Object.entries(names).sort((a, b) => b[1] - a[1])[0];
  const stats = water
    ? `<div class="stat"><b>${okDays}</b><span>達標天數 💧</span></div>
       <div class="stat"><b>${(totalMl / 1000).toFixed(1)}<small>L</small></b><span>本月總量</span></div>
       <div class="stat"><b>${logDays ? Math.round(totalMl / logDays) : 0}</b><span>平均每日 ml</span></div>`
    : `<div class="stat"><b>${okDays}</b><span>運動天數 🏃</span></div>
       <div class="stat"><b>${exCount}</b><span>完成項目</span></div>
       <div class="stat"><b class="top-ex">${top ? esc(top[0]) : '—'}</b><span>最常做</span></div>`;

  let detail = '';
  if (calState.sel && calState.sel <= today) {
    const k = calState.sel;
    const logs = D.waterDay(S, k).logs;
    detail = `<div class="day-detail"><h2>${D.prettyDay(k)}${k === today ? ' <span class="sub">今天</span>' : ''}</h2>
      ${water ? waterCard(k) : exerciseCard(k)}
      ${water && logs.length ? `<div class="card log-list">${logs.map((l) => `<div><span class="muted">${new Date(l.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span><b>${l.ml} ml</b></div>`).join('')}</div>` : ''}
      ${k !== today ? '<p class="muted small" style="text-align:center">忘記記錄的話，也可以在這裡補登 ✍️</p>' : ''}
    </div>`;
  }
  const html = `
    <div class="seg" style="margin-bottom:12px">
      <button data-act="mode" data-v="water" class="${water ? 'on' : ''}">💧 喝水月曆</button>
      <button data-act="mode" data-v="exercise" class="${!water ? 'on' : ''}">🏃 運動月曆</button>
    </div>
    <div class="cal-head">
      <button data-act="prev" aria-label="上個月">‹</button>
      <h1>${y} 年 ${m + 1} 月</h1>
      <button data-act="next" aria-label="下個月">›</button>
    </div>
    <div class="stat-row">${stats}</div>
    <div class="cal ${water ? 'water' : 'ex'}">
      <div class="wk">${D.WEEK.map((w) => `<div>${w}</div>`).join('')}</div>
      <div class="grid">${cells}</div>
    </div>
    <p class="muted small" style="text-align:center">${water ? `每天喝到 ${S.habits.waterGoal} ml，就能得到一張貼紙 💧` : '每天完成一項運動，就能得到一張貼紙 🏅'}</p>
    ${detail}
  `;
  return {
    html,
    actions: {
      mode: (b) => { calState.mode = b.dataset.v; render(); },
      prev: () => { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } calState.sel = null; render(); },
      next: () => { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } calState.sel = null; render(); },
      sel: (b) => { calState.sel = calState.sel === b.dataset.k ? null : b.dataset.k; render(); },
      ...habitActions(),
    },
  };
}

/* =========================================================
   圖鑑
   ========================================================= */
function viewZoo() {
  const total = D.CATALOG.length, owned = D.ownedCount(S);
  const lgProg = S.legend.count % D.LEGEND_EVERY;
  const sections = D.RARITY_ORDER.map((r) => {
    const list = D.CATALOG.filter((e) => e.rarity === r);
    const have = list.filter((e) => S.collection[e.id]).length;
    return `<div class="rar-title"><span class="dot" style="background:${D.RARITY[r].color}"></span>${D.RARITY[r].label}<span class="cnt">${have} / ${list.length}</span></div>
      <div class="zoo-grid">${list.map((e) => {
        const c = S.collection[e.id];
        return `<button class="mon ${e.rarity} ${c ? '' : 'locked'}" data-act="${c ? 'view' : 'locked'}" data-id="${e.id}">
          ${c && c.count > 1 ? `<span class="ct">×${c.count}</span>` : ''}
          ${S.favorite === e.id ? '<span class="fav">⭐</span>' : ''}
          <div class="pic"><span class="spin"></span><img data-thumb="${e.id}" alt="" style="display:none" onload="this.style.display='';this.previousElementSibling&&this.previousElementSibling.remove()"></div>
          <div class="nm">${c ? esc(e.name) : '？？？'}</div>
        </button>`;
      }).join('')}</div>`;
  }).join('');
  const html = `
    <div class="top"><div class="brand">動物圖鑑 🐾</div><div class="date">${owned} / ${total}</div></div>
    <div class="zoo-top">
      <div class="box"><div class="k">收集進度</div><div class="v">${owned}<span class="muted small"> / ${total}</span></div>
        <div class="progress" style="margin:6px 0 0"><i style="width:${(owned / total) * 100}%"></i></div></div>
      <div class="box"><div class="k">🌟 傳說進度</div><div class="lg">${'★'.repeat(lgProg)}<span style="color:var(--line)">${'★'.repeat(D.LEGEND_EVERY - lgProg)}</span></div>
        <div class="small muted">再 ${D.LEGEND_EVERY - lgProg} 件 ★★★ 任務</div></div>
    </div>
    <div class="box" style="margin-top:10px">
      <div class="k">💎 碎片 <b style="font-size:20px;color:var(--ink)">${S.shards}</b>　<span class="small">重複的動物會變成碎片</span></div>
      <div class="ex-row">
        <button class="btn lav" data-act="ex" data-r="rare" ${S.shards < D.EXCHANGE.rare ? 'disabled' : ''}>${D.EXCHANGE.rare} 💎 換稀有蛋</button>
        <button class="btn lav" data-act="ex" data-r="epic" ${S.shards < D.EXCHANGE.epic ? 'disabled' : ''}>${D.EXCHANGE.epic} 💎 換史詩蛋</button>
      </div>
    </div>
    ${sections}
    <p class="muted small" style="text-align:center;margin-top:20px">所有動物都是用程式捏出來的低多邊形 3D 模型 🧸</p>
  `;
  return {
    html,
    actions: {
      view: (b) => openViewer(b.dataset.id),
      locked: (b) => {
        const e = D.CATALOG_BY_ID[b.dataset.id];
        toast(e.rarity === 'legend' ? `每完成 ${D.LEGEND_EVERY} 件 ★★★ 任務解鎖一隻傳說 🌟` : `完成任務就有機會遇到牠！（${D.RARITY[e.rarity].label}）`);
      },
      ex: async (b) => {
        const r = b.dataset.r;
        if (!confirm(`用 ${D.EXCHANGE[r]} 個碎片兌換一顆${D.RARITY[r].label}蛋？\n（會優先孵出還沒擁有的動物）`)) return;
        const res = D.exchange(S, r);
        if (!res) return;
        save();
        await showReward([res], null);
      },
    },
    after: (root) => fillThumbs(root),
  };
}

async function openViewer(id) {
  const e = D.CATALOG_BY_ID[id];
  const c = S.collection[id];
  let stage = null;
  const sh = openSheet((sh) => ({
    html: `<button class="close-x" data-act="close">✕</button>
      <h3>${esc(e.name)}</h3>
      <p class="lead">${rarityBadge(e.rarity)}　擁有 ${c.count} 隻・${new Date(c.at).toLocaleDateString('zh-TW')} 初次相遇</p>
      <div class="viewer-stage" id="viewer-stage"><div class="drag-hint">👆 左右滑動可以轉動牠</div></div>
      <div class="actions">
        <button class="btn lav" data-act="dance">💃 動一動</button>
        <button class="btn go" data-act="fav" ${S.favorite === id ? 'disabled' : ''}>${S.favorite === id ? '⭐ 首頁夥伴' : '⭐ 設為首頁夥伴'}</button>
      </div>`,
    actions: {
      close: () => sh.close(),
      dance: () => stage && stage.playHappy(),
      fav: () => { S.favorite = id; save(); sh.render(); mountViewer(); toast(`${e.name} 會在首頁陪你 💖`); },
    },
  }), { onClose: () => { if (stage) stage.dispose(); stage = null; } });
  async function mountViewer() {
    const box = $('#viewer-stage', sh.el);
    const T = await three();
    if (!T) { box.insertAdjacentHTML('afterbegin', '<div class="fallback" style="font-size:90px;display:grid;place-items:center;height:100%">🐾</div>'); return; }
    if (!stage) { stage = new T.Stage(box, { interactive: true }); await stage.show(id); }
    else stage.mount(box);
  }
  mountViewer();
}

/* =========================================================
   設定
   ========================================================= */
function viewSettings() {
  const last = S.lastBackup ? new Date(S.lastBackup).toLocaleString('zh-TW') : '還沒備份過';
  const html = `
    <div class="top"><div class="brand">設定 ⚙️</div></div>
    <div class="set-group">
      <button class="set-row" data-act="export"><span class="si">💾</span><span class="st"><b>備份資料</b><span>上次備份：${esc(last)}</span></span>›</button>
      <button class="set-row" data-act="import"><span class="si">📂</span><span class="st"><b>從備份還原</b><span>會覆蓋目前的資料</span></span>›</button>
    </div>
    <p class="muted small" style="margin:-4px 8px 16px">資料只存在這支手機裡。刪除主畫面的 App 圖示，資料也會一起消失，記得定期備份到「檔案」或 iCloud 雲碟喔！</p>
    <div class="set-group about" style="padding:14px 16px">
      <h4 style="margin-top:0">🧠 這個 App 背後的方法</h4>
      <p><b>為什麼會拖延？</b> 心理學家 Piers Steel 的「時間動機理論」指出：覺得做不到、離截止日還很遠、事情不夠有趣時，動機就會變低。</p>
      <p><b>2 分鐘起步動作</b>：開始前的心理阻力最大。把第一步縮到小到不可能失敗，就能跨過「啟動障礙」。</p>
      <p><b>何時何地</b>：Gollwitzer 的「執行意圖」研究發現，事先決定「什麼時候、在哪裡做」，執行率會明顯提升。</p>
      <p><b>拆解步驟</b>：大任務拆小，讓每一步都看得到終點。</p>
      <p><b>收集獎勵</b>：完成就立刻有回饋，而且「不知道會孵出誰」的期待感特別有激勵效果。</p>
      <p><b>每日習慣</b>：喝水、運動這類每天的小習慣，記錄下來就看得到進度；月曆上的貼紙會讓「不想中斷」成為動力。</p>
      <p><b>溫柔對待自己</b>：研究顯示，原諒上次拖延的自己，下次反而比較不會拖延。所以這裡沒有懲罰，過期了也一樣可以完成 💗</p>
    </div>
    <div class="set-group about" style="padding:14px 16px">
      <h4 style="margin-top:0">🐾 素材與授權</h4>
      <p>3D 動物：用程式即時組合基本形狀（低多邊形風格），不需要下載模型檔。</p>
      <p>3D 引擎：three.js（MIT 授權）。</p>
    </div>
    <div class="set-group">
      <button class="set-row danger" data-act="reset"><span class="si">🧹</span><span class="st"><b>清除所有資料</b><span>任務、動物、貼紙都會刪除，無法復原</span></span></button>
    </div>
    <p class="muted small" style="text-align:center">要拚要猛 v2.2</p>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
  `;
  return {
    html,
    actions: {
      export: () => exportData(),
      import: () => $('#import-file').click(),
      reset: () => {
        if (!confirm('確定要清除所有資料嗎？任務、動物、貼紙都會刪除。')) return;
        if (!confirm('真的確定嗎？這個動作無法復原喔！（建議先備份）')) return;
        S = D.defaultState(); save();
        if (homeStage) homeStage.clear();
        render(); toast('已清除，重新開始吧 🌱');
      },
    },
    after: (root) => {
      $('#import-file', root).addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        try {
          const obj = JSON.parse(await file.text());
          const data = obj && obj.data ? obj.data : obj;
          if (!D.validateImport(data)) throw new Error('格式不對');
          if (!confirm('還原後會覆蓋目前的資料，確定嗎？')) return;
          S = D.importState(data); save();
          if (homeStage) homeStage.clear();
          render(); toast('還原成功！歡迎回來 💖');
        } catch (e) {
          alert('這個檔案無法還原，請確認是「要拚要猛」的備份檔。');
        }
      });
    },
  };
}

async function exportData() {
  const json = JSON.stringify({ app: 'yao-pin-yao-meng', exportedAt: new Date().toISOString(), data: S });
  const name = `要拚要猛備份-${today}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const mark = () => { S.lastBackup = Date.now(); save(); render(); toast('備份完成 💾'); };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '要拚要猛備份' }); mark(); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  mark();
}

/* =========================================================
   畫面切換
   ========================================================= */
const VIEWS = { today: viewToday, list: viewList, calendar: viewCalendar, zoo: viewZoo, settings: viewSettings };
let viewActions = {};
function render() {
  const view = $('#view');
  const out = VIEWS[tab]();
  const y = window.scrollY;
  view.innerHTML = out.html;
  viewActions = out.actions || {};
  out.after && out.after(view);
  window.scrollTo(0, y);
  if (tab !== 'today' && homeStage) homeStage.stop();
}
$('#view').addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = viewActions[b.dataset.act];
  if (fn) fn(b, e);
});
$('#view').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const t = e.target;
  if (t.dataset.exin !== undefined) { e.preventDefault(); viewActions['x-add']?.({ dataset: { k: t.dataset.exin } }); }
  if (t.dataset.favin !== undefined) { e.preventDefault(); viewActions['fav-add']?.(); }
  if (t.dataset.goal !== undefined) { e.preventDefault(); viewActions['goal-save']?.(); }
});
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('#tabbar button').forEach((x) => x.classList.toggle('on', x === b));
  window.scrollTo(0, 0);
  const view = $('#view');
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  render();
});

/* 每天第一次打開：直接開始選任務 */
function maybeStartDay() {
  const day = D.getDay(S, today);
  if (!day.planned && !plannerShownThisSession && !sheets.length && !document.querySelector('.reward')) {
    plannerShownThisSession = true;
    openPlanner({ addMode: false });
  }
}

/* 跨日、提醒檢查（App 開著時每分鐘一次） */
let lastLateSig = '';
function tick() {
  const k = D.dayKey();
  if (k !== today) {
    today = k;
    plannerShownThisSession = false;
    render();
    maybeStartDay();
    return;
  }
  const sig = lateTasks().map((t) => t.id).join(',');
  if (sig !== lastLateSig) {
    lastLateSig = sig;
    if (tab === 'today' && !sheets.length && !document.querySelector('.reward')) render();
  }
}
setInterval(tick, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ---------- Service Worker：讓 App 能離線使用、自動更新 ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  let refreshing = false;
  const hadController = !!navigator.serviceWorker.controller; // 第一次安裝時不需要重新整理
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // 新版會自動安裝並切換（切換後頁面自動重新整理）；萬一卡在等待中，直接叫它接手
    if (reg.waiting) reg.waiting.postMessage('skipWaiting');
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed') w.postMessage('skipWaiting'); });
    });
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW 註冊失敗', e));
}

/* ---------- 啟動 ---------- */
render();
lastLateSig = lateTasks().map((t) => t.id).join(',');
maybeStartDay();
// 先在背景載入首頁夥伴的模型
three().then((T) => { if (T && S.favorite) T.prepare(S.favorite); });
