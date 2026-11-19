// Khung web: đăng nhập, thanh trên, tab, định tuyến #/...
import { makeStore } from './store/index.js';
import * as clock from './clock.js';
import { fmtMin, fromMs } from './time.js';
import { reminders } from './board.js';
import { mountReminders } from './pages/nhac.js';
import { html, str, $, on, toast, closeSheets } from './ui.js';

clock.fromQuery(location.search);

const PAGES = {
  '#/bang': { title: 'Bảng box', load: () => import('./pages/bang.js') },
  '#/lich': { title: 'Lịch', load: () => import('./pages/lich.js') },
  '#/khach': { title: 'Khách', load: () => import('./pages/khach.js') },
  '#/bao-cao': { title: 'Báo cáo', load: () => import('./pages/bao_cao.js'), roles: ['chu'] },
  '#/cai-dat': { title: 'Cài đặt', load: () => import('./pages/cai_dat.js'), roles: ['chu', 'ql'] },
};
const TEST_USER = { chu: 'u_chu', ql: 'u_ql', nv: 'u_a' };

const root = $('#app');
let store = null, me = null, cleanup = null, tick = null;

function parseHash() {
  const [path, qs] = (location.hash || '#/bang').split('?');
  return { path: PAGES[path] ? path : '#/bang', params: new URLSearchParams(qs || '') };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

async function start() {
  store = await makeStore();
  const role = new URLSearchParams(location.search).get('role');
  if (role && TEST_USER[role] && store.kind === 'local') await store.login(TEST_USER[role]);
  me = await store.me();
  window.__lela = { store, restart, ready: true };
  render();
}

async function restart() {
  if (cleanup) { try { cleanup(); } catch { /* bỏ qua */ } cleanup = null; }
  window.__lela.ready = false;
  store = await makeStore();
  me = await store.me();
  window.__lela = { store, restart, ready: true };
  await render();
}

async function showLogin() {
  const staff = store.kind === 'local' ? await store.listStaff() : [];
  root.innerHTML = str(html`<div class="login card">
    <h1>Lela Box</h1>
    ${store.kind === 'local'
      ? html`<p class="muted small">Bản chạy thử — chọn người để vào:</p>
        ${staff.map((u) => html`<button type="button" data-login="${u.id}">${u.name}</button>`)}`
      : html`<form id="f-login"><label>Email<input name="email" type="email" required autocomplete="username"></label>
        <label>Mật khẩu<input name="pw" type="password" required autocomplete="current-password"></label>
        <button class="primary" type="submit">Đăng nhập</button></form>`}
  </div>`);
  on(root, 'click', '[data-login]', async (e, b) => { me = await store.login(b.dataset.login); render(); });
  const f = $('#f-login', root);
  if (f) f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { me = await store.login(f.email.value, f.pw.value); render(); } catch (err) { toast(err.message, 'err'); }
  });
}

function clockText() { return fmtMin(fromMs(clock.now()).min); }

async function render() {
  if (cleanup) { try { cleanup(); } catch { /* bỏ qua */ } cleanup = null; }
  closeSheets();
  if (!me) return showLogin();
  let { path, params } = parseHash();
  const allowed = (p) => !p.roles || p.roles.includes(me.role);
  if (!allowed(PAGES[path])) { location.replace('#/bang'); path = '#/bang'; }
  const settings = await store.getSettings();
  root.innerHTML = str(html`
    <header class="topbar"><span class="brand">Lela Box</span><span class="clock" id="clock">${clockText()}</span>
      <span class="who">${me.name}</span><button type="button" id="logout">Đăng xuất</button></header>
    ${store.volatile ? html`<div class="volatile">Dữ liệu chạy thử sẽ mất khi tải lại trang (trình duyệt chặn lưu).</div>` : ''}
    <nav class="tabs">${Object.entries(PAGES).filter(([, p]) => allowed(p))
      .map(([h, p]) => html`<a href="${h}" class="${h === path ? 'on' : ''}">${p.title}</a>`)}</nav>
    <div id="nhac-app" class="nhac-wrap"></div>
    <main id="page"><p class="loading">Đang tải…</p></main>`);
  $('#logout').onclick = async () => { await store.logout(); me = null; render(); };
  const page = $('#page');
  const ctx = { store, me, settings, params, go, refresh: render, now: clock.now, refreshReminders: pollReminders };
  try {
    const mod = await PAGES[path].load();
    cleanup = (await mod.default(page, ctx)) || null;
    await pollReminders();
  } catch (e) {
    page.innerHTML = str(html`<p class="err">Không mở được trang: ${e.message}</p>`);
    console.error(e);
  }
}

// Nhắc việc + chuông chạy ở MỌI tab (nhân viên hay ở tab Lịch khi chat TikTok)
async function pollReminders() {
  const el = $('#nhac-app');
  if (!el || !me) return;
  try {
    const now = clock.now();
    const snap = await store.snapshot(fromMs(now).date);
    const live = snap.visits.filter((v) => v.status === 'dat' || v.status === 'ngoi');
    mountReminders(el, reminders(live, snap.boxes, snap.customers, now, snap.settings, snap.orderStats), (boxId) => go('#/bang?box=' + boxId));
  } catch (e) { /* lần sau thử lại */ }
}
setInterval(pollReminders, 30000);

window.addEventListener('hashchange', render);
clearInterval(tick);
tick = setInterval(() => { const c = $('#clock'); if (c) c.textContent = clockText(); }, 15000);
start();
