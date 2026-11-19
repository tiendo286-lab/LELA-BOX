// Màn gọi món cho một box: lưới món theo nhóm + phiếu của box, gửi pha chế (in phiếu), sang thanh toán.
import { html, str, $, $$, on, openSheet, toast, showError, norm } from '../ui.js';
import { fmtMoney } from '../money.js';
import { ticketHtml, printHtml } from '../print.js';
import { askPin } from './pin.js';

export async function openOrder(ctx, visit, boxName, after, onPay) {
  const { store, me } = ctx;
  const settings = await store.getSettings();
  const menu = await store.listMenu();
  const groups = [...new Set(menu.map((m) => m.group))];
  let order = null, grp = '', closing = false;

  async function load() {
    const os = await store.ordersOfVisit(visit.id);
    order = os.find((o) => o.status === 'mo') || null;
  }
  await load();
  if (!order) { toast('Lượt này không còn phiếu mở', 'err'); return; }

  const sh = openSheet(`${boxName} — gọi món`, html`<div class="om">
    <div class="om-menu">
      <input id="q-mon" placeholder="Tìm món — gõ rồi Enter" autocomplete="off">
      <input id="o-note" placeholder="Ghi chú cho món tiếp theo (vd ít đá)" autocomplete="off">
      <div class="grps" id="grps"></div>
      <div class="menu-grid" id="mgrid"></div>
    </div>
    <div class="om-order">
      <ul class="olines" id="olines"></ul>
      <p class="big">Tạm tính: <span id="o-total"></span></p>
      <div class="actions"><button type="button" class="primary" data-act="send">Gửi pha chế</button><button type="button" data-act="pay">Thanh toán & khách về</button></div>
    </div></div>`);
  const el = sh.el;
  el.classList.add('wide');

  const shown = () => {
    const q = norm($('#q-mon', el).value.trim());
    return menu.filter((m) => (!grp || m.group === grp) && (!q || norm(m.name).includes(q)));
  };
  function drawMenu() {
    $('#grps', el).innerHTML = str(html`<button type="button" class="grp ${grp ? '' : 'on'}" data-grp="">Tất cả</button>${groups.map((g) => html`<button type="button" class="grp ${g === grp ? 'on' : ''}" data-grp="${g}">${g}</button>`)}`);
    $('#mgrid', el).innerHTML = str(html`${shown().map((m) => html`<button type="button" class="menu-btn ${m.kind === 'combo' ? 'combo' : ''}" data-item="${m.id}"><b>${m.name}</b><span>${fmtMoney(m.price)}</span></button>`)}`);
  }
  function drawOrder() {
    const lines = order.lines;
    $('#olines', el).innerHTML = lines.length ? str(html`${lines.map((l) => html`<li class="oline ${l.sentAt ? 'sent' : ''} ${l.voided ? 'voided' : ''}" data-line="${l.id}">
      <div class="ol-main"><b>${l.qty} × ${l.name}</b> <span class="muted">${fmtMoney(l.price * l.qty)}</span>
        ${l.picks && l.picks.length ? html`<div class="small muted">${l.picks.map((p) => p.name).join(', ')}</div>` : ''}
        ${l.note ? html`<div class="small muted">* ${l.note}</div>` : ''}
        ${l.voided ? html`<div class="small err">Đã huỷ (${l.voided.by}: ${l.voided.reason})</div>` : l.sentAt ? html`<span class="pill">đã gửi</span>` : ''}</div>
      ${l.voided ? '' : html`<div class="ol-act">${!l.sentAt && l.kind !== 'combo' ? html`<button type="button" data-act="minus" aria-label="Bớt">−</button><button type="button" data-act="plus" aria-label="Thêm">+</button>` : ''}
        <button type="button" class="danger" data-act="del-line" aria-label="Xoá món">✕</button></div>`}
    </li>`)}`) : '<li class="muted">Chưa gọi món nào</li>';
    $('#o-total', el).textContent = fmtMoney(lines.filter((l) => !l.voided).reduce((n, l) => n + l.price * l.qty, 0));
  }
  const run = async (fn) => { try { const r = await fn(); if (r && r.lines) order = r; drawOrder(); return r; } catch (e) { showError(e); await load(); drawOrder(); return null; } };

  async function addItem(m) {
    if (m.kind === 'combo') { const picks = await pickCombo(m, menu); if (picks) await run(() => store.addLines(order.id, [{ menuItemId: m.id, qty: 1, note: takeNote(), picks }])); return; }
    const note = takeNote();
    const same = order.lines.find((l) => l.menuItemId === m.id && !l.sentAt && !l.voided && (l.note || '') === note);
    if (same) await run(() => store.setLineQty(order.id, same.id, same.qty + 1));
    else await run(() => store.addLines(order.id, [{ menuItemId: m.id, qty: 1, note }]));
  }
  function takeNote() { const n = $('#o-note', el); const v = n.value.trim(); n.value = ''; return v; }

  on(el, 'click', '.grp', (e, b) => { grp = b.dataset.grp; drawMenu(); });
  $('#q-mon', el).addEventListener('input', drawMenu);
  $('#q-mon', el).addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const m = shown()[0];
    if (m) { await addItem(m); $('#q-mon', el).value = ''; drawMenu(); }
  });
  on(el, 'click', '.menu-btn', async (e, b) => { const m = menu.find((x) => x.id === b.dataset.item); if (m) await addItem(m); });
  on(el, 'click', '[data-act="plus"], [data-act="minus"]', async (e, b) => {
    const l = order.lines.find((x) => x.id === b.closest('.oline').dataset.line);
    const q = l.qty + (b.dataset.act === 'plus' ? 1 : -1);
    if (q < 1) await run(() => store.removeLine(order.id, l.id));
    else await run(() => store.setLineQty(order.id, l.id, q));
  });
  on(el, 'click', '[data-act="del-line"]', async (e, b) => {
    const l = order.lines.find((x) => x.id === b.closest('.oline').dataset.line);
    if (!l.sentAt) { await run(() => store.removeLine(order.id, l.id)); return; }
    const auth = await askPin({ title: `Huỷ món đã gửi: ${l.qty} × ${l.name}`, me, amount: l.price * l.qty });
    if (auth) await run(() => store.removeLine(order.id, l.id, auth));
  });
  on(el, 'click', '[data-act="send"]', async () => {
    try {
      const r = await store.sendToBar(order.id);
      order = r.order; drawOrder();
      await printHtml(ticketHtml(r.ticket, settings), settings);
      toast(`Đã gửi pha chế ${r.ticket.lines.length} món`);
    } catch (e) { showError(e); }
  });
  on(el, 'click', '[data-act="pay"]', () => { closing = true; sh.close(); onPay(); });
  // Đóng màn gọi món (✕) → vẽ lại bảng box
  new MutationObserver((m, obs) => { if (!document.body.contains(el)) { obs.disconnect(); if (!closing) after(); } }).observe(document.body, { childList: true });

  drawMenu(); drawOrder();
  $('#q-mon', el).focus();
}

