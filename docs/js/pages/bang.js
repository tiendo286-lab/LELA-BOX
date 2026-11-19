// Bảng 12 box lúc này: trạng thái, khách vào / về, đổi box, nhắc việc.
import { html, str, $, on, openSheet, toast, showError } from '../ui.js';
import { fmtMin, fmtDur, fromMs, atMs, toMin } from '../time.js';
import { boxState, reminders, summary, fmtPhone } from '../board.js';
import { checkCheckIn, extraHours } from '../rules.js';
import { mountReminders } from './nhac.js';

const KIND_TEXT = { trong: 'Trống', ngoi: 'Đang ngồi', sap_het: 'Sắp hết giờ', qua_gio: 'Quá giờ', tam_ngung: 'Tạm ngừng' };

export default async function render(root, ctx) {
  const { store } = ctx;
  let snap = null;

  root.innerHTML = str(html`<div id="nhac"></div><p class="sum" id="sum"></p><div class="tiles" id="tiles"></div>
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
        ${x.next ? html`<span class="t-next">đặt ${fmtMin(x.next.startMin)}</span>` : ''}
      </button>`)}`);
    mountReminders($('#nhac', root), reminders(live(), snap.boxes, snap.customers, now, s), openBox);
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
      <div id="step" class="actions"><button class="primary" data-act="out">Khách về</button><button data-act="move">Đổi box</button><button data-act="edit">Sửa giờ vào</button></div>`);
    const el = sh.el, step = $('#step', el);
    const inDate = fromMs(v.inAt).date;
    const calc = (outMin) => { const mins = Math.floor((atMs(inDate, outMin) - v.inAt) / 60000); return `Ngồi ${fmtDur(mins)} → tính thêm ${extraHours(mins, s)} giờ`; };
    on(el, 'click', '[data-act="out"]', () => {
      const nowMin = fromMs(ctx.now()).min;
      step.innerHTML = str(html`<label>Giờ ra<input name="out" type="time" value="${fmtMin(nowMin)}"></label>
        <p class="big" id="calc">${calc(nowMin)}</p>
        <button class="primary" data-act="out-ok">Xác nhận khách về</button>`);
      $('[name="out"]', step).addEventListener('input', (e) => { $('#calc', step).textContent = calc(toMin(e.target.value)); });
    });
    on(el, 'click', '[data-act="out-ok"]', async () => {
      const outMin = toMin($('[name="out"]', step).value);
      const nowMin = fromMs(ctx.now()).min;
      sh.close();
      await act(async () => {
        let r = await store.checkOut(v.id);
        if (outMin !== nowMin) r = await store.editTimes(v.id, { outAt: atMs(inDate, outMin) });
        return r;
      }, (r) => `${b.name}: khách về — ngồi ${fmtDur(r.minutes)}, tính thêm ${r.extra} giờ`);
    });
    on(el, 'click', '[data-act="move"]', () => {
      const alts = checkCheckIn(b.id, cctx(), v.id).alternatives;
      const free = snap.boxes.filter((x) => x.active !== false && x.id !== b.id && !live().some((y) => y.boxId === x.id && y.status === 'ngoi'));
      step.innerHTML = str(html`<p class="small muted">Chọn box mới (★ = trống đủ ${s.freeMin / 60} giờ):</p>
        <div class="actions">${free.map((x) => html`<button data-move="${x.id}">${x.name}${alts.includes(x.id) ? ' ★' : ''}</button>`)}</div>`);
    });
    on(el, 'click', '[data-move]', async (e, x) => { sh.close(); await act(() => store.moveBox(v.id, x.dataset.move), `Đã đổi sang ${boxOf(x.dataset.move).name}`); });
    on(el, 'click', '[data-act="edit"]', () => {
      step.innerHTML = str(html`<label>Giờ vào<input name="in" type="time" value="${fmtMin(fromMs(v.inAt).min)}"></label>
        <button class="primary" data-act="edit-ok">Lưu giờ vào</button>`);
    });
    on(el, 'click', '[data-act="edit-ok"]', async () => {
      const m = toMin($('[name="in"]', step).value);
      sh.close();
      await act(() => store.editTimes(v.id, { inAt: atMs(inDate, m) }), 'Đã sửa giờ vào');
    });
  }

  on(root, 'click', '.tile', (e, t) => openBox(t.dataset.box));
  await draw();
  const timer = setInterval(() => { if (!document.querySelector('.sheet-bg')) draw(); }, 30000);
  return () => clearInterval(timer);
}
