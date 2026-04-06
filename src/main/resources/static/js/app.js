'use strict';

// ─── 実験装置リスト ───────────────────────────────────────
const EQUIPMENT = [
  { id: 'instron', name: 'INSTRON',               color: '#4A9B6F' },
  { id: 'agis',    name: 'AG-IS',                 color: '#98E868' },
  { id: 'press',   name: 'プレス',                color: '#FFB347' },
  { id: 'dsc',     name: 'DSC',                   color: '#A8B4E8' },
  { id: 'dma',     name: 'DMA',                   color: '#B088C0' },
  { id: 'oven',    name: 'オーブン',              color: '#FFB3A0' },
  { id: 'micro',   name: '顕微鏡',               color: '#90EE90' },
  { id: 'dens',    name: '密度',                  color: '#7FFFD4' },
  { id: 'knead',   name: '混錬機',               color: '#E8D8C0' },
  { id: 'fluo',    name: '蛍光',                  color: '#FFFF99' },
  { id: 'raman',   name: 'ラマン',               color: '#FF85C8' },
  { id: 'ftir',    name: 'FT-IR',                color: '#FFB3A0' },
  { id: 'rheo',    name: 'レオメーター',          color: '#87CEEB' },
  { id: 'ktten',   name: '恒温槽付き小型引張試験機', color: '#F4C88A' },
  { id: 'ls',      name: '光散乱',               color: '#C8A8DC' },
  { id: 'xray',    name: 'X線',                  color: '#EF9A9A' },
  { id: 'chemilumi', name: 'ケミルミネッセンスアナライザー', color: '#40C8C8' },
  { id: 'other',   name: 'その他',               color: '#9E9E9E' },
];

// ─── 定数 ─────────────────────────────────────────────────
const TL_START = 0;
const TL_END   = 24;
const HOUR_PX  = 180;
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── State ───────────────────────────────────────────────
let view         = 'month';
let currentDate  = new Date();
let reservations = [];
let logs         = [];
let userFreq     = {};
let editingId      = null;
let dayModalDate   = null;
let logAction      = 'all';
let logEqFilter    = '';
let selectedIds   = new Set();
let draggingResId = null;
let searchQuery   = '';       // 予約者名検索フィルタ
let weekColWidths = Array(7).fill(null); // null=フレキシブル(month幅に合わせる)、数値=px固定
let weekHourPx   = 180;                  // week表示の1時間高さ(px)、ズームで変化
let zoomLevel    = 100;                  // ズームレベル(25〜200)、month/week共通

// ─── DOM ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const calAreaEl       = $('calendar-area');
const navLabelEl      = $('nav-label');
const modalOverlay    = $('modal-overlay');
const fEquipment      = $('f-equipment');
const eqDot           = $('eq-dot');
const fUser           = $('f-user');
const fDate           = $('f-date');
const fStart          = $('f-start');
const fEnd            = $('f-end');
const fNotes          = $('f-notes');
const btnDelete       = $('btn-delete');
const fPin            = $('f-pin');
const dayModalOverlay = $('day-modal-overlay');
const dayTlWrap       = $('day-timeline-wrap');
const logDrawer       = $('log-drawer');
const logOverlay      = $('log-overlay');
const logBody         = $('log-body');

