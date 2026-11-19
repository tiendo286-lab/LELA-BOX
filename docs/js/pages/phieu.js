// Phiếu đặt trước (tạo / sửa / huỷ) — dùng chung cho Lịch, Bảng box, Khách.
import { html, str, $, openSheet, toast, showError } from '../ui.js';
import { fmtMin, fmtDay, fromMs, addDays, slots, atMs } from '../time.js';
import { checkBooking, clashes, normPhone } from '../rules.js';

const CHANNELS = [['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['zalo', 'Zalo'], ['goi', 'Gọi điện'], ['truc_tiep', 'Trực tiếp']];

// opts: { bookingId? , date?, startMin?, durMin?, people?, boxIds?, customer? }
export async function openBooking(ctx, opts = {}) {
  const { store } = ctx;
  const today = fromMs(ctx.now()).date;
  let snap = await store.snapshot(opts.date || today);
  const s = snap.settings;
  let booking = null, mine = [];
  if (opts.bookingId) {
    const all = await store.visitsRange(addDays(today, -1), addDays(today, 6));
    const first = all.find((v) => v.bookingId === opts.bookingId);
    if (first) snap = await store.snapshot(first.date);
    booking = snap.bookings.find((k) => k.id === opts.bookingId);
    if (!booking) { toast('Không tìm thấy phiếu', 'err'); return null; }
    mine = snap.visits.filter((v) => v.bookingId === booking.id);
  }
  const cust = booking ? snap.customers.find((c) => c.id === booking.customerId) || {} : opts.customer || {};
  const openVisits = mine.filter((v) => v.status === 'dat');
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const f0 = {
    name: cust.name || '', phone: cust.phone || '', tiktok: cust.tiktok || '',
    channel: booking ? booking.channel : 'tiktok',
    date: booking ? booking.date : opts.date || today,
    startMin: booking ? booking.startMin : opts.startMin ?? slots(s)[0],
    durMin: booking ? booking.durMin : opts.durMin || s.holdMin,
    people: booking ? booking.people : opts.people || 1,
    boxIds: booking ? openVisits.map((v) => v.boxId) : opts.boxIds || [],
    note: booking ? booking.note : '',
  };
  const done = mine.filter((v) => v.status !== 'dat' && v.status !== 'huy');
  const logs = mine.flatMap((v) => (v.log || []).map((l) => ({ ...l, box: (snap.boxes.find((b) => b.id === v.boxId) || {}).name })))
    .sort((a, b) => a.at - b.at);
  const durs = []; for (let m = 30; m <= 360; m += 30) durs.push(m);
  const dl = (m) => (m % 60 ? `${Math.floor(m / 60)}g${String(m % 60).padStart(2, '0')}` : `${m / 60} giờ`);

  return new Promise((resolve) => {
    const sh = openSheet(booking ? 'Sửa phiếu đặt' : 'Phiếu đặt trước', html`
      <form id="f-phieu" autocomplete="off">
        <div class="row">
          <label>Tên khách *<input name="name" value="${f0.name}"></label>
          <label>Số điện thoại *<input name="phone" inputmode="tel" value="${f0.phone}"></label>
        </div>
        <div class="row">
          <label>TikTok (không bắt buộc)<input name="tiktok" value="${f0.tiktok}" placeholder="@ten.tiktok"></label>
        </div>
        <div class="seg" role="radiogroup" aria-label="Khách liên hệ qua">${CHANNELS.map(([v, t]) => html`
          <label><input type="radio" name="channel" value="${v}" ${v === f0.channel ? 'checked' : ''}><span>${t}</span></label>`)}</div>
        <div class="row">
          <label>Ngày<select name="date">${days.map((d) => html`<option value="${d}" ${d === f0.date ? 'selected' : ''}>${fmtDay(d)}</option>`)}</select></label>
          <label>Giờ đến<select name="start">${slots(s).map((m) => html`<option value="${m}" ${m === f0.startMin ? 'selected' : ''}>${fmtMin(m)}</option>`)}</select></label>
          <label>Giữ box<select name="dur">${durs.map((m) => html`<option value="${m}" ${m === f0.durMin ? 'selected' : ''}>${dl(m)}</option>`)}</select></label>
          <label>Số người<input name="people" type="number" min="1" max="${s.perBox * 3}" value="${f0.people}"></label>
        </div>
        <fieldset class="boxpick"><legend>Box (chọn 1–3)</legend><div id="boxlist"></div></fieldset>
        ${done.length ? html`<p class="small muted">Box đã vào / xong không đổi được ở đây: ${done.map((v) => (snap.boxes.find((b) => b.id === v.boxId) || {}).name).join(', ')}</p>` : ''}
        <label>Ghi chú<textarea name="note" rows="2">${f0.note}</textarea></label>
        <p class="f-err err" id="f-err"></p><p class="f-warn warntext" id="f-warn"></p>
        <div class="actions">
          <button type="submit" class="primary" data-act="save">${booking ? 'Lưu thay đổi' : 'Đặt box'}</button>
          ${booking && openVisits.length ? html`<button type="button" class="danger" data-act="cancel">Huỷ phiếu</button>` : ''}
        </div>
        ${logs.length ? html`<details class="log"><summary>Nhật ký (${logs.length})</summary><ul>${logs.map((l) => html`
          <li>${fmtMin(fromMs(l.at).min)} ${fmtDay(fromMs(l.at).date)} · ${l.by} · ${l.action}${l.box ? ' · ' + l.box : ''}${l.detail ? ' · ' + l.detail : ''}</li>`)}</ul></details>` : ''}
      </form>`);
    const el = sh.el, f = $('#f-phieu', el);
    let picked = new Set(f0.boxIds);
    let finished = false;
    const finish = (v) => { if (!finished) { finished = true; resolve(v); } };
    const oldClose = sh.close;
    sh.close = () => { oldClose(); finish(null); };
    el.closest('.sheet-bg').addEventListener('click', (e) => { if (e.target.classList.contains('sheet-bg') || e.target.closest('[data-act="close"]')) finish(null); });

    const input = () => ({
      name: f.name.value, phone: f.phone.value, tiktok: f.tiktok.value.trim(), channel: (f.querySelector('[name=channel]:checked') || {}).value,
      date: f.date.value, startMin: Number(f.start.value), durMin: Number(f.dur.value), people: Number(f.people.value) || 1,
      boxIds: [...picked], note: f.note.value,
    });
    const vctx = (inp) => {
      const live = snap.visits.filter((v) => (v.status === 'dat' || v.status === 'ngoi'));
      const same = booking && inp.date === booking.date && inp.startMin === booking.startMin;
      const now = ctx.now();
      return { settings: s, boxes: snap.boxes, customers: snap.customers, visits: live, ignoreVisitIds: openVisits.map((v) => v.id), now: same ? Math.min(now, atMs(booking.date, booking.startMin)) : now };
    };
    function drawBoxes() {
      const inp = input(), c = vctx(inp);
      const from = atMs(inp.date, inp.startMin), range = [from, from + inp.durMin * 60000];
      $('#boxlist', el).innerHTML = str(html`${snap.boxes.filter((b) => b.active !== false).map((b) => {
        const busy = clashes(b.id, range, c.visits, c.now, s, c.ignoreVisitIds).length > 0;
        return html`<label class="bx ${busy ? 'busy' : ''}"><input type="checkbox" name="box" value="${b.id}" ${picked.has(b.id) ? 'checked' : ''}><span>${b.name}${busy ? ' (bận)' : ''}</span></label>`;
      })}`);
    }
    function validate() {
      const inp = input();
      const r = checkBooking(inp, vctx(inp));
      $('#f-err', el).textContent = r.error || '';
      $('#f-warn', el).textContent = r.warn || '';
      $('[data-act="save"]', el).disabled = !!r.error;
      return r;
    }
    async function reload() { snap = await store.snapshot(f.date.value); drawBoxes(); validate(); }

    f.addEventListener('input', async (e) => {
      if (e.target.name === 'box') { if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value); validate(); return; }
      if (e.target.name === 'date') return reload();
      if (['start', 'dur'].includes(e.target.name)) drawBoxes();
      validate();
    });
    f.addEventListener('change', (e) => { if (e.target.name === 'box') { if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value); validate(); } });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (validate().error) return;
      const inp = input();
      try {
        const res = booking ? await store.updateBooking(booking.id, inp) : await store.createBooking(inp);
        toast(`${booking ? 'Đã sửa' : 'Đã đặt'}: ${inp.name.trim()} · ${fmtDay(inp.date)} ${fmtMin(inp.startMin)} · ${inp.boxIds.length} box`);
        oldClose(); finish(res);
      } catch (err) {
        if (err.code === 'TRUNG') { toast('Vừa có người đặt giờ này — đã tải lại', 'err'); await reload(); }
        else showError(err);
      }
    });
    const cancelBtn = $('[data-act="cancel"]', el);
    if (cancelBtn) cancelBtn.addEventListener('click', async () => {
      if (!confirm('Huỷ phiếu này? Các box chưa vào sẽ được nhả.')) return;
      try { await store.cancelBooking(booking.id); toast('Đã huỷ phiếu'); oldClose(); finish({ cancelled: true }); } catch (err) { showError(err); }
    });
    if (normPhone(f0.phone) === '' && !booking) f.name.focus?.();
    drawBoxes(); validate();
  });
}
