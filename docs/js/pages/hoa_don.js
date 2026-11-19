// Tab Hoá đơn: hoá đơn đã thu trong ngày — in lại, huỷ, huỷ & thu lại (nhân viên cần PIN quản lý).
import { html, str, $, on, toast, showError } from '../ui.js';
import { fmtMin, fromMs, fmtDay } from '../time.js';
import { fmtMoney } from '../money.js';
import { receiptHtml, printHtml } from '../print.js';
import { askPin } from './pin.js';
import { openPay } from './thanh_toan.js';

const METHOD = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };

export default async function render(root, ctx) {
  const { store, me } = ctx;
  let date = fromMs(ctx.now()).date;
  let bills = [];

  root.innerHTML = str(html`<h1>Hoá đơn</h1>
    <div class="row"><label>Ngày<input type="date" id="b-date" value="${date}"></label></div>
    <div id="bills-list"></div>`);

  async function draw() {
    bills = await store.billsOfDay(date);
    $('#bills-list', root).innerHTML = bills.length ? str(html`${bills.map((b) => html`<div class="card bill-row ${b.status === 'huy' ? 'voided' : ''}" data-id="${b.orderId}">
      <div class="bill-top"><b>${fmtMin(fromMs(b.at).min)} · ${b.boxNames.join(', ')}</b><span class="big">${fmtMoney(b.total)}</span></div>
      <div class="small muted">${b.payments.map((p) => `${METHOD[p.method] || p.method} ${fmtMoney(p.amount)}`).join(' + ') || 'Không thu tiền'}${b.change ? ` · thối ${fmtMoney(b.change)}` : ''} · ${b.paidBy}</div>
      ${b.status === 'huy' ? html`<div class="small err">Đã huỷ — ${b.voidedBy}: ${b.voidReason}</div>` : ''}
      <div class="actions"><button type="button" data-act="reprint">In lại</button>
        ${b.status === 'da_thu' ? html`<button type="button" data-act="rebill">Huỷ & thu lại</button><button type="button" class="danger" data-act="void">Huỷ hoá đơn</button>` : ''}</div>
    </div>`)}`) : html`<p class="muted">Chưa có hoá đơn nào ngày ${fmtDay(date)}.</p>`;
  }

  const bill = (b) => bills.find((x) => x.orderId === b.closest('.bill-row').dataset.id);
  $('#b-date', root).addEventListener('change', async (e) => { if (e.target.value) { date = e.target.value; await draw(); } });
  on(root, 'click', '[data-act="reprint"]', async (e, b) => {
    try { const s = await store.getSettings(); await printHtml(receiptHtml(await store.receiptOf(bill(b).orderId), s), s); toast('Đã gửi lệnh in lại'); } catch (err) { showError(err); }
  });
  on(root, 'click', '[data-act="void"], [data-act="rebill"]', async (e, b) => {
    const x = bill(b), reopen = b.dataset.act === 'rebill';
    const auth = await askPin({ title: reopen ? 'Huỷ hoá đơn và thu lại' : 'Huỷ hoá đơn', me, amount: x.total });
    if (!auth) return;
    try {
      const o = await store.voidOrder(x.orderId, { ...auth, reopen });
      await draw();
      if (reopen) await openPay(ctx, o.visitId, draw);
      else toast('Đã huỷ hoá đơn, hoàn kho');
    } catch (err) { showError(err); await draw(); }
  });
  await draw();
}
