// Cài đặt phần bán hàng (Chủ): giá ngồi thêm + hoá đơn, menu, nhập file KiotViet, khuyến mãi, voucher, In thử. PIN của tôi (Chủ / Quản lý).
import { html, str, $, $$, on, toast, showError } from '../ui.js';
import { fmtMoney } from '../money.js';
import { fmtMin, toMin } from '../time.js';
import { parseMenuRows, parseCsv, parseSlots, fmtSlots } from '../menu_import.js';
import { receiptHtml, printHtml } from '../print.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const muc = (x) => (x.kind === 'pct' ? `−${x.value}%` : `−${fmtMoney(x.value)}`);

export function pinSection() {
  return html`<section class="card"><h2>PIN của tôi</h2>
    <p class="muted small">Dùng để duyệt khi nhân viên huỷ món đã gửi, giảm tay, huỷ hoá đơn. 4–6 chữ số, không cho ai biết.</p>
    <form id="f-pin" class="row" autocomplete="off">
      <label>PIN mới<input name="pin" type="password" inputmode="numeric" maxlength="6"></label>
      <label>Nhập lại<input name="pin2" type="password" inputmode="numeric" maxlength="6"></label>
      <button type="submit">Đổi PIN</button></form><p class="err" id="pin-msg"></p></section>`;
}
export function bindPin(root, ctx) {
  const f = $('#f-pin', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#pin-msg', root); m.textContent = '';
    if (f.pin.value !== f.pin2.value) { m.textContent = 'Hai lần nhập PIN chưa giống nhau'; return; }
    try { await ctx.store.setPin(f.pin.value); f.reset(); toast('Đã đổi PIN'); } catch (err) { m.textContent = err.message; }
  });
}

let xlsxLoading = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxLoading ||= new Promise((ok, bad) => {
    const sc = document.createElement('script'); sc.src = XLSX_URL;
    sc.onload = () => ok(window.XLSX); sc.onerror = () => { xlsxLoading = null; bad(new Error('Không tải được bộ đọc Excel — kiểm tra mạng, hoặc lưu file thành CSV')); };
    document.head.appendChild(sc);
  });
  return xlsxLoading;
}
async function readRows(file) {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  const X = await loadXlsx();
  const wb = X.read(await file.arrayBuffer(), { type: 'array' });
  return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
}