// ─── API helpers ─────────────────────────────────────────
async function apiCreateReservation(data) {
  const r = await fetch('/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

async function apiUpdateReservation(id, data) {
  const r = await fetch(`/reservations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

async function apiDeleteReservation(id) {
  await fetch(`/reservations/${id}`, { method: 'DELETE' });
}

function persistLog(entry) {
  fetch('/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(e => console.error('log save failed', e));
}

async function apiClearLogs() {
  await fetch('/logs', { method: 'DELETE' });
}

// ─── ユーザー名学習（頻度ベース） ────────────────────────
function saveUser(name) {
  if (!name) return;
  userFreq[name] = (userFreq[name] || 0) + 1;
  const trimmed = Object.fromEntries(
    Object.entries(userFreq).sort((a, b) => b[1] - a[1]).slice(0, 20)
  );
  userFreq = trimmed;
  fetch(`/users/${encodeURIComponent(name)}`, { method: 'POST' })
    .catch(e => console.error('user save failed', e));
}

function getTopSuggestion(prefix) {
  const lower = prefix.toLowerCase();
  const match = Object.entries(userFreq)
    .filter(([n]) => n.toLowerCase().startsWith(lower) && n !== prefix)
    .sort((a, b) => b[1] - a[1]);
  return match[0]?.[0] || null;
}

function showUserSuggest() {
  const box = $('user-suggest-box');
  if (!box) return;
  const v = fUser.value;
  const top = getTopSuggestion(v);
  if (top) {
    box.textContent = top;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

function attachUserSuggest() {
  fUser.addEventListener('input', showUserSuggest);
  fUser.addEventListener('focus', showUserSuggest);
  fUser.addEventListener('blur', () => {
    setTimeout(() => { const b = $('user-suggest-box'); if(b) b.style.display='none'; }, 150);
  });
  fUser.addEventListener('keydown', e => {
    const box = $('user-suggest-box');
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && box && box.style.display !== 'none') {
      e.preventDefault();
      fUser.value = box.textContent;
      box.style.display = 'none';
    }
  });
  const box = $('user-suggest-box');
  if (box) box.addEventListener('mousedown', e => {
    e.preventDefault();
    fUser.value = box.textContent;
    box.style.display = 'none';
  });
}

// ─── Init ────────────────────────────────────────────────
async function init() {
  const [resData, logData, userData] = await Promise.all([
    fetch('/reservations').then(r => r.json()).catch(() => []),
    fetch('/logs').then(r => r.json()).catch(() => []),
    fetch('/users').then(r => r.json()).catch(() => ({})),
  ]);
  reservations = resData;
  logs         = logData;
  userFreq     = userData;

  buildEqSelect();
  attachTimeInputs();
  attachUserSuggest();
  renderView();

  if ($('today-btn')) $('today-btn').onclick = goToday;
  $('add-btn').onclick = () => openModal();

  $('view-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.vt-btn');
    if (btn) setView(btn.dataset.view);
  });

  $('modal-close').onclick  = closeModal;
  $('btn-cancel').onclick   = closeModal;
  $('btn-save').onclick     = saveReservation;
  $('btn-delete').onclick   = confirmDelete;
  modalOverlay.onclick      = e => { if (e.target === modalOverlay) closeModal(); };

  // ─── モーダルドラッグ移動 ────────────────────────────────
  makeDraggable(document.querySelector('#modal-overlay .modal'),
                document.querySelector('#modal-overlay .modal .modal-header'));

  $('day-modal-close').onclick = closeDayModal;
  $('day-add-btn').onclick     = () => { closeDayModal(); openModal(dayModalDate); };
  dayModalOverlay.onclick      = e => { if (e.target === dayModalOverlay) closeDayModal(); };

  // 予約者名検索
  const searchInput = $('search-input');
  const searchClear = $('search-clear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    searchClear.style.display = searchQuery ? 'inline-flex' : 'none';
    applySearch();
  });
  searchClear.onclick = () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    applySearch();
  };

  // ─── ズームコントロール ──────────────────────────────────
  $('zoom-out').onclick = () => applyZoom(zoomLevel - 10);
  $('zoom-in').onclick  = () => applyZoom(zoomLevel + 10);
  $('zoom-slider').addEventListener('input', () => applyZoom(parseInt($('zoom-slider').value)));
  $('zoom-input').addEventListener('change', () => applyZoom(parseInt($('zoom-input').value) || 100));
  $('zoom-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyZoom(parseInt($('zoom-input').value) || 100);
  });

  $('btn-log').onclick       = openLog;
  $('log-close').onclick     = closeLog;
  logOverlay.onclick         = closeLog;
  $('btn-clear-log').onclick = clearLog;

  $('log-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.log-tab');
    if (!tab) return;
    logAction = tab.dataset.action;
    document.querySelectorAll('.log-tab').forEach(t =>
      t.classList.toggle('active', t === tab)
    );
    renderLogBody();
  });

  $('log-eq-filter').addEventListener('change', e => {
    logEqFilter = e.target.value;
    renderLogBody();
  });

  $('btn-bulk-delete').onclick = async () => {
    if (!selectedIds.size || !confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return;
    for (const id of selectedIds) {
      const res = reservations.find(r => r.id === id);
      if (res) addLog('delete', res);
      await apiDeleteReservation(id);
    }
    reservations = reservations.filter(r => !selectedIds.has(r.id));
    selectedIds.clear();
    updateBulkDeleteBtn();
    renderView();
  };

  const bulkBtn = $('btn-bulk-delete');
  bulkBtn.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    bulkBtn.classList.add('drag-over');
  });
  bulkBtn.addEventListener('dragleave', () => bulkBtn.classList.remove('drag-over'));
  bulkBtn.addEventListener('drop', async e => {
    e.preventDefault();
    bulkBtn.classList.remove('drag-over');
    bulkBtn.classList.remove('drag-target');
    const toDelete = selectedIds.size ? new Set(selectedIds) : new Set([draggingResId]);
    for (const id of toDelete) {
      const res = reservations.find(r => r.id === id);
      if (res) addLog('delete', res);
      await apiDeleteReservation(id);
    }
    reservations = reservations.filter(r => !toDelete.has(r.id));
    selectedIds.clear();
    updateBulkDeleteBtn();
    draggingResId = null;
    renderView();
  });

  // Ctrl+スクロール / トラックパッドピンチ: 表示領域中央基準でズーム
  calAreaEl.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1 / 0.9;
    if (view === 'week') {
      const scrollEl = $('week-outer-scroll');
      const totalHBefore = (TL_END - TL_START) * weekHourPx;
      const centerY = scrollEl ? scrollEl.scrollTop + scrollEl.clientHeight / 2 : totalHBefore / 2;
      const centerRatio = totalHBefore > 0 ? centerY / totalHBefore : 0.5;
      zoomLevel = Math.max(25, Math.min(200, Math.round(zoomLevel * factor)));
      weekHourPx = Math.round(180 * zoomLevel / 100);
      updateZoomUI();
      renderWeekView();
      const newEl = $('week-outer-scroll');
      if (newEl) newEl.scrollTop = Math.max(0, Math.round(centerRatio * (TL_END - TL_START) * weekHourPx - newEl.clientHeight / 2));
    } else if (view === 'month') {
      const scrollEl = document.querySelector('.month-scroll-wrap');
      const oldTotalW = (window._monthMinColW || 100) * 7;
      const centerX = scrollEl ? scrollEl.scrollLeft + scrollEl.clientWidth / 2 : oldTotalW / 2;
      const centerRatio = oldTotalW > 0 ? centerX / oldTotalW : 0.5;
      zoomLevel = Math.max(25, Math.min(200, Math.round(zoomLevel * factor)));
      updateZoomUI();
      renderMonthView();
      requestAnimationFrame(() => {
        const newEl = document.querySelector('.month-scroll-wrap');
        const newTotalW = (window._monthMinColW || 100) * 7;
        if (newEl) newEl.scrollLeft = Math.max(0, centerRatio * newTotalW - newEl.clientWidth / 2);
      });
    }
  }, { passive: false });
}

// ─── ズームUI更新 ─────────────────────────────────────────
function updateZoomUI() {
  const slider = $('zoom-slider');
  const input  = $('zoom-input');
  if (slider) slider.value = zoomLevel;
  if (input)  input.value  = zoomLevel;
}

function applyZoom(level) {
  const oldHourPx  = weekHourPx;
  const oldTotalW  = (window._monthMinColW || 100) * 7;
  zoomLevel  = Math.max(25, Math.min(200, Math.round(level)));
  weekHourPx = Math.round(180 * zoomLevel / 100);
  updateZoomUI();
  if (view === 'week') {
    const scrollEl = $('week-outer-scroll');
    const centerY = scrollEl ? scrollEl.scrollTop + scrollEl.clientHeight / 2 : 0;
    const centerRatio = oldHourPx ? centerY / ((TL_END - TL_START) * oldHourPx) : 0.5;
    renderWeekView();
    const newEl = $('week-outer-scroll');
    if (newEl) newEl.scrollTop = Math.max(0, centerRatio * (TL_END - TL_START) * weekHourPx - newEl.clientHeight / 2);
  } else if (view === 'month') {
    const scrollEl = document.querySelector('.month-scroll-wrap');
    const centerX = scrollEl ? scrollEl.scrollLeft + scrollEl.clientWidth / 2 : oldTotalW / 2;
    const centerRatio = oldTotalW > 0 ? centerX / oldTotalW : 0.5;
    renderMonthView();
    requestAnimationFrame(() => {
      const newEl = document.querySelector('.month-scroll-wrap');
      const newTotalW = (window._monthMinColW || 100) * 7;
      if (newEl) newEl.scrollLeft = Math.max(0, centerRatio * newTotalW - newEl.clientWidth / 2);
    });
  }
}

// ──────────────────────────────────────────────────────────
// 時刻入力：テキストフィールドへのスマートパース
// ──────────────────────────────────────────────────────────
function parseTimeInput(raw) {
  if (!raw) return '';
  const s = raw.trim()
    .replace(/[：]/g, ':')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/\s/g, '');

  if (!s) return '';

  const colonMatch = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const mn = colonMatch[2].length === 1 ? m * 10 : m;
    if (h >= 0 && h <= 24 && mn >= 0 && mn < 60) return `${pad(h)}:${pad(mn)}`;
  }

  if (/^\d+$/.test(s)) {
    if (s.length <= 2) {
      const h = parseInt(s, 10);
      if (h >= 0 && h <= 24) return `${pad(h)}:00`;
    } else if (s.length === 3) {
      const h = parseInt(s[0], 10);
      const m = parseInt(s.slice(1), 10);
      if (h >= 0 && h <= 24 && m >= 0 && m < 60) return `${pad(h)}:${pad(m)}`;
    } else if (s.length === 4) {
      const h = parseInt(s.slice(0, 2), 10);
      const m = parseInt(s.slice(2), 10);
      if (h >= 0 && h <= 24 && m >= 0 && m < 60) return `${pad(h)}:${pad(m)}`;
    }
  }

  return null;
}

function attachTimeInputs() {
  [fStart, fEnd].forEach(inp => {
    inp.addEventListener('focus', () => {
      inp.value = inp.value.replace(/:/g, '');
      inp.select();
    });
    inp.addEventListener('input', () => {
      const digits = inp.value.replace(/\D/g, '').slice(0, 4);
      if (inp.value !== digits) inp.value = digits;
      inp.classList.remove('invalid');
    });
    inp.addEventListener('blur', () => {
      const v = inp.value.trim();
      if (!v) return;
      const parsed = parseTimeInput(v);
      if (parsed !== null) {
        inp.value = parsed;
        inp.classList.remove('invalid');
      } else {
        inp.classList.add('invalid');
      }
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // 1〜3桁入力中にEnterされた場合は右に0を補完してHHMM形式に
        // 例: "1" → "1000" → 10:00  "14" → "1400" → 14:00  "143" → "1430" → 14:30
        const digits = inp.value.replace(/\D/g, '');
        if (digits.length >= 1 && digits.length <= 3) inp.value = digits.padEnd(4, '0');
        inp.blur();
        if (inp === fStart) setTimeout(() => fEnd.focus(), 0);
      }
    });
  });
}

// ─── View management ─────────────────────────────────────
function setView(v) {
  view = v;
  document.body.classList.toggle('week-active', v === 'week');
  document.querySelectorAll('.vt-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === v)
  );
  // month 以外ではカードを消す
  if (v !== 'month') { const c = document.getElementById('today-card'); if (c) c.remove(); }
  renderView();
}

function renderView() {
  buildForDateMap();
  updateNavLabel();
  if (view === 'month')      renderMonthView();
  else if (view === 'week')  renderWeekView();
  else                       renderListView();
  applySearch();
}

function applySearch() {
  const q = searchQuery.trim().toLowerCase();
  // month: .res-bar、week: .week-event、list: .list-item
  const selectors = ['.res-bar', '.week-event', '.list-item'];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!q) {
        el.classList.remove('search-dim', 'search-match');
        return;
      }
      const user = (el.dataset.user || '').toLowerCase();
      const match = user.includes(q);
      el.classList.toggle('search-dim',  !match);
      el.classList.toggle('search-match', match);
    });
  });
}

function updateBulkDeleteBtn() {
  const btn = $('btn-bulk-delete');
  if (!btn) return;
  btn.textContent = `削除(${selectedIds.size}件)`;
  btn.style.display = selectedIds.size > 0 ? 'inline-block' : 'none';
}

function updateNavLabel() {
  if (!navLabelEl) return;
  if (view === 'month' || view === 'list') {
    navLabelEl.textContent = '';
  } else {
    const ws = weekStart(currentDate);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
    navLabelEl.textContent =
      `${ws.getFullYear()}年 ${fmt(ws)}(Sun)〜${fmt(we)}(Sat)`;
  }
}

function navPrev() {
  if (view === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  } else {
    currentDate.setDate(currentDate.getDate() - 7);
  }
  renderView();
}

function navNext() {
  if (view === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  } else {
    currentDate.setDate(currentDate.getDate() + 7);
  }
  renderView();
}

function goToday() { currentDate = new Date(); renderView(); }

// ─── Legend & Equipment Select ────────────────────────────
function buildLegend() {
  $('legend').innerHTML = EQUIPMENT.map(eq => `
    <div class="legend-chip">
      <span class="legend-dot" style="background:${eq.color}"></span>
      <span>${eq.name}</span>
    </div>`).join('');
}

function buildEqSelect() {
  fEquipment.innerHTML = '<option value="">装置を選択</option>' +
    EQUIPMENT.map(eq => `<option value="${eq.id}">${eq.name}</option>`).join('');

  const list = $('eq-cs-list');
  list.innerHTML = EQUIPMENT.map(eq => `
    <div class="eq-cs-item" data-id="${eq.id}">
      <span class="eq-cs-item-dot" style="background:${eq.color}"></span>
      <span>${escHtml(eq.name)}</span>
    </div>`).join('');

  list.querySelectorAll('.eq-cs-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      fEquipment.value = item.dataset.id;
      updateEqDot();
      list.classList.remove('open');
    });
  });

  $('eq-cs-trigger').addEventListener('click', e => {
    e.stopPropagation();
    list.classList.toggle('open');
  });

  document.addEventListener('click', () => list.classList.remove('open'));

  updateEqDot();
}

function updateEqDot() {
  const eq = findEq(fEquipment.value);
  eqDot.style.background = eq ? eq.color : 'transparent';
  eqDot.style.border = eq ? '' : 'none';
  const lbl = $('eq-cs-label');
  if (lbl) {
    lbl.textContent = eq ? eq.name : '装置を選択';
    lbl.classList.toggle('placeholder', !eq);
  }
}

// ──────────────────────────────────────────────────────────
// MONTH VIEW — 1ヶ月フル表示
// ──────────────────────────────────────────────────────────
const BAR_H  = 62;
const HEAD_H = 56;
const EXTRA  = BAR_H + 10;

function cellMinHeight(isCurrWeek, numRes) {
  const base   = 240;
  const needed = HEAD_H + numRes * BAR_H + EXTRA;
  return Math.max(base, needed);
}

function renderMonthView() {
  const tKey     = todayKey();
  const year     = currentDate.getFullYear();
  const month    = currentDate.getMonth();
  const MONTHS   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // 月初の前の日曜日からグリッド開始、5週固定
  const firstDay   = new Date(year, month, 1);
  const gridStart  = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const numWeeks   = 5;

  const now      = new Date();
  const rangeText= `${year}年 ${MONTHS[month]}`;
  const todayStr = `today ${now.getMonth()+1}/${now.getDate()}`;

  // 列幅計算: 予約数が変わったときのみテキスト計測、ズーム変化時は即再適用
  if (window._monthBaseColWCount !== reservations.length) {
    const _cvs = document.createElement('canvas');
    const _ctx = _cvs.getContext('2d');
    _ctx.font = "600 17px 'Hiragino Sans','Noto Sans JP',sans-serif";
    let _maxW = 0;
    reservations.forEach(res => {
      const eq = findEq(res.equipment);
      if (!eq) return;
      const t = `${eq.name}${res.user ? '(' + res.user + ')' : ''}`;
      _maxW = Math.max(_maxW, _ctx.measureText(t).width);
    });
    window._monthBaseColW      = Math.max(100, Math.ceil(_maxW) + 48);
    window._monthBaseColWCount = reservations.length;
  }
  window._monthMinColW = Math.max(60, Math.round((window._monthBaseColW || 100) * zoomLevel / 100));

  calAreaEl.innerHTML = `
    <div class="month-view">
      <div class="calendar-range-bar">
        <button class="range-nav-btn" id="range-prev">◀</button>
        <span class="range-center">
          <span class="range-text">${rangeText}</span>
          <span class="range-today-pill" id="range-today-pill">${todayStr}</span>
        </span>
        <button class="range-nav-btn" id="range-next">▶</button>
      </div>
      <div class="month-scroll-wrap">
        <div class="weekday-header-row">
          <span>Sun</span><span>Mon</span><span>Tue</span>
          <span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="month-grid" id="month-grid"></div>
      </div>
    </div>`;

  $('range-prev').onclick = navPrev;
  $('range-next').onclick = navNext;
  $('range-today-pill').onclick = goToday;

  // 動的列幅を weekday-header-row と month-grid に適用
  // minmax(minW, 1fr): 画面が広い時は等分で埋め、狭い時はminW px固定で横スクロール
  {
    const minW   = window._monthMinColW || 100;
    const colTpl = `repeat(7, minmax(${minW}px, 1fr))`;
    const totW   = minW * 7;
    const wdh = document.querySelector('.weekday-header-row');
    const mgr = $('month-grid');
    if (wdh) { wdh.style.gridTemplateColumns = colTpl; wdh.style.width = ''; wdh.style.minWidth = totW + 'px'; }
    if (mgr) { mgr.style.gridTemplateColumns = colTpl; mgr.style.width = ''; mgr.style.minWidth = totW + 'px'; }
  }

  const grid = $('month-grid');

  for (let week = 0; week < numWeeks; week++) {
    for (let dow = 0; dow < 7; dow++) {
      const d   = new Date(gridStart);
      d.setDate(d.getDate() + week * 7 + dow);
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const isOtherMonth = d.getMonth() !== month;
      const isCurrWeek   = false; // 全セル同じ扱い

      const cell = mkEl('div', 'day-cell' +
        (isOtherMonth    ? ' other-month'      : '') +
        (dow === 0       ? ' sunday'           : '') +
        (dow === 6       ? ' saturday'         : '') +
        (key === tKey    ? ' today'            : '') +
        (week === numWeeks - 1 ? ' last-row'   : ''));

      cell.onclick = () => openModal(key);

      const num = mkEl('div', 'day-num', String(d.getDate()));
      num.onclick = e => { e.stopPropagation(); openDayModal(key); };
      cell.appendChild(num);

      const dayRes = forDate(key);
      cell.style.minHeight = cellMinHeight(isCurrWeek, dayRes.length) + 'px';

      if (dayRes.length) {
        const bars = mkEl('div', 'res-bars');
        dayRes.forEach(res => {
          const eq = findEq(res.equipment);
          if (!eq) return;
          const bar = mkEl('div', 'res-bar');
          bar.dataset.user = res.user || '';
          bar.style.background = hexAlpha(eq.color, 0.60);
          bar.style.color = textColor(eq.color);
          const t    = timeRange(res);
          const main = escHtml(`${eq.name}${res.user ? '(' + res.user + ')' : ''}`);
          const timeNotes = [t, res.notes].filter(Boolean).join(' ');
          const lockBadge = res.pin ? '<span class="pin-lock-badge">🔒</span>' : '';
          bar.innerHTML = `<span class="rb-main">${main}${lockBadge}</span>${timeNotes ? `<span class="rb-time">${escHtml(timeNotes)}</span>` : ''}`;
          bar.title = tooltip(res, eq);
          bar.onclick = e => {
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey) {
              if (selectedIds.has(res.id)) selectedIds.delete(res.id);
              else selectedIds.add(res.id);
              bar.classList.toggle('selected', selectedIds.has(res.id));
              updateBulkDeleteBtn();
            } else {
              openModal(key, res.id);
            }
          };
          if (selectedIds.has(res.id)) bar.classList.add('selected');

          bar.draggable = true;
          bar.addEventListener('dragstart', e => {
            e.stopPropagation();
            draggingResId = res.id;
            e.dataTransfer.setData('text/plain', res.id);
            e.dataTransfer.effectAllowed = 'copyMove';
            bar.classList.add('dragging');
            const bd = $('btn-bulk-delete');
            bd.classList.add('drag-target');
            bd.style.display = 'inline-block';
          });
          bar.addEventListener('dragend', () => {
            bar.classList.remove('dragging');
            const bd = $('btn-bulk-delete');
            bd.classList.remove('drag-target');
            bd.classList.remove('drag-over');
            if (!selectedIds.size) bd.style.display = 'none';
            draggingResId = null;
          });

          bars.appendChild(bar);
        });
        cell.appendChild(bars);
      }

      let dragEnterCount = 0;
      cell.addEventListener('dragenter', e => {
        e.preventDefault();
        dragEnterCount++;
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => {
        if (--dragEnterCount <= 0) { dragEnterCount = 0; cell.classList.remove('drag-over'); }
      });
      cell.addEventListener('dragover', e => e.preventDefault());
      cell.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        dragEnterCount = 0;
        cell.classList.remove('drag-over');
        const resId = e.dataTransfer.getData('text/plain');

        // 複数選択中かつドラッグ元が選択済みなら全選択をコピー、それ以外は単体
        const toCopy = (selectedIds.size > 0 && selectedIds.has(resId))
          ? [...selectedIds]
          : [resId];

        for (const id of toCopy) {
          const src = reservations.find(r => r.id === id);
          if (!src) continue;
          if (src.date === key) continue; // 同日は複製スキップ

          // 同装置・重複チェック（部分重複は差分時間帯で自動予約）
          let newStart = src.startTime, newEnd = src.endTime;
          if (src.startTime && src.endTime) {
            const conflicts = reservations.filter(r =>
              r.equipment === src.equipment && r.date === key &&
              r.startTime < src.endTime && r.endTime > src.startTime
            );
            if (conflicts.length > 0) {
              const exact = conflicts.find(r => r.startTime === src.startTime && r.endTime === src.endTime);
              if (exact) {
                showAlert(`この時間帯はすでに予約されています。\n（${exact.user} ${exact.startTime}〜${exact.endTime}）`);
                continue;
              }
              const occupied = conflicts.map(r => [r.startTime, r.endTime]).sort((a, b) => a[0] < b[0] ? -1 : 1);
              let free = [[src.startTime, src.endTime]];
              for (const [os, oe] of occupied) {
                const nf = [];
                for (const [fs, fe] of free) {
                  if (oe <= fs || os >= fe) { nf.push([fs, fe]); }
                  else { if (fs < os) nf.push([fs, os]); if (oe < fe) nf.push([oe, fe]); }
                }
                free = nf;
              }
              if (free.length === 0) { showAlert('この時間帯は全て予約済みです。'); continue; }
              newStart = free[0][0]; newEnd = free[0][1];
            }
          }
          const data = {
            equipment: src.equipment, user: src.user, date: key,
            startTime: newStart, endTime: newEnd, notes: src.notes,
          };
          const newRes = await apiCreateReservation(data);
          reservations.push(newRes);
          addLog('create', newRes);
        }
        selectedIds.clear();   // コピー後は選択状態をリセット（元予約の誤削除を防止）
        updateBulkDeleteBtn();
        renderView();
      });

      grid.appendChild(cell);
    }
  }

  // 今日の予約カードを表示（today が画面端でも見切れないよう位置を自動決定）
  requestAnimationFrame(() => showTodayCard());
}

function showTodayCard() {
  // 今日のセルがカレンダーの表示範囲に収まるようスクロール
  requestAnimationFrame(() => {
    const todayCell = document.querySelector('.day-cell.today');
    if (todayCell) todayCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

// ──────────────────────────────────────────────────────────
// LIST VIEW  —  全予約を日付順一覧
// ──────────────────────────────────────────────────────────
function renderListView() {
  const sorted = [...reservations].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
  });

  calAreaEl.innerHTML = `<div class="list-view"><div class="list-body" id="list-body"></div></div>`;
  const body = $('list-body');

  if (!sorted.length) {
    body.innerHTML = '<div class="list-empty">予約はありません</div>';
    return;
  }

  let lastDate = '';
  sorted.forEach(res => {
    const eq = findEq(res.equipment);
    if (!eq) return;

    if (res.date !== lastDate) {
      const d = new Date(res.date + 'T00:00:00');
      const label = mkEl('div', 'list-date-label',
        `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`);
      body.appendChild(label);
      lastDate = res.date;
    }

    const item = mkEl('div', 'list-item');
    item.dataset.user = res.user || '';
    item.style.borderLeftColor = eq.color;
    item.innerHTML = `
      <div class="list-eq" style="color:${eq.color}">${escHtml(eq.name)}</div>
      <div class="list-user">${escHtml(res.user)}</div>
      <div class="list-time">${escHtml(timeRange(res))}</div>
      ${res.notes ? `<div class="list-notes">${escHtml(res.notes)}</div>` : ''}`;
    // list表示は閲覧のみ — クリック無効
    body.appendChild(item);
  });
}

// ──────────────────────────────────────────────────────────
// WEEK VIEW  —  0:00〜24:00（閲覧のみ・空きスロットクリック無効）
// ──────────────────────────────────────────────────────────
function renderWeekView() {
  const ws      = weekStart(currentDate);
  const days    = Array.from({length: 7}, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return d;
  });
  const tKey    = todayKey();
  const now     = new Date();
  const totalH  = (TL_END - TL_START) * weekHourPx;

  const TCW = 54; // --tcw CSS変数(54px)と合わせること
  // null = フレキシブルモード(monthと同幅), 数値 = px固定
  function getColTemplate() {
    if (weekColWidths.every(w => w === null)) return null;
    return `${TCW}px ${weekColWidths.map(w => (w || 100) + 'px').join(' ')}`;
  }
  function getTotalW() { return TCW + weekColWidths.reduce((a, b) => a + (b || 100), 0); }

  const colTpl   = getColTemplate();
  const hdrStyle = colTpl ? ` style="grid-template-columns:${colTpl};min-width:${getTotalW()}px"` : '';
  const innerCSS = colTpl
    ? `height:${totalH}px;grid-template-columns:${colTpl};min-width:${getTotalW()}px;--hour-px:${weekHourPx}px`
    : `height:${totalH}px;--hour-px:${weekHourPx}px`;

  let hdr = `<div class="week-header-row"${hdrStyle}><div class="week-time-spacer"></div>`;
  days.forEach((day, i) => {
    const dow     = day.getDay();
    const key     = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
    const isToday = key === tKey;
    const cls = 'week-day-header' +
      (dow === 0  ? ' sunday'   : '') +
      (dow === 6  ? ' saturday' : '') +
      (isToday    ? ' today'    : '');
    hdr += `<div class="${cls}" data-date="${key}">
               <span class="wh-name">${WEEKDAYS[dow]}</span>
               <span class="wh-num">${day.getDate()}</span>
               <div class="week-col-resizer" data-col="${i}"></div>
             </div>`;
  });
  hdr += '</div>';

  const weFmt  = d => `${d.getMonth()+1}/${d.getDate()}`;
  const wEnd   = days[6];
  const wRange = `${ws.getFullYear()}年 ${weFmt(ws)}(Sun) 〜 ${weFmt(wEnd)}(Sat)`;
  const wToday = `today ${now.getMonth()+1}/${now.getDate()}`;
  const weekBar = `<div class="calendar-range-bar">
    <button class="range-nav-btn" id="range-prev">◀</button>
    <span class="range-center">
      <span class="range-text">${wRange}</span>
      <span class="range-today-pill" id="range-today-pill">${wToday}</span>
    </span>
    <button class="range-nav-btn" id="range-next">▶</button>
  </div>`;

  calAreaEl.innerHTML = `
    <div class="week-view">
      ${weekBar}
      <div class="week-outer-scroll" id="week-outer-scroll">
        ${hdr}
        <div class="week-inner" id="week-inner" style="${innerCSS}">
          <div class="week-time-axis" id="week-time-axis" style="height:${totalH}px"></div>
          ${days.map((_, i) => `<div class="week-day-col" id="wdc-${i}" style="height:${totalH}px"></div>`).join('')}
        </div>
      </div>
    </div>`;

  $('range-prev').onclick = navPrev;
  $('range-next').onclick = navNext;
  $('range-today-pill').onclick = goToday;

  // 日付ヘッダー・空きスロットのクリックは無効（week表示は閲覧のみ）

  // カラムリサイズハンドル
  function updateGridTemplates() {
    const tmpl = getColTemplate();
    if (!tmpl) return;
    const totalW = getTotalW();
    const hdrEl  = document.querySelector('.week-header-row');
    const innerEl = $('week-inner');
    if (hdrEl)   { hdrEl.style.gridTemplateColumns = tmpl; hdrEl.style.minWidth = totalW + 'px'; }
    if (innerEl) { innerEl.style.gridTemplateColumns = tmpl; innerEl.style.minWidth = totalW + 'px'; }
  }

  // 共通リサイズアタッチ（ヘッダーハンドルと全高ハンドルで共用）
  function attachColResize(el, colIdx) {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (weekColWidths.every(w => w === null)) {
        document.querySelectorAll('.week-day-col').forEach((c, idx) => {
          weekColWidths[idx] = Math.round(c.getBoundingClientRect().width);
        });
      }
      const startX = e.clientX;
      const startW = weekColWidths[colIdx] || 100;
      const onMove = mv => {
        weekColWidths[colIdx] = Math.max(60, startW + (mv.clientX - startX));
        updateGridTemplates();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  document.querySelectorAll('.week-col-resizer').forEach(handle => {
    attachColResize(handle, parseInt(handle.dataset.col));
  });

  buildTimeAxis($('week-time-axis'), totalH, weekHourPx);

  const weekScrollEl = $('week-outer-scroll');
  days.forEach((day, i) => {
    const key    = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
    const col    = $(`wdc-${i}`);
    if (key === tKey) col.classList.add('today-col');

    const dayRes = forDate(key);
    const laid   = assignColumns(dayRes);

    // week表示は閲覧のみ — 空きスロットクリックでの予約追加は行わない

    // 全高リサイズハンドル（列の右端・ヘッダー以外の全体）
    const vResizer = mkEl('div', 'week-col-vresizer');
    attachColResize(vResizer, i);
    col.appendChild(vResizer);

    laid.forEach(res => {
      const eq     = findEq(res.equipment);
      if (!eq) return;
      const startM = timeToMin(res.startTime || '00:00');
      const endM   = timeToMin(res.endTime   || '24:00');
      const cStart = Math.max(startM, TL_START * 60);
      const cEnd   = Math.min(endM,   TL_END   * 60);
      if (cStart >= cEnd) return;

      const topPx    = (cStart - TL_START * 60) / 60 * weekHourPx;
      const heightPx = Math.max((cEnd - cStart) / 60 * weekHourPx, 22);
      const GAP = 2;
      const L = `calc(${res._col * 100 / res._totalCols}% + ${GAP}px)`;
      const W = `calc(${100 / res._totalCols}% - ${GAP * 2}px)`;

      const block = mkEl('div', 'week-event');
      block.dataset.user = res.user || '';
      block.style.cssText =
        `top:${topPx}px;height:${heightPx}px;left:${L};width:${W};` +
        `background:${eq.color};color:${textColor(eq.color)};`;
      block.innerHTML =
        `<div class="we-name">${escHtml(eq.name)}</div>` +
        (heightPx >= 40 ? `<div class="we-time">${res.startTime || ''}–${res.endTime || ''}</div>` : '') +
        (heightPx >= 56 && res.user  ? `<div class="we-user">${escHtml(res.user)}</div>` : '') +
        (heightPx >= 72 && res.notes ? `<div class="we-notes">${escHtml(res.notes)}</div>` : '');
      block.title = tooltip(res, eq);
      // week表示は閲覧のみ — 予約ブロッククリックは無効
      col.appendChild(block);
    });
  });

  const nowKey  = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIdx = days.findIndex(d =>
    dateKey(d.getFullYear(), d.getMonth(), d.getDate()) === nowKey
  );
  if (todayIdx !== -1) {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const topPx   = (nowMins - TL_START * 60) / 60 * weekHourPx;
    const col     = $(`wdc-${todayIdx}`);
    const ind     = mkEl('div', 'week-now-indicator');
    ind.style.top = topPx + 'px';
    ind.innerHTML = `<div class="week-now-dot"></div><div class="week-now-line"></div>`;
    col.appendChild(ind);
    weekScrollEl.scrollTop = Math.max(topPx - weekHourPx, 0);
  }
}

// ─── Time Axis ────────────────────────────────────────────
function buildTimeAxis(axisEl, totalH, hourPx = HOUR_PX) {
  axisEl.style.position = 'relative';
  for (let h = TL_START; h <= TL_END; h++) {
    const topPx = (h - TL_START) * hourPx;

    const mark = mkEl('div', 'tl-hour-mark');
    mark.style.top = topPx + 'px';
    axisEl.appendChild(mark);

    const label = mkEl('div', 'tl-hour-label', `${pad(h)}:00`);
    label.style.top = topPx + 'px';
    axisEl.appendChild(label);

    if (h < TL_END) {
      const half = mkEl('div', 'tl-hour-mark half-hour');
      half.style.top = (topPx + hourPx / 2) + 'px';
      axisEl.appendChild(half);
    }
  }
}

// ──────────────────────────────────────────────────────────
// DAY DETAIL MODAL
// ──────────────────────────────────────────────────────────
function openDayModal(key) {
  dayModalDate = key;
  const d = parseKey(key);
  $('day-modal-title').textContent =
    `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
  renderDayTimeline(key);
  dayModalOverlay.classList.add('open');
}

function closeDayModal() { dayModalOverlay.classList.remove('open'); }

function renderDayTimeline(key) {
  const dayRes = forDate(key);
  const totalH = (TL_END - TL_START) * HOUR_PX;
  dayTlWrap.innerHTML = '';

  if (!dayRes.length) {
    dayTlWrap.innerHTML = '<div class="no-reservations">この日の予約はありません</div>';
    return;
  }

  const outer = mkEl('div', 'tl-outer');
  outer.style.height = totalH + 'px';

  const axis = mkEl('div');
  axis.style.cssText = 'position:absolute;left:0;top:0;width:var(--tcw);height:100%;';
  buildTimeAxis(axis, totalH);
  outer.appendChild(axis);

  const bg = mkEl('div', 'tl-grid-bg');
  outer.appendChild(bg);

  const tKey = todayKey();
  if (key === tKey) {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const topPx = (mins - TL_START * 60) / 60 * HOUR_PX;
    const line = mkEl('div', 'tl-now-line-modal'); line.style.top = topPx + 'px';
    const dot  = mkEl('div', 'tl-now-dot-modal');  dot.style.top  = topPx + 'px';
    outer.appendChild(line);
    outer.appendChild(dot);
  }

  const laid = assignColumns(dayRes);
  laid.forEach(res => {
    const eq     = findEq(res.equipment);
    if (!eq) return;
    const startM = timeToMin(res.startTime || '00:00');
    const endM   = timeToMin(res.endTime   || '24:00');
    const cStart = Math.max(startM, TL_START * 60);
    const cEnd   = Math.min(endM,   TL_END   * 60);
    if (cStart >= cEnd) return;

    const topPx    = (cStart - TL_START * 60) / 60 * HOUR_PX;
    const heightPx = Math.max((cEnd - cStart) / 60 * HOUR_PX, 22);
    const GAP = 3;
    const L = `calc(var(--tcw) + ${res._col * 100 / res._totalCols}% + ${GAP}px)`;
    const W = `calc(${100 / res._totalCols}% - ${GAP * 2}px)`;

    const block = mkEl('div', 'tl-event');
    block.style.cssText =
      `top:${topPx}px;height:${heightPx}px;left:${L};width:${W};` +
      `background:${eq.color};color:${textColor(eq.color)};`;
    block.innerHTML =
      `<div class="tl-event-name">${eq.name}</div>` +
      (heightPx >= 38 ? `<div class="tl-event-time">${res.startTime || ''}–${res.endTime || ''}</div>` : '') +
      (heightPx >= 54 && res.user  ? `<div class="tl-event-user">${res.user}</div>` : '') +
      (heightPx >= 70 && res.notes ? `<div class="tl-event-notes">${escHtml(res.notes)}</div>` : '');
    block.title = tooltip(res, eq);
    block.addEventListener('click', () => { closeDayModal(); openModal(key, res.id); });
    outer.appendChild(block);
  });

  dayTlWrap.appendChild(outer);
}

// ──────────────────────────────────────────────────────────
// RESERVATION MODAL
// ──────────────────────────────────────────────────────────
function openModal(dk = null, resId = null, preStart = null, preEnd = null) {
  if (resId) {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    // PINが設定されている場合は入力を要求
    if (res.pin) {
      showPinPrompt(res.pin, () => _openModalInner(dk, resId, preStart, preEnd));
      return;
    }
  }
  _openModalInner(dk, resId, preStart, preEnd);
}

function showPinPrompt(correctPin, onSuccess) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45)';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:28px 36px;max-width:320px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.22);text-align:center;';
  box.innerHTML = `
    <div style="font-size:1.5rem;margin-bottom:8px;">🔒</div>
    <p style="font-size:1.05rem;font-weight:700;margin-bottom:16px;color:#1a202c;">編集ロックPINを入力</p>
    <input id="pin-prompt-input" type="password" maxlength="4" inputmode="numeric"
      style="width:120px;text-align:center;letter-spacing:0.3em;font-size:1.4rem;padding:8px;border:2px solid #cbd5e0;border-radius:8px;outline:none;">
    <p id="pin-prompt-err" style="color:#ef4444;font-size:0.85rem;margin-top:8px;min-height:1.2em;"></p>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:12px;">
      <button id="pin-cancel-btn" style="padding:8px 24px;border-radius:8px;border:1.5px solid #cbd5e0;background:#fff;font-size:1rem;cursor:pointer;">キャンセル</button>
      <button id="pin-ok-btn" style="padding:8px 24px;border-radius:8px;border:none;background:#4361ee;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;">OK</button>
    </div>`;
  ov.appendChild(box);
  document.body.appendChild(ov);
  const inp = box.querySelector('#pin-prompt-input');
  const err = box.querySelector('#pin-prompt-err');
  setTimeout(() => inp.focus(), 60);
  const confirm = () => {
    if (inp.value === correctPin) { ov.remove(); onSuccess(); }
    else { err.textContent = 'PINが違います'; inp.value = ''; inp.focus(); }
  };
  box.querySelector('#pin-ok-btn').onclick = confirm;
  box.querySelector('#pin-cancel-btn').onclick = () => ov.remove();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
}

function _openModalInner(dk = null, resId = null, preStart = null, preEnd = null) {
  editingId = resId;
  if (resId) {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    $('modal-title').textContent = '予約編集';
    fEquipment.value = res.equipment;
    fUser.value      = res.user      || '';
    fDate.value      = res.date;
    fStart.value     = res.startTime || '';
    fEnd.value       = res.endTime   || '';
    fNotes.value     = res.notes     || '';
    fPin.value       = res.pin       || '';
    btnDelete.style.display = 'inline-block';
  } else {
    $('modal-title').textContent = '予約追加';
    fEquipment.value = '';
    fUser.value      = '';
    fDate.value      = dk || todayKey();
    fStart.value     = preStart || '10:00';
    fEnd.value       = preEnd   || '18:00';
    fNotes.value     = '';
    fPin.value       = '';
    btnDelete.style.display = 'none';
  }
  updateEqDot();
  fStart.classList.remove('invalid');
  fEnd.classList.remove('invalid');
  // ドラッグ位置リセット
  const modalEl = document.querySelector('#modal-overlay .modal');
  if (modalEl) { modalEl.style.position = ''; modalEl.style.left = ''; modalEl.style.top = ''; modalEl.style.margin = ''; }
  modalOverlay.classList.add('open');
  setTimeout(() => fUser.focus(), 60);
}

function closeModal() { modalOverlay.classList.remove('open'); editingId = null; }

async function saveReservation() {
  const rawStart = fStart.value.trim();
  const rawEnd   = fEnd.value.trim();
  const start    = rawStart ? parseTimeInput(rawStart) : '';
  const end      = rawEnd   ? parseTimeInput(rawEnd)   : '';

  if (rawStart && start === null) { fStart.classList.add('invalid'); fStart.focus(); return; }
  if (rawEnd   && end   === null) { fEnd.classList.add('invalid');   fEnd.focus();   return; }
  fStart.value = start || '';
  fEnd.value   = end   || '';

  const user = fUser.value.trim();
  const date = fDate.value;

  if (!fEquipment.value) { showAlert('装置を選択してください。'); return; }
  if (!date) { showAlert('日付を入力してください。'); fDate.focus(); return; }
  if (!user) { showAlert('予約者名を入力してください。'); fUser.focus(); return; }
  if (start && end && start >= end) { showAlert('終了時刻は開始時刻より後にしてください。'); return; }

  const data = {
    equipment: fEquipment.value,
    user, date,
    startTime: start || '',
    endTime:   end   || '',
    notes:     fNotes.value.trim(),
    pin:       fPin.value.trim() || '',
  };

  // 同じ装置・同じ日付の時間帯重複チェック（部分重複は差分で自動調整）
  if (start && end) {
    const conflicts = reservations.filter(r => {
      if (r.equipment !== data.equipment) return false;
      if (r.date !== data.date) return false;
      if (editingId && r.id === editingId) return false;
      if (!r.startTime || !r.endTime) return false;
      return r.startTime < end && r.endTime > start;
    });
    if (conflicts.length > 0) {
      // 完全一致チェック（同一時間帯）
      const exact = conflicts.find(r => r.startTime === start && r.endTime === end);
      if (exact) {
        showAlert(`この時間帯はすでに予約されています。\n（${exact.user} ${exact.startTime}〜${exact.endTime}）`);
        return;
      }
      // 差分スロット計算
      const occupied = conflicts.map(r => [r.startTime, r.endTime])
        .sort((a, b) => a[0] < b[0] ? -1 : 1);
      let free = [[start, end]];
      for (const [os, oe] of occupied) {
        const nf = [];
        for (const [fs, fe] of free) {
          if (oe <= fs || os >= fe) { nf.push([fs, fe]); }
          else {
            if (fs < os) nf.push([fs, os]);
            if (oe < fe) nf.push([oe, fe]);
          }
        }
        free = nf;
      }
      if (free.length === 0) {
        showAlert('この時間帯は全て予約済みです。');
        return;
      }
      // 差分スロットが1つ → 自動調整して保存
      if (free.length === 1) {
        data.startTime = free[0][0];
        data.endTime   = free[0][1];
      } else {
        // 複数スロット → 最初のスロットで調整し通知
        data.startTime = free[0][0];
        data.endTime   = free[0][1];
        const slots = free.map(([s,e]) => `${s}〜${e}`).join(', ');
        showAlert(`重複のない時間帯に自動調整しました。\n（空き: ${slots}）\n先頭の ${data.startTime}〜${data.endTime} で予約します。`);
      }
    }
  }

  if (editingId) {
    const updated = await apiUpdateReservation(editingId, data);
    const idx  = reservations.findIndex(r => r.id === editingId);
    const prev = { ...reservations[idx] };
    reservations[idx] = updated;
    addLog('edit', updated, prev);
  } else {
    const newRes = await apiCreateReservation(data);
    reservations.push(newRes);
    addLog('create', newRes);
  }
  saveUser(user);
  closeModal();
  renderView();
  if (dayModalDate && dayModalOverlay.classList.contains('open')) renderDayTimeline(dayModalDate);
}

async function confirmDelete() {
  if (!editingId) return;
  const res = reservations.find(r => r.id === editingId);
  if (res?.pin && fPin.value !== res.pin) {
    showAlert('PINが設定されています。編集フォームから正しいPINで開いてください。');
    return;
  }
  if (!confirm('この予約を削除しますか？')) return;
  const res = reservations.find(r => r.id === editingId);
  if (res) addLog('delete', res);
  await apiDeleteReservation(editingId);
  reservations = reservations.filter(r => r.id !== editingId);
  closeModal();
  renderView();
  if (dayModalDate && dayModalOverlay.classList.contains('open')) renderDayTimeline(dayModalDate);
}

// ──────────────────────────────────────────────────────────
// LOG SYSTEM
// ──────────────────────────────────────────────────────────
function addLog(action, res, prev = null) {
  const entry = { id: genId(), ts: Date.now(), action, res: {...res}, prev: prev ? {...prev} : null };
  logs.unshift(entry);
  if (logs.length > 1000) logs = logs.slice(0, 1000);
  persistLog(entry);
}

function openLog() {
  buildLogEqFilter();
  renderLogBody();
  logDrawer.classList.add('open');
  logOverlay.classList.add('open');
}

function closeLog() {
  logDrawer.classList.remove('open');
  logOverlay.classList.remove('open');
}

function buildLogEqFilter() {
  const sel = $('log-eq-filter');
  sel.innerHTML = '<option value="">すべての装置</option>' +
    EQUIPMENT.map(eq => `<option value="${eq.id}">${eq.name}</option>`).join('');
  sel.value = logEqFilter;
}

function renderLogBody() {
  const filtered = logs.filter(e =>
    (logAction === 'all' || e.action === logAction) &&
    (!logEqFilter || e.res.equipment === logEqFilter)
  );
  $('log-count').textContent = `${filtered.length} 件`;
  if (!filtered.length) {
    logBody.innerHTML = '<div class="log-empty">該当するログはありません</div>';
    return;
  }
  logBody.innerHTML = filtered.map(renderLogEntry).join('');
}

function renderLogEntry(entry) {
  const eq  = findEq(entry.res.equipment);
  const dt  = new Date(entry.ts);
  const ts  = `${dt.getFullYear()}/${pad(dt.getMonth()+1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const BADGE = { create:['新規作成','badge-create'], edit:['編集','badge-edit'], delete:['削除','badge-delete'] };
  const [label, cls] = BADGE[entry.action] || ['不明',''];
  const t = timeRange(entry.res);

  let diffHtml = '';
  if (entry.action === 'edit' && entry.prev) {
    const diffs = computeDiff(entry.prev, entry.res);
    if (diffs.length) {
      diffHtml = `<div class="log-diff">
        <div class="log-diff-title">変更内容</div>
        ${diffs.map(d => `<div class="log-diff-item">${escHtml(d)}</div>`).join('')}
      </div>`;
    }
  }

  return `<div class="log-entry">
    <div class="log-entry-top">
      <span class="log-badge ${cls}">${label}</span>
      <span class="log-ts">${ts}</span>
    </div>
    ${eq ? `<span class="log-eq-chip" style="background:${eq.color};color:${textColor(eq.color)}">${eq.name}</span>` : ''}
    <div class="log-meta">
      ${entry.res.user ? `<div class="log-meta-item"><span class="log-meta-label">予約者</span> ${escHtml(entry.res.user)}</div>` : ''}
      ${entry.res.date ? `<div class="log-meta-item"><span class="log-meta-label">日付</span> ${entry.res.date}</div>` : ''}
      ${t              ? `<div class="log-meta-item"><span class="log-meta-label">時刻</span> ${t}</div>` : ''}
    </div>
    ${entry.res.notes ? `<div class="log-notes-text">${escHtml(entry.res.notes)}</div>` : ''}
    ${diffHtml}
  </div>`;
}

const DIFF_LABELS = {
  equipment: ['装置',     id => findEq(id)?.name || id],
  user:      ['予約者',   v => v],
  date:      ['日付',     v => v],
  startTime: ['開始時刻', v => v],
  endTime:   ['終了時刻', v => v],
  notes:     ['備考',     v => v],
};

function computeDiff(prev, curr) {
  return Object.entries(DIFF_LABELS).flatMap(([key, [label, fmt]]) => {
    if ((prev[key]||'') === (curr[key]||'')) return [];
    return [`${label}: ${fmt(prev[key])||'(なし)'} → ${fmt(curr[key])||'(なし)'}`];
  });
}

async function clearLog() {
  if (!confirm('すべてのログを削除しますか？')) return;
  logs = [];
  await apiClearLogs();
  renderLogBody();
}

// ─── Overlap column assignment ────────────────────────────
function assignColumns(resList) {
  const sorted = [...resList].sort((a, b) =>
    timeToMin(a.startTime || '00:00') - timeToMin(b.startTime || '00:00')
  );
  const colEnds = [];
  const result = sorted.map(res => {
    const s = timeToMin(res.startTime || '00:00');
    const e = timeToMin(res.endTime   || '24:00');
    let col = colEnds.findIndex(t => t <= s);
    if (col === -1) col = colEnds.length;
    colEnds[col] = e;
    return { ...res, _col: col };
  });
  result.forEach(res => {
    const s = timeToMin(res.startTime || '00:00');
    const e = timeToMin(res.endTime   || '24:00');
    let maxCol = res._col;
    result.forEach(other => {
      if (other === res) return;
      const os = timeToMin(other.startTime || '00:00');
      const oe = timeToMin(other.endTime   || '24:00');
      if (s < oe && e > os) maxCol = Math.max(maxCol, other._col);
    });
    res._totalCols = maxCol + 1;
  });
  return result;
}

// ─── Utilities ───────────────────────────────────────────
// 日付→予約一覧のMapキャッシュ（renderView前に再構築）
let _forDateMap = null;
function buildForDateMap() {
  _forDateMap = new Map();
  reservations.forEach(r => {
    if (!_forDateMap.has(r.date)) _forDateMap.set(r.date, []);
    _forDateMap.get(r.date).push(r);
  });
  _forDateMap.forEach(arr => arr.sort((a, b) => (a.startTime||'').localeCompare(b.startTime||'')));
}
function forDate(key) {
  return _forDateMap ? (_forDateMap.get(key) || []) : reservations.filter(r => r.date === key);
}

function todayKey() {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth(), n.getDate());
}

function dateKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function parseKey(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }

function weekStart(date) {
  const d = new Date(date); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d;
}

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function timeRange(res) {
  return (res.startTime || res.endTime)
    ? `${res.startTime||'?'}–${res.endTime||'?'}` : '';
}

function tooltip(res, eq) {
  const lines = [eq.name];
  if (res.user)       lines.push('予約者: ' + res.user);
  if (timeRange(res)) lines.push('時刻: '   + timeRange(res));
  if (res.notes)      lines.push('備考: '   + res.notes);
  return lines.join('\n');
}

function findEq(id)  { return EQUIPMENT.find(e => e.id === id); }

// ─── カスタムアラート ─────────────────────────────────────
function showAlert(msg) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45)';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:32px 40px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.22);text-align:center;';
  const p = document.createElement('p');
  p.style.cssText = 'font-size:1.15rem;font-weight:600;margin-bottom:24px;white-space:pre-wrap;line-height:1.6;color:#1a202c;';
  p.textContent = msg;
  const btn = document.createElement('button');
  btn.textContent = 'OK';
  btn.style.cssText = 'padding:10px 40px;border-radius:8px;border:none;background:#4361ee;color:#fff;font-size:1.05rem;font-weight:700;cursor:pointer;';
  btn.onclick = () => ov.remove();
  box.appendChild(p); box.appendChild(btn);
  ov.appendChild(box);
  document.body.appendChild(ov);
  btn.focus();
}

// ─── モーダルドラッグ移動 ─────────────────────────────────
function makeDraggable(modal, handle) {
  if (!modal || !handle) return;
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const rect = modal.getBoundingClientRect();
    modal.style.position = 'fixed';
    modal.style.margin   = '0';
    modal.style.left     = rect.left + 'px';
    modal.style.top      = rect.top  + 'px';
    let ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    const onMove = e => {
      modal.style.left = Math.max(0, e.clientX - ox) + 'px';
      modal.style.top  = Math.max(0, e.clientY - oy) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function pad(n)      { return String(n).padStart(2, '0'); }
function genId()     { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function textColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.52 ? '#1a202c' : '#ffffff';
}

function mkEl(tag, cls='', text='') {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Start ───────────────────────────────────────────────
init();
