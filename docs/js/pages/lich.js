// Lịch đặt trước: chọn ngày + giờ → box trống → đặt; lịch cả ngày; tìm phiếu theo SĐT / tên.
import { html, raw, str, $, on } from '../ui.js';
import { fmtMin, fmtDay, fromMs, addDays, slots, atMs, dayWindow } from '../time.js';
import { freeBoxes, suggestBoxCount, STATUS_LABEL } from '../rules.js';
import { fmtPhone } from '../board.js';
import { openBooking } from './phieu.js';
import { openTimes } from './gio.js';

export default async function render(root, ctx) {
  const { store, params } = ctx;
  const now = ctx.now();
  const today = fromMs(now).date;
  let s = await store.getSettings();
  const futureSlots = (d) => slots(s).filter((m) => atMs(d, m) >= now);
  let date = params.get('d') || today;
  if (!futureSlots(date).length && date === today) date = addDays(today, 1);
  let startMin = futureSlots(date)[0] ?? slots(s)[0];
  let durMin = s.holdMin, people = 1;
  const picked = new Set(params.get('box') ? [params.get('box')] : []);
  let snap = null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const durs = []; for (let m = 30; m <= 360; m += 30) durs.push(m);
  const dl = (m) => (m % 60 ? `${Math.floor(m / 60)}g${String(m % 60).padStart(2, '0')}` : `${m / 60} giờ`);

  root.innerHTML = str(html`
    <div class="days" id="days"></div>
    <section class="card">
      <h2>Tìm box trống</h2>
      <div class="row">
        <label>Giờ đến<select id="f-start"></select></label>
        <label>Giữ box<select id="f-dur">${durs.map((m) => html`<option value="${m}" ${m === durMin ? 'selected' : ''}>${dl(m)}</option>`)}</select></label>
        <label>Số người<input id="f-people" type="number" min="1" max="${s.perBox * 3}" value="1"></label>
      </div>
      <p class="small muted" id="hint"></p>
      <div class="picks" id="picks"></div>
      <div class="actions"><button class="primary" id="btn-dat" disabled>Đặt</button><button id="btn-moi">+ Phiếu mới</button></div>
    </section>
    <section class="card">
      <h2>Tìm phiếu đã đặt</h2>
      <input id="q-phieu" placeholder="Gõ số điện thoại hoặc tên khách" autocomplete="off">
      <div id="hits"></div>
    </section>
    <section class="card"><h2 id="sched-title"></h2><div id="sched"></div></section>`);

  const cust = (id) => snap.customers.find((c) => c.id === id);
  const who = (v) => (v.customerId ? (cust(v.customerId) || {}).name : v.guestName) || 'Khách lẻ';
  const boxName = (id) => (snap.boxes.find((b) => b.id === id) || {}).name;
  const cctx = () => ({ settings: s, boxes: snap.boxes, customers: snap.customers, visits: snap.visits.filter((v) => v.status === 'dat' || v.status === 'ngoi'), now: ctx.now(), ignoreVisitIds: [] });

  function drawDays() {
    $('#days', root).innerHTML = str(html`${days.map((d) => html`<button type="button" class="day-chip ${d === date ? 'on' : ''}" data-d="${d}">${d === today ? 'Hôm nay' : fmtDay(d)}</button>`)}`);
    const opts = date === today ? futureSlots(date) : slots(s);
    if (!opts.includes(startMin)) startMin = opts[0] ?? slots(s)[0];
    $('#f-start', root).innerHTML = str(html`${opts.map((m) => html`<option value="${m}" ${m === startMin ? 'selected' : ''}>${fmtMin(m)}</option>`)}`);
  }

  function drawPicks() {
    const free = freeBoxes(date, startMin, durMin, cctx());
    const freeIds = new Set(free.map((b) => b.id));
    [...picked].forEach((id) => { if (!freeIds.has(id)) picked.delete(id); });
    const need = suggestBoxCount(people, s.perBox);
    const { closeMin } = dayWindow(s);
    const over = startMin + durMin > closeMin;
    $('#hint', root).textContent = over ? `Quá giờ đóng cửa (${s.close}) — giảm thời gian giữ box.`
      : `${free.length} box trống ${fmtMin(startMin)}–${fmtMin(startMin + durMin)} · Gợi ý ${need} box cho ${people} người`;
    $('#picks', root).innerHTML = over ? '' : str(html`${free.map((b) => html`<button type="button" class="pick ${picked.has(b.id) ? 'on' : ''}" data-box="${b.id}">${b.name}</button>`)}`);
    const n = picked.size;
    const btn = $('#btn-dat', root);
    btn.disabled = n < 1 || n > 3 || over;
    btn.textContent = n ? `Đặt ${n} box` : 'Chọn box để đặt';
  }

  function span(v) {
    if (v.status === 'dat') return [v.startMin, v.startMin + v.durMin];
    const a = fromMs(v.inAt).min;
    const b = v.outAt ? fromMs(v.outAt).min : Math.max(fromMs(ctx.now()).min, a + (v.durMin || s.freeMin));
    return [a, b];
  }

  function drawSched() {
    $('#sched-title', root).textContent = 'Lịch ' + (date === today ? 'hôm nay' : fmtDay(date));
    const boxes = snap.boxes.filter((b) => b.active !== false);
    const vs = snap.visits.filter((v) => v.date === date && ['dat', 'ngoi', 've'].includes(v.status))
      .map((v) => ({ v, sp: span(v) })).sort((a, b) => a.sp[0] - b.sp[0]);
    const { openMin, closeMin } = dayWindow(s);
    const rows = slots(s);
    const rowOf = (m) => Math.max(0, Math.min(rows.length, Math.round((m - openMin) / 30)));
    const block = (x, extra = '') => html`<button type="button" class="vis st-${x.v.status}" ${x.v.status === 've' ? html`data-visit="${x.v.id}"` : x.v.bookingId ? html`data-booking="${x.v.bookingId}"` : ''} ${raw(extra)}>
      <b>${who(x.v)}</b> <span>${fmtMin(x.sp[0])}–${fmtMin(x.sp[1])}</span>${x.v.status !== 'dat' ? html` · ${STATUS_LABEL[x.v.status]}` : ''}</button>`;
    const grid = html`<div class="grid-view"><div class="sched" style="${`grid-template-columns:52px repeat(${boxes.length}, minmax(64px,1fr))`}">
      <div class="hcell"></div>${boxes.map((b) => html`<div class="hcell">${b.name}</div>`)}
      ${rows.map((m, r) => html`<div class="tcell" style="${`grid-row:${r + 2}`}">${m % 60 ? '' : fmtMin(m)}</div>${boxes.map((b, c) => html`<div class="cell" style="${`grid-row:${r + 2};grid-column:${c + 2}`}"></div>`)}`)}
      ${vs.filter((x) => boxes.some((b) => b.id === x.v.boxId) && x.sp[0] < closeMin).map((x) => block(x, `style="grid-column:${boxes.findIndex((b) => b.id === x.v.boxId) + 2};grid-row:${rowOf(x.sp[0]) + 2} / ${Math.max(rowOf(x.sp[0]) + 1, rowOf(x.sp[1])) + 2}"`))}
    </div></div>`;
    const list = html`<div class="list-view">${vs.length ? vs.map((x) => html`<div class="li"><span class="li-box">${boxName(x.v.boxId)}</span>${block(x)}</div>`) : html`<p class="muted">Chưa có lượt nào.</p>`}</div>`;
    $('#sched', root).innerHTML = str(html`${grid}${list}`);
  }

  async function load() { snap = await store.snapshot(date); s = snap.settings; drawDays(); drawPicks(); drawSched(); }

  async function search(q) {
    const res = await store.findCustomers(q);
    const items = [];
    res.forEach((r) => {
      const groups = {};
      r.visits.filter((v) => v.bookingId && v.status === 'dat').forEach((v) => { (groups[v.bookingId] ||= []).push(v); });
      Object.entries(groups).forEach(([bid, g]) => items.push({ bid, c: r.customer, g }));
    });
    $('#hits', root).innerHTML = q.trim().length < 2 ? '' : str(items.length ? html`${items.map((x) => html`
      <button type="button" class="hit" data-booking="${x.bid}"><b>${x.c.name}</b> · ${fmtPhone(x.c.phone)}<br>
      <span class="small muted">${fmtDay(x.g[0].date)} ${fmtMin(x.g[0].startMin)} · ${x.g.map((v) => (snap.boxes.find((b) => b.id === v.boxId) || {}).name).join(', ')}</span></button>`)}`
      : html`<p class="muted small">Không có phiếu đang chờ khớp "${q}".</p>`);
  }

  const after = async (r) => { if (r) { await load(); const q = $('#q-phieu', root).value; if (q) await search(q); } };

  on(root, 'click', '.day-chip', async (e, b) => { date = b.dataset.d; await load(); });
  $('#f-start', root).addEventListener('input', (e) => { startMin = Number(e.target.value); drawPicks(); });
  $('#f-dur', root).addEventListener('input', (e) => { durMin = Number(e.target.value); drawPicks(); });
  $('#f-people', root).addEventListener('input', (e) => { people = Math.max(1, Number(e.target.value) || 1); drawPicks(); });
  on(root, 'click', '.pick', (e, b) => {
    const id = b.dataset.box;
    if (picked.has(id)) picked.delete(id); else if (picked.size < 3) picked.add(id);
    drawPicks();
  });
  $('#btn-dat', root).addEventListener('click', async () => after(await openBooking(ctx, { date, startMin, durMin, people, boxIds: [...picked] })));
  $('#btn-moi', root).addEventListener('click', async () => after(await openBooking(ctx, { date, startMin, durMin })));
  on(root, 'click', '[data-booking]', async (e, b) => after(await openBooking(ctx, { bookingId: b.dataset.booking })));
  $('#q-phieu', root).addEventListener('input', (e) => search(e.target.value));
  on(root, 'click', '[data-visit]', (e, b) => {
    const v = snap.visits.find((x) => x.id === b.dataset.visit);
    if (v) openTimes(ctx, v, boxName(v.boxId), s, load);
  });

  await load();
}

