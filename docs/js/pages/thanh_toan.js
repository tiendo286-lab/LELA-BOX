// Màn thanh toán & khách về: giờ ngồi thêm, khuyến mãi / voucher, giảm tay (PIN), tách bill, trả chung, chia tiền, in hoá đơn.
import { html, str, $, $$, on, openSheet, toast, showError } from '../ui.js';
import { fmtMoney, settle } from '../money.js';
import { fmtMin, fmtDur, fromMs, atMs, toMin, dayWindow } from '../time.js';
import { receiptHtml, printHtml } from '../print.js';
import { askPin } from './pin.js';

const num = (v) => Number(String(v || '').replace(/\D/g, '')) || 0;

export async function openPay(ctx, visitId, after) {
  const { store, me } = ctx;
  const s = await store.getSettings();
  const now = ctx.now();
  const snap = await store.snapshot(fromMs(now).date);
  const v = snap.visits.find((x) => x.id === visitId);
  if (!v || v.status !== 'ngoi') { toast('Lượt này không còn đang ngồi', 'err'); return after(); }
  const boxName = (id) => (snap.boxes.find((b) => b.id === id) || { name: id }).name;
  // Các box khác cùng phiếu đặt đang ngồi → cho trả chung
  const mates = v.bookingId ? snap.visits.filter((x) => x.bookingId === v.bookingId && x.id !== v.id && x.status === 'ngoi') : [];
  // Giờ ra mặc định = lúc này; quên bấm qua giờ đóng cửa ngày vào → giờ đóng cửa ngày đó
  const inDate = fromMs(v.inAt).date;
  const closeMs = atMs(inDate, dayWindow(s).closeMin);
  const useNow = now <= closeMs;
  const defMin = fromMs(useNow ? now : closeMs).min;

  let together = false, orders = [], q = null, picked = new Set(), splitMode = false;
  const sh = openSheet(`${boxName(v.boxId)} — thanh toán`, html`
    ${useNow ? '' : html`<p class="warntext">Khách vào ngày ${inDate.slice(8, 10)}/${inDate.slice(5, 7)} lúc ${fmtMin(fromMs(v.inAt).min)} — chưa bấm về. Ghi giờ khách thực sự về:</p>`}
    <div class="row">
      <label>Giờ ra<input id="pay-out" type="time" value="${fmtMin(defMin)}"></label>
      ${mates.length ? html`<label class="act-label"><input type="checkbox" name="together"> Trả chung cả ${mates.map((x) => boxName(x.boxId)).join(', ')}</label>` : ''}
    </div>
    <div id="bills"></div>
    <div class="row"><label>Mã voucher<input id="v-code" autocomplete="off" placeholder="vd LELA10"></label><button type="button" data-act="voucher">Áp mã</button></div>
    <div class="actions"><button type="button" data-act="manual">Giảm tay</button><button type="button" data-act="split">Tách bill</button></div>
    <div id="manual-form"></div>
    <p class="warntext" id="pay-warn"></p>
    <div class="paybox card">
      <p class="big">Phải trả: <span id="pay-total"></span></p>
      <div class="row">
        <label>Chuyển khoản<input id="pay-transfer" inputmode="numeric" value="0" autocomplete="off"></label>
        <label>Khách đưa tiền mặt<input id="pay-given" inputmode="numeric" value="" autocomplete="off"></label>
      </div>
      <div class="actions"><button type="button" data-act="all-cash">Đủ tiền mặt</button><button type="button" data-act="all-transfer">Chuyển khoản hết</button></div>
      <p class="big" id="pay-change"></p>
      <button type="button" class="primary wide-btn" data-act="pay-ok">Thu tiền & in hoá đơn</button>
    </div>`);
  const el = sh.el;
  el.classList.add('wide');

  const outAt = () => {
    const val = $('#pay-out', el).value;
    if (useNow && val === fmtMin(defMin)) return null;
    return val ? atMs(inDate, toMin(val)) : null;
  };
  const visitIds = () => (together ? [v.id, ...mates.map((x) => x.id)] : [v.id]);

  async function loadOrders() {
    orders = [];
    for (const id of visitIds()) orders.push(...(await store.ordersOfVisit(id)).filter((o) => o.status === 'mo'));
    picked = new Set(orders.map((o) => o.id));
  }
  async function requote() {
    try {
      q = picked.size ? await store.quote([...picked], outAt()) : null;
    } catch (e) { q = null; showError(e); }
    draw();
  }
  const promoName = (p) => (p.source === 'voucher' ? p.name : p.name || 'Khuyến mãi');
  function draw() {
    const rows = q ? q.orders : [];
    const byId = new Map(rows.map((r) => [r.order.id, r]));
    $('#bills', el).innerHTML = str(html`${orders.map((o, i) => {
      const r = byId.get(o.id);
      const lines = o.lines.filter((l) => !l.voided);
      return html`<div class="card bill" data-order="${o.id}">
        <div class="bill-head">${orders.length > 1 ? html`<label class="act-label"><input type="checkbox" name="po" value="${o.id}" ${picked.has(o.id) ? 'checked' : ''}> Thu phiếu này</label>` : ''}
          <b>${boxName(o.boxId)}${o.splitFrom ? ' (tách)' : ''}</b></div>
        <ul class="plines">${lines.length ? lines.map((l) => html`<li>${splitMode && orders.length === 1 ? html`<input type="checkbox" name="sl" value="${l.id}"> ` : ''}${l.qty} × ${l.name}<span>${fmtMoney(l.price * l.qty)}</span></li>`) : html`<li class="muted">Chưa gọi món</li>`}</ul>
        ${r ? html`
          ${r.priced.extraAmount ? html`<p class="pl">Ngồi thêm ${r.extraHours} giờ × ${fmtMoney(s.extraPrice)} (ngồi ${fmtDur(r.minutes)})<span>${fmtMoney(r.priced.extraAmount)}</span></p>` : ''}
          ${r.priced.promo ? html`<p class="pl ok">${promoName(r.priced.promo)}<span>${fmtMoney(-r.priced.promo.amount)}</span></p>` : ''}
          ${r.priced.voucherError ? html`<p class="pl err">Mã ${o.voucherCode}: ${r.priced.voucherError}</p>` : ''}
          ${r.priced.manualAmount ? html`<p class="pl">Giảm tay (${o.manual.approvedBy})<span>${fmtMoney(-r.priced.manualAmount)}</span></p>` : ''}
          <p class="pl big">Cộng<span>${fmtMoney(r.priced.total)}</span></p>` : ''}
      </div>`;
    })}${splitMode ? html`<div class="actions"><button type="button" class="primary" data-act="split-ok">Tách các món đã chọn ra bill riêng</button><button type="button" data-act="split-cancel">Thôi</button></div>` : ''}`);
    $('#pay-total', el).textContent = q ? fmtMoney(q.total) : '—';
    $('#pay-warn', el).textContent = q && q.minWarn ? '⚠ ' + q.minWarn : '';
    change();
  }
  function change() {
    const total = q ? q.total : 0;
    const r = settle(total, { transfer: num($('#pay-transfer', el).value), cashGiven: num($('#pay-given', el).value) });
    const c = $('#pay-change', el);
    c.className = 'big ' + (r.error ? 'err' : '');
    c.textContent = !q ? '' : r.error ? r.error : r.change ? `Tiền thối: ${fmtMoney(r.change)}` : 'Đủ tiền';
    $('[data-act="pay-ok"]', el).disabled = !q || !!r.error;
  }
  // Phiếu nhận voucher / giảm tay: phiếu cuối của lượt (mang giờ thêm) nếu có, không thì phiếu đầu
  const target = () => { const rows = q ? q.orders : []; return (rows.find((r) => r.isLast) || rows[0] || {}).order; };

  $('#pay-out', el).addEventListener('change', requote);
  on(el, 'change', 'input[name="together"]', async (e, b) => { together = b.checked; await loadOrders(); await requote(); });
  on(el, 'change', 'input[name="po"]', async (e, b) => { if (b.checked) picked.add(b.value); else picked.delete(b.value); await requote(); });
  $('#pay-transfer', el).addEventListener('input', change);
  $('#pay-given', el).addEventListener('input', change);
  on(el, 'click', '[data-act="all-cash"]', () => { $('#pay-given', el).value = String(Math.max(0, (q ? q.total : 0) - num($('#pay-transfer', el).value))); change(); });
  on(el, 'click', '[data-act="all-transfer"]', () => { $('#pay-transfer', el).value = String(q ? q.total : 0); $('#pay-given', el).value = '0'; change(); });
  on(el, 'click', '[data-act="voucher"]', async () => {
    const o = target(); if (!o) return;
    try { await store.setVoucher(o.id, $('#v-code', el).value.trim() || null); await loadOrders(); await requote(); toast('Đã áp mã'); } catch (e) { showError(e); }
  });
  on(el, 'click', '[data-act="manual"]', async () => {
    const o = target(); if (!o) return;
    const auth = await askPin({ title: 'Giảm tay', me });
    if (!auth) return;
    $('#manual-form', el).innerHTML = str(html`<div class="row card">
      <label>Kiểu giảm<select name="m-kind"><option value="amt">Số tiền (đ)</option><option value="pct">Phần trăm (%)</option></select></label>
      <label>Mức giảm<input name="m-value" inputmode="numeric" autocomplete="off"></label>
      <button type="button" class="primary" data-act="manual-ok">Áp giảm</button></div>`);
    $('#manual-form', el).__auth = auth;
  });
  on(el, 'click', '[data-act="manual-ok"]', async () => {
    const o = target(); const auth = $('#manual-form', el).__auth;
    try {
      await store.setManualDiscount(o.id, { kind: $('[name="m-kind"]', el).value, value: num($('[name="m-value"]', el).value), ...auth });
      $('#manual-form', el).innerHTML = '';
      await loadOrders(); await requote();
    } catch (e) { showError(e); }
  });
  on(el, 'click', '[data-act="split"]', () => {
    if (orders.length !== 1) { toast('Đã có nhiều bill — bỏ chọn bill chưa thu để thu từng bill', 'err'); return; }
    splitMode = true; draw();
  });
  on(el, 'click', '[data-act="split-cancel"]', () => { splitMode = false; draw(); });
  on(el, 'click', '[data-act="split-ok"]', async () => {
    const ids = $$('input[name="sl"]:checked', el).map((x) => x.value);
    try { await store.splitOrder(orders[0].id, ids); splitMode = false; await loadOrders(); await requote(); toast('Đã tách bill — chọn bill muốn thu trước'); } catch (e) { showError(e); }
  });
  on(el, 'click', '[data-act="pay-ok"]', async (e, b) => {
    if (!q) return;
    b.disabled = true;
    let auth = null;
    if (q.total === 0) { auth = await askPin({ title: 'Thu phiếu 0đ (khách không gọi gì)', me }); if (!auth) { b.disabled = false; return; } }
    try {
      const r = await store.pay([...picked], { transfer: num($('#pay-transfer', el).value), cashGiven: num($('#pay-given', el).value), outAt: outAt(), auth });
      sh.close();
      await printHtml(receiptHtml(r.receipt, s), s);
      toast(`Đã thu ${fmtMoney(r.receipt.priced.total)}${r.receipt.change ? ` — thối ${fmtMoney(r.receipt.change)}` : ''}`);
      after();
    } catch (err) { showError(err); b.disabled = false; await loadOrders(); await requote(); }
  });

  await loadOrders();
  await requote();
}