export async function mountSales(box, ctx) {
  const { store } = ctx;
  let imported = [];

  async function draw() {
    const [s, menu, promos, vouchers] = await Promise.all([store.getSettings(), store.listMenu({ all: true }), store.listPromotions(), store.listVouchers()]);
    const groups = [...new Set(menu.map((m) => m.group))];
    const menuRow = (m) => html`<div class="menu-row" data-id="${m.id || ''}">
      <input name="name" value="${m.name || ''}" placeholder="Tên món" aria-label="Tên món">
      <input name="group" value="${m.group || ''}" placeholder="Nhóm" aria-label="Nhóm" list="dl-groups">
      <input name="price" inputmode="numeric" value="${m.price || ''}" placeholder="Giá" aria-label="Giá">
      <select name="kind" aria-label="Loại"><option value="mon" ${m.kind !== 'combo' ? 'selected' : ''}>Món</option><option value="combo" ${m.kind === 'combo' ? 'selected' : ''}>Combo</option></select>
      <label class="act-label"><input type="checkbox" name="active" ${m.active !== false ? 'checked' : ''}> Đang bán</label>
      <button type="button" data-act="save-item">Lưu</button>
      <div class="combo-extra" ${m.kind === 'combo' ? '' : 'hidden'}>
        <label>Đủ cho mấy người<input name="serves" inputmode="numeric" value="${m.serves || 1}"></label>
        <label>Ô chọn món — mỗi dòng: Tên ô; số món; nhóm1, nhóm2<textarea name="slots" rows="2">${fmtSlots(m.slots)}</textarea></label>
      </div></div>`;
    box.innerHTML = str(html`
      <section class="card"><h2>Bán hàng và hoá đơn</h2>
        <form id="f-ban">
          <div class="row">
            <label>Giá ngồi thêm mỗi giờ / box (đ)<input name="extraPrice" inputmode="numeric" value="${s.extraPrice}"></label>
            <label>Món tối thiểu mỗi người<select name="minPerPerson">${[0, 1, 2].map((n) => html`<option value="${n}" ${n === s.minPerPerson ? 'selected' : ''}>${n}</option>`)}</select></label>
            <label>Nhắc chưa gọi món sau (phút)<select name="noOrderMin">${[5, 10, 15, 20, 30].map((n) => html`<option value="${n}" ${n === s.noOrderMin ? 'selected' : ''}>${n}</option>`)}</select></label>
          </div>
          <div class="row">
            <label>Tên quán trên hoá đơn<input name="shopName" value="${s.shopName}"></label>
            <label>Dòng cuối hoá đơn<input name="billFooter" value="${s.billFooter}"></label>
            <label>Khổ giấy máy in<select name="paper"><option value="80" ${s.paper === '80' ? 'selected' : ''}>80mm</option><option value="58" ${s.paper === '58' ? 'selected' : ''}>58mm</option></select></label>
          </div>
          <div class="actions"><button class="primary" type="submit">Lưu</button><button type="button" data-act="test-print">In thử hoá đơn</button></div>
        </form></section>

      <section class="card"><h2>Menu</h2>
        <datalist id="dl-groups">${groups.map((g) => html`<option value="${g}">`)}</datalist>
        <div id="menu-rows">${menu.map(menuRow)}</div>
        <button type="button" data-act="add-item">+ Thêm món</button>
        <h3>Nhập từ KiotViet</h3>
        <p class="muted small">Trong KiotViet: Hàng hoá › Xuất file. Chọn file đó ở đây (Excel hoặc CSV). Món trùng tên sẽ được cập nhật giá.</p>
        <input id="f-excel" type="file" accept=".xlsx,.xls,.csv,text/csv">
        <div id="imp-box"></div>
      </section>

      <section class="card"><h2>Khuyến mãi theo giờ / ngày</h2>
        <p class="muted small">Tự áp khi thanh toán đúng giờ; không áp cho combo và tiền ngồi thêm. Mỗi hoá đơn chỉ 1 khuyến mãi (lấy cái lợi hơn cho khách, kể cả so với voucher).</p>
        ${promos.map((p) => html`<div class="promo-row" data-id="${p.id}">
          <span><b>${p.name}</b> · ${muc(p)} · ${p.scope === 'all' ? 'mọi món' : p.scope.join(', ')} · ${p.days.length === 7 || !p.days.length ? 'mọi ngày' : p.days.map((d) => DAYS[d - 1]).join(' ')} · ${fmtMin(p.fromMin)}–${fmtMin(p.toMin)}</span>
          <label class="act-label"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Bật</label>
          <button type="button" data-act="save-promo">Lưu</button></div>`)}
        <div class="row add-form">
          <label>Tên<input id="pr-name" placeholder="vd Giờ vàng"></label>
          <label>Kiểu<select id="pr-kind"><option value="pct">%</option><option value="amt">Số tiền</option></select></label>
          <label>Mức<input id="pr-value" inputmode="numeric"></label>
          <label>Áp cho<select id="pr-scope"><option value="">Mọi món</option>${groups.map((g) => html`<option value="${g}">Nhóm ${g}</option>`)}</select></label>
          <label>Từ giờ<input id="pr-from" type="time" value="08:00"></label>
          <label>Đến giờ<input id="pr-to" type="time" value="23:00"></label>
        </div>
        <div class="days-pick">${DAYS.map((d, i) => html`<label class="act-label"><input type="checkbox" name="pr-day" value="${i + 1}" checked> ${d}</label>`)}</div>
        <button type="button" data-act="add-promo">+ Thêm khuyến mãi</button>
      </section>

      <section class="card"><h2>Voucher</h2>
        ${vouchers.map((v) => html`<div class="voucher-row" data-code="${v.code}">
          <span><b>${v.code}</b> · ${muc(v)} · đã dùng ${v.used}${v.maxUses ? `/${v.maxUses}` : ''}${v.minTotal ? ` · tối thiểu ${fmtMoney(v.minTotal)}` : ''}${v.toDate ? ` · hết hạn ${v.toDate.slice(8, 10)}/${v.toDate.slice(5, 7)}` : ''}</span>
          <label class="act-label"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Bật</label>
          <button type="button" data-act="save-voucher">Lưu</button></div>`)}
        <div class="row add-form">
          <label>Mã<input id="vc-code" placeholder="vd LELA10" autocomplete="off"></label>
          <label>Kiểu<select id="vc-kind"><option value="pct">%</option><option value="amt">Số tiền</option></select></label>
          <label>Mức<input id="vc-value" inputmode="numeric"></label>
          <label>Số lần dùng (0 = không giới hạn)<input id="vc-max" inputmode="numeric" value="0"></label>
          <label>Hoá đơn tối thiểu<input id="vc-min" inputmode="numeric" value="0"></label>
          <label>Hết hạn<input id="vc-to" type="date"></label>
        </div>
        <button type="button" data-act="add-voucher">+ Thêm voucher</button>
      </section>
      ${pinSection()}`);
    bindPin(box, ctx);
    box.__data = { s, menu, promos, vouchers };
  }

  const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); await draw(); return r; } catch (e) { showError(e); return null; } };
  const num = (v) => Number(String(v || '').replace(/\D/g, '')) || 0;

  box.addEventListener('submit', async (e) => {
    if (e.target.id !== 'f-ban') return;
    e.preventDefault();
    const f = e.target;
    await run(() => store.saveSettings({ extraPrice: num(f.extraPrice.value), minPerPerson: Number(f.minPerPerson.value), noOrderMin: Number(f.noOrderMin.value), shopName: f.shopName.value, billFooter: f.billFooter.value, paper: f.paper.value }), 'Đã lưu');
  });
  on(box, 'click', '[data-act="test-print"]', async () => {
    const s = await store.getSettings(); const now = ctx.now();
    const r = { shopName: s.shopName, footer: s.billFooter, boxNames: ['Box 1'], inAt: now - 241 * 60000, outAt: now, minutes: 241,
      lines: [{ name: 'Trà đào', price: 35000, qty: 2, picks: [] }], priced: { goods: 70000, extraAmount: 2 * s.extraPrice, extraHours: 2, extraPrice: s.extraPrice, promos: [], manualAmount: 0, total: 70000 + 2 * s.extraPrice },
      payments: [{ method: 'tien_mat', amount: 70000 + 2 * s.extraPrice }], change: 0, paidBy: ctx.me.name, at: now, reprint: false };
    await printHtml(receiptHtml(r, s), s);
    toast('Đã gửi lệnh in thử');
  });

  on(box, 'change', '.menu-row [name="kind"]', (e, sel) => { sel.closest('.menu-row').querySelector('.combo-extra').hidden = sel.value !== 'combo'; });
  on(box, 'click', '[data-act="add-item"]', () => {
    const d = document.createElement('div');
    d.innerHTML = str(html`<div class="menu-row" data-id="">
      <input name="name" placeholder="Tên món" aria-label="Tên món"><input name="group" placeholder="Nhóm" aria-label="Nhóm" list="dl-groups">
      <input name="price" inputmode="numeric" placeholder="Giá" aria-label="Giá">
      <select name="kind" aria-label="Loại"><option value="mon">Món</option><option value="combo">Combo</option></select>
      <label class="act-label"><input type="checkbox" name="active" checked> Đang bán</label><button type="button" data-act="save-item">Lưu</button>
      <div class="combo-extra" hidden><label>Đủ cho mấy người<input name="serves" inputmode="numeric" value="1"></label>
        <label>Ô chọn món — mỗi dòng: Tên ô; số món; nhóm1, nhóm2<textarea name="slots" rows="2"></textarea></label></div></div>`);
    $('#menu-rows', box).appendChild(d.firstElementChild);
    $$('.menu-row', box).slice(-1)[0].querySelector('[name="name"]').focus();
  });
  on(box, 'click', '[data-act="save-item"]', async (e, b) => {
    const r = b.closest('.menu-row'); const v = (n) => $(`[name="${n}"]`, r);
    const kind = v('kind').value;
    let slots = [];
    if (kind === 'combo') { const p = parseSlots(v('slots').value); if (p.error) { toast(p.error, 'err'); return; } slots = p.slots; }
    await run(() => store.saveMenuItem({ id: r.dataset.id || undefined, name: v('name').value, group: v('group').value, price: num(v('price').value), kind, active: v('active').checked, serves: num(v('serves').value), slots }), 'Đã lưu món');
  });

  on(box, 'change', '#f-excel', async (e, inp) => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    try {
      const p = parseMenuRows(await readRows(file));
      if (p.error) { toast(p.error, 'err'); return; }
      imported = p.items;
      $('#imp-box', box).innerHTML = str(html`<p>${imported.length} món trong file:</p>
        <div class="scroll-x"><table class="tbl" id="imp-preview"><thead><tr><th>Tên</th><th>Nhóm</th><th>Giá</th></tr></thead>
        <tbody>${imported.map((x) => html`<tr><td>${x.name}</td><td>${x.group}</td><td>${fmtMoney(x.price)}</td></tr>`)}</tbody></table></div>
        <div class="actions"><button type="button" class="primary" data-act="imp-ok">Nhập ${imported.length} món</button><button type="button" data-act="imp-cancel">Thôi</button></div>`);
    } catch (err) { showError(err); }
  });
  on(box, 'click', '[data-act="imp-cancel"]', () => { imported = []; $('#imp-box', box).innerHTML = ''; $('#f-excel', box).value = ''; });
  on(box, 'click', '[data-act="imp-ok"]', async () => { await run(() => store.importMenu(imported), (r) => `Thêm ${r.added}, cập nhật ${r.updated}`); imported = []; });

  on(box, 'click', '[data-act="add-promo"]', async () => {
    const g = $('#pr-scope', box).value;
    await run(() => store.savePromotion({ name: $('#pr-name', box).value, kind: $('#pr-kind', box).value, value: num($('#pr-value', box).value), scope: g ? [g] : 'all', active: true,
      days: $$('[name="pr-day"]:checked', box).map((x) => Number(x.value)), fromMin: toMin($('#pr-from', box).value || '00:00'), toMin: toMin($('#pr-to', box).value || '23:59') }), 'Đã thêm khuyến mãi');
  });
  on(box, 'click', '[data-act="save-promo"]', async (e, b) => {
    const r = b.closest('.promo-row'); const p = box.__data.promos.find((x) => x.id === r.dataset.id);
    await run(() => store.savePromotion({ ...p, active: $('[name="active"]', r).checked }), 'Đã lưu');
  });
  on(box, 'click', '[data-act="add-voucher"]', async () => {
    await run(() => store.saveVoucher({ code: $('#vc-code', box).value, kind: $('#vc-kind', box).value, value: num($('#vc-value', box).value), maxUses: num($('#vc-max', box).value), minTotal: num($('#vc-min', box).value), toDate: $('#vc-to', box).value, active: true }), 'Đã thêm voucher');
  });
  on(box, 'click', '[data-act="save-voucher"]', async (e, b) => {
    const r = b.closest('.voucher-row'); const v = box.__data.vouchers.find((x) => x.code === r.dataset.code);
    await run(() => store.saveVoucher({ ...v, active: $('[name="active"]', r).checked, editing: true }), 'Đã lưu');
  });

  await draw();
}
