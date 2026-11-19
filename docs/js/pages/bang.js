// Bảng 12 box lúc này: trạng thái, khách vào / về, đổi box, nhắc việc.
import { html, str, $, on, openSheet, toast, showError } from '../ui.js';
import { fmtMin, fmtDur, fromMs } from '../time.js';
import { boxState, summary, fmtPhone } from '../board.js';
import { checkCheckIn, extraHours } from '../rules.js';
import { openTimes } from './gio.js';
import { openOrder } from './goi_mon.js';
import { openPay } from './thanh_toan.js';
import { fmtMoney } from '../money.js';

const KIND_TEXT = { trong: 'Trống', ngoi: 'Đang ngồi', sap_het: 'Sắp hết giờ', qua_gio: 'Quá giờ', tam_ngung: 'Tạm ngừng' };

export default async function render(root, ctx) {
  const { store } = ctx;
  let snap = null;

  root.innerHTML = str(html`<p class="sum" id="sum"></p><div class="tiles" id="tiles"></div>
    <p class="muted small">Chạm vào một box để cho khách vào / về. Bảng tự cập nhật mỗi 30 giây.</p>`);

  const cust = (id) => snap.customers.find((c) => c.id === id);
  const who = (v) => (v.customerId ? (cust(v.customerId) || {}).name : v.guestName) || 'Khách lẻ';
  const boxOf = (id) => snap.boxes.find((b) => b.id === id);
  const live = () => snap.visits.filter((v) => v.status === 'dat' || v.status === 'ngoi');
  const cctx = () => ({ settings: snap.settings, boxes: snap.boxes, customers: snap.customers, visits: live(), now: ctx.now(), ignoreVisitIds: [] });

  async function draw() {
    const now = ctx.now();
    snap = await store.snapshot(fromMs(now).date);
    const s = snap.settings;
    const shown = snap.boxes.filter((b) => b.active !== false);
    const states = shown.map((b) => ({ box: b, ...boxState(b, live(), now, s) }));
    const sm = summary(states);
    $('#sum', root).textContent = `Trống ${sm.trong} · Đang ngồi ${sm.ngoi} · Sắp đặt ${sm.sapDat}`;
    $('#tiles', root).innerHTML = str(html`${states.map((x) => html`
      <button type="button" class="tile k-${x.kind}" data-box="${x.box.id}">
        <span class="t-name">${x.box.name}</span>
        <span class="t-main">${x.visit ? fmtDur(x.elapsed) : KIND_TEXT[x.kind]}</span>
        <span class="t-sub">${x.visit ? html`${x.visit.people} người${x.kind === 'qua_gio' ? html` · +${extraHours(x.elapsed, s)} giờ` : ''}` : ''}</span>
        ${x.visit && snap.orderStats && snap.orderStats[x.visit.id] && snap.orderStats[x.visit.id].total ? html`<span class="t-money">${fmtMoney(snap.orderStats[x.visit.id].total)}</span>` : ''}
        ${x.next ? html`<span class="t-next">đặt ${fmtMin(x.next.startMin)}</span>` : ''}
      </button>`)}`);
    if (ctx.refreshReminders) ctx.refreshReminders();
  }

  const act = async (fn, ok) => {
    try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); await draw(); return r; }
    catch (e) { showError(e); await draw(); return null; }
  };

  function openBox(boxId) {
    const b = boxOf(boxId);
    const st = boxState(b, live(), ctx.now(), snap.settings);
    return st.visit ? sheetSitting(b, st) : sheetEmpty(b, st);
  }

  function sheetEmpty(b, st) {
    const s = snap.settings;
    const chk = checkCheckIn(b.id, cctx());
    const n = st.next;
    const nc = n && cust(n.customerId);
    const sh = openSheet(b.name + ' — ' + (n ? `khách đặt ${fmtMin(n.startMin)}` : 'Trống'), html`
      ${n ? html`<div class="card book">
          <b>${who(n)}</b> ${nc ? html`· <a href="tel:${nc.phone}">${fmtPhone(nc.phone)}</a>` : ''}<br>
          <span class="muted small">Đặt ${fmtMin(n.startMin)}–${fmtMin(n.startMin + n.durMin)} · ${n.people} người</span>
          <div class="actions"><button class="primary" data-act="in">Khách vào</button><button data-act="noshow">Không đến</button>
          ${nc ? html`<a class="btn" href="tel:${nc.phone}">Gọi khách</a>` : ''}</div>
        </div>` : ''}
      <div class="card">
        <h2>Khách vãng lai</h2>
        ${chk.warn ? html`<p class="warntext">⚠ ${chk.warn}</p>
          ${chk.alternatives.length ? html`<p class="small muted">Box trống đủ ${s.freeMin / 60} giờ: ${chk.alternatives.map((id) => html`<button type="button" class="pill-btn" data-alt="${id}">${boxOf(id).name}</button>`)}</p>` : ''}` : ''}
        <div class="row">
          <label>Số người<select name="people">${Array.from({ length: s.perBox }, (_, i) => html`<option value="${i + 1}">${i + 1}</option>`)}</select></label>
          <label>Tên (không bắt buộc)<input name="name" autocomplete="off"></label>
          <label>SĐT (không bắt buộc)<input name="phone" inputmode="tel" autocomplete="off"></label>
        </div>
        <div class="actions"><button class="primary" data-act="walkin">Khách vào ngay</button><button data-act="book">Đặt trước box này</button></div>
      </div>`);
    const el = sh.el;
    const val = (k) => $(`[name="${k}"]`, el).value;
    on(el, 'click', '[data-act="walkin"]', async () => {
      const input = { boxId: b.id, people: val('people'), name: val('name'), phone: val('phone') };
      sh.close(); await act(() => store.walkIn(input), `${b.name}: khách đã vào`);
    });
    on(el, 'click', '[data-alt]', (e, x) => { sh.close(); openBox(x.dataset.alt); });
    on(el, 'click', '[data-act="book"]', () => { sh.close(); ctx.go('#/lich?box=' + b.id); });
    on(el, 'click', '[data-act="in"]', async () => { sh.close(); await act(() => store.checkIn(n.id), `${b.name}: khách đã vào`); });
    on(el, 'click', '[data-act="noshow"]', async () => { sh.close(); await act(() => store.noShow(n.id), `${b.name}: đã nhả box`); });
  }

  function sheetSitting(b, st) {
    const v = st.visit, s = snap.settings, c = cust(v.customerId);
    const sh = openSheet(`${b.name} — đang ngồi ${fmtDur(st.elapsed)}`, html`
      <p><b>${who(v)}</b>${c ? html` · <a href="tel:${c.phone}">${fmtPhone(c.phone)}</a>` : ''} · ${v.people} người<br>
      <span class="muted small">Vào lúc ${fmtMin(fromMs(v.inAt).min)} · hết ${s.freeMin / 60} giờ miễn phí lúc ${fmtMin(fromMs(v.inAt + s.freeMin * 60000).min)}</span></p>
      ${st.next ? html`<p class="warntext">⚠ ${fmtMin(st.next.startMin)} có khách đặt box này (${who(st.next)})</p>` : ''}
      <div id="step" class="actions"><button class="primary" data-act="order">Gọi món</button><button data-act="pay">Thanh toán & khách về</button><button data-act="move">Đổi box</button><button data-act="edit">Sửa giờ vào</button></div>`);
    const el = sh.el, step = $('#step', el);
    on(el, 'click', '[data-act="order"]', () => { sh.close(); openOrder(ctx, v, b.name, draw, () => openPay(ctx, v.id, draw)); });
    on(el, 'click', '[data-act="pay"]', () => { sh.close(); openPay(ctx, v.id, draw); });
    on(el, 'click', '[data-act="move"]', () => {
      const alts = checkCheckIn(b.id, cctx(), v.id).alternatives;
      const free = snap.boxes.filter((x) => x.active !== false && x.id !== b.id && !live().some((y) => y.boxId === x.id && y.status === 'ngoi'));
      step.innerHTML = str(html`<p class="small muted">Chọn box mới (★ = trống đủ ${s.freeMin / 60} giờ):</p>
        <div class="actions">${free.map((x) => html`<button data-move="${x.id}">${x.name}${alts.includes(x.id) ? ' ★' : ''}</button>`)}</div>`);
    });
    on(el, 'click', '[data-move]', async (e, x) => { sh.close(); await act(() => store.moveBox(v.id, x.dataset.move), `Đã đổi sang ${boxOf(x.dataset.move).name}`); });
    on(el, 'click', '[data-act="edit"]', () => { sh.close(); openTimes(ctx, v, b.name, s, draw); });
  }

  on(root, 'click', '.tile', (e, t) => openBox(t.dataset.box));
  await draw();
  const want = ctx.params.get('box');
  if (want && boxOf(want)) { history.replaceState(null, '', '#/bang'); openBox(want); }
  const timer = setInterval(() => { if (!document.querySelector('.sheet-bg')) draw(); }, 30000);
  return () => clearInterval(timer);
}
