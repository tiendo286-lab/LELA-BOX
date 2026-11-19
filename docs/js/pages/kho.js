// Tab Kho: nhập hàng, kiểm kê (nhân viên đếm "mù"), tồn & chênh lệch + hàng kho (Quản lý / Chủ).
import { html, str, $, $$, on, toast, showError } from '../ui.js';
import { fmtMin, fmtDay, fromMs, addDays } from '../time.js';

const KIND = { nhap: 'Nhập', ban: 'Bán', hoan: 'Hoàn (huỷ hoá đơn)' };

export default async function render(root, ctx) {
  const { store, me } = ctx;
  const boss = me.role === 'chu' || me.role === 'ql';
  const today = fromMs(ctx.now()).date;

  async function draw() {
    const items = await store.listStock();
    const [overview, counts, moves, menu] = boss
      ? await Promise.all([store.stockOverview(), store.countsList(addDays(today, -30), today), store.movesList(addDays(today, -6), today), store.listMenu({ all: true })])
      : [[], [], [], []];
    const when = (ms) => `${fmtDay(fromMs(ms).date)} ${fmtMin(fromMs(ms).min)}`;
    root.innerHTML = str(html`<h1>Kho</h1>
      <section class="card"><h2>Nhập hàng</h2>
        <p class="muted small">Hàng về thì ghi số lượng nhận được (không cần giá).</p>
        ${items.map((k) => html`<div class="recv-row qty-row" data-id="${k.id}"><span>${k.name} <span class="muted small">(${k.unit})</span></span><input inputmode="numeric" aria-label="Số lượng nhập ${k.name}" placeholder="0"></div>`)}
        <label>Ghi chú<input id="recv-note" placeholder="vd hàng từ nhà cung cấp A"></label>
        <button type="button" class="primary" data-act="recv-ok">Lưu nhập hàng</button>
      </section>
      <section class="card"><h2>Kiểm kê</h2>
        <p class="muted small">Đếm hàng thực tế còn lại. Hàng nào không đếm thì để trống.</p>
        ${items.map((k) => html`<div class="count-row qty-row" data-id="${k.id}"><span>${k.name} <span class="muted small">(${k.unit})</span></span><input inputmode="numeric" aria-label="Số đếm ${k.name}"></div>`)}
        <button type="button" class="primary" data-act="count-ok">Lưu kiểm kê</button>
      </section>
      ${boss ? html`
        <section class="card"><h2>Tồn kho</h2>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>Hàng</th><th>Đáng lẽ còn</th><th>Lần đếm gần nhất</th></tr></thead>
          <tbody>${overview.map((x) => html`<tr class="stock-row" data-id="${x.item.id}"><td>${x.item.name}</td><td class="${x.expected < 0 ? 'neg' : ''}">${x.expected} ${x.item.unit}</td><td>${x.lastCount ? `${x.lastCount.counted} · ${when(x.lastCount.at)}` : 'chưa đếm'}</td></tr>`)}</tbody></table></div>
        </section>
        <section class="card"><h2>Lịch sử kiểm kê (30 ngày)</h2>
          ${counts.length ? counts.map((c) => html`<div class="count-hist"><p class="small"><b>${when(c.at)}</b> · ${c.by}${c.note ? ` · ${c.note}` : ''}</p>
            <div class="scroll-x"><table class="tbl"><thead><tr><th>Hàng</th><th>Đáng lẽ còn</th><th>Đếm được</th><th>Chênh lệch</th></tr></thead>
            <tbody>${c.items.map((i) => html`<tr><td>${i.name}</td><td>${i.expected}</td><td>${i.counted}</td><td class="${i.diff ? 'neg' : ''}">${i.diff > 0 ? '+' : ''}${i.diff}</td></tr>`)}</tbody></table></div></div>`)
            : html`<p class="muted">Chưa có lần kiểm kê nào.</p>`}
        </section>
        <section class="card"><h2>Nhập / bán 7 ngày</h2>
          ${moves.length ? html`<div class="scroll-x"><table class="tbl"><thead><tr><th>Lúc</th><th>Việc</th><th>Hàng</th><th>SL</th><th>Người</th></tr></thead>
            <tbody>${moves.slice().reverse().slice(0, 100).map((m) => html`<tr><td>${when(m.at)}</td><td>${KIND[m.kind] || m.kind}</td><td>${m.name}</td><td>${m.qty}</td><td>${m.by}</td></tr>`)}</tbody></table></div>`
            : html`<p class="muted">Chưa có.</p>`}
        </section>
        <section class="card"><h2>Hàng kho</h2>
          <p class="muted small">Hàng bán nguyên (chai, lon, bánh) gắn với món để tự trừ khi bán. Nguyên liệu pha chế thì không gắn — chỉ nhập và đếm.</p>
          ${items.map((k) => html`<div class="stock-item-row" data-id="${k.id}"><span>${k.name} (${k.unit})</span><span class="muted small">${k.menuItemId ? `trừ khi bán: ${(menu.find((m) => m.id === k.menuItemId) || { name: '?' }).name}` : 'không tự trừ'}</span></div>`)}
          <div class="row add-form">
            <label>Tên hàng<input id="st-name"></label>
            <label>Đơn vị<input id="st-unit" placeholder="lon, chai, hộp…"></label>
            <label>Gắn món (tự trừ khi bán)<select id="st-menu"><option value="">Không gắn</option>${menu.filter((m) => m.kind !== 'combo').map((m) => html`<option value="${m.id}">${m.name}</option>`)}</select></label>
            <button type="button" data-act="add-stock">+ Thêm hàng</button>
          </div>
        </section>` : ''}`);
  }

  const vals = (sel) => $$(sel, root).map((r) => ({ id: r.dataset.id, v: $('input', r).value.trim() })).filter((x) => x.v !== '');
  on(root, 'click', '[data-act="recv-ok"]', async () => {
    const list = vals('.recv-row');
    try { await store.receiveStock({ items: list.map((x) => ({ stockItemId: x.id, qty: Number(x.v) })), note: $('#recv-note', root).value }); toast('Đã nhập hàng'); await draw(); } catch (e) { showError(e); }
  });
  on(root, 'click', '[data-act="count-ok"]', async () => {
    const list = vals('.count-row');
    try { await store.saveCount({ items: list.map((x) => ({ stockItemId: x.id, counted: Number(x.v) })) }); toast('Đã lưu kiểm kê'); await draw(); } catch (e) { showError(e); }
  });
  on(root, 'click', '[data-act="add-stock"]', async () => {
    try { await store.saveStockItem({ name: $('#st-name', root).value, unit: $('#st-unit', root).value, menuItemId: $('#st-menu', root).value || null }); toast('Đã thêm hàng'); await draw(); } catch (e) { showError(e); }
  });
  await draw();
}
