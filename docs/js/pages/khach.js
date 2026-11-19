// Tab Khách: tìm theo SĐT / tên / TikTok, xem các lượt, đặt cho khách.
import { html, str, $, on } from '../ui.js';
import { fmtMin, fmtDay, fromMs } from '../time.js';
import { STATUS_LABEL } from '../rules.js';
import { fmtPhone } from '../board.js';
import { openBooking } from './phieu.js';

export default async function render(root, ctx) {
  const { store } = ctx;
  const boxes = await store.listBoxes({ all: true });
  const boxName = (id) => (boxes.find((b) => b.id === id) || {}).name || id;
  let results = [];
  const open = new Set();

  root.innerHTML = str(html`<h1>Khách</h1>
    <input id="q-khach" placeholder="Gõ số điện thoại, tên hoặc TikTok (ít nhất 2 ký tự)" autocomplete="off">
    <div id="klist"></div>`);

  const when = (v) => (v.inAt ? `${fmtDay(fromMs(v.inAt).date)} ${fmtMin(fromMs(v.inAt).min)}` : `${fmtDay(v.date)} ${fmtMin(v.startMin)}`);

  function draw() {
    const q = $('#q-khach', root).value.trim();
    $('#klist', root).innerHTML = q.length < 2 ? '<p class="muted small">Ví dụ: 0912 345, Lan, @lan.tt</p>' : str(results.length ? html`${results.map((r) => html`
      <div class="card kcard" data-id="${r.customer.id}">
        <button type="button" class="ghost k-head">
          <b>${r.customer.name}</b> · ${fmtPhone(r.customer.phone)}${r.customer.tiktok ? html` · ${r.customer.tiktok}` : ''}<br>
          <span class="small muted">${r.visitsCount} lần đến · ${r.noShows} lần không đến${r.topBox ? html` · hay ngồi ${r.topBox}` : ''}</span>
        </button>
        ${open.has(r.customer.id) ? html`<div class="k-body">
          <div class="actions"><a class="btn" href="tel:${r.customer.phone}">Gọi</a><button type="button" class="primary" data-act="book">Đặt cho khách này</button></div>
          <ul class="kvis-list">${r.visits.slice(0, 15).map((v) => html`<li class="kvis">
            ${v.bookingId && v.status === 'dat' ? html`<button type="button" class="ghost" data-booking="${v.bookingId}">${when(v)} · ${boxName(v.boxId)} · ${STATUS_LABEL[v.status]} ✎</button>`
              : html`<span>${when(v)} · ${boxName(v.boxId)} · ${STATUS_LABEL[v.status]}${v.extra ? html` · thêm ${v.extra} giờ` : ''}</span>`}
          </li>`)}</ul>
        </div>` : ''}
      </div>`)}` : html`<p class="muted">Không tìm thấy khách.</p>`);
  }

  async function search() { results = await store.findCustomers($('#q-khach', root).value); draw(); }

  $('#q-khach', root).addEventListener('input', search);
  on(root, 'click', '.k-head', (e, b) => { const id = b.closest('.kcard').dataset.id; if (open.has(id)) open.delete(id); else open.add(id); draw(); });
  on(root, 'click', '[data-act="book"]', async (e, b) => {
    const r = results.find((x) => x.customer.id === b.closest('.kcard').dataset.id);
    if (await openBooking(ctx, { customer: r.customer })) await search();
  });
  on(root, 'click', '[data-booking]', async (e, b) => { if (await openBooking(ctx, { bookingId: b.dataset.booking })) await search(); });
  draw();
}