// Chọn món cho từng ô của combo. Trả về [{menuItemId}] hoặc null nếu huỷ.
function pickCombo(combo, menu) {
  return new Promise((resolve) => {
    const chosen = combo.slots.map(() => []);
    let done = false;
    const sh = openSheet(`${combo.name} — chọn món`, html`<div id="slots"></div>
      <div class="actions"><button type="button" class="primary" data-act="combo-ok">Thêm combo</button><button type="button" data-act="combo-cancel">Huỷ</button></div>`);
    const el = sh.el;
    const finish = (v) => { if (done) return; done = true; sh.close(); resolve(v); };
    function draw() {
      $('#slots', el).innerHTML = str(html`${combo.slots.map((slot, i) => html`<div class="card slot">
        <b>${slot.label}</b> <span class="muted small">(${chosen[i].length}/${slot.count})</span>
        <div class="chips">${chosen[i].map((m, k) => html`<button type="button" class="pill-btn on" data-unpick="${i}:${k}">${m.name} ✕</button>`)}</div>
        <div class="picks">${menu.filter((m) => m.kind !== 'combo' && slot.groups.includes(m.group)).map((m) => html`<button type="button" class="pick-item" data-slot="${i}" data-item="${m.id}" ${chosen[i].length >= slot.count ? 'disabled' : ''}>${m.name}</button>`)}</div>
      </div>`)}`);
      $('[data-act="combo-ok"]', el).disabled = !combo.slots.every((s, i) => chosen[i].length === s.count);
    }
    on(el, 'click', '.pick-item', (e, b) => {
      const m = menu.find((x) => x.id === b.dataset.item);
      // Ô bấm còn chỗ thì vào ô đó; hết chỗ thì vào ô khác cùng nhóm còn chỗ
      let i = Number(b.dataset.slot);
      if (chosen[i].length >= combo.slots[i].count) i = combo.slots.findIndex((s, k) => chosen[k].length < s.count && s.groups.includes(m.group));
      if (i >= 0) { chosen[i].push(m); draw(); }
    });
    on(el, 'click', '[data-unpick]', (e, b) => { const [i, k] = b.dataset.unpick.split(':').map(Number); chosen[i].splice(k, 1); draw(); });
    on(el, 'click', '[data-act="combo-ok"]', () => finish(chosen.flat().map((m) => ({ menuItemId: m.id }))));
    on(el, 'click', '[data-act="combo-cancel"]', () => finish(null));
    new MutationObserver((m, obs) => { if (!document.body.contains(el)) { obs.disconnect(); finish(null); } }).observe(document.body, { childList: true });
    draw();
  });
}
