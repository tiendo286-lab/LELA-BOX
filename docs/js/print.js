// In phiếu pha chế / hoá đơn ra máy in bill (qua lệnh in của trình duyệt).
// Phần dựng chuỗi là thuần (kiểm bằng jsc); printHtml mới chạm DOM.
import { html, str } from './ui.js';
import { fmtMoney } from './money.js';
import { fmtMin, fromMs, fmtDur } from './time.js';

const hm = (ms) => (ms ? fmtMin(fromMs(ms).min) : '');
const dmy = (ms) => { if (!ms) return ''; const d = fromMs(ms).date; return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; };
const METHOD = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const row = (left, right, cls = '') => html`<div class="r ${cls}"><span>${left}</span><span>${right}</span></div>`;

export function ticketHtml(tk, settings) {
  return str(html`<div class="slip">
    <div class="c big">PHA CHẾ — ${tk.boxName}</div>
    ${tk.again ? html`<div class="c big inv">GỌI THÊM</div>` : ''}
    <div class="c">${hm(tk.at)} · ${tk.by}</div><hr>
    ${tk.lines.map((l) => html`<div class="big">${l.qty} × ${l.name}</div>
      ${(l.picks || []).map((p) => html`<div class="sub">- ${p}</div>`)}
      ${l.note ? html`<div class="sub">* ${l.note}</div>` : ''}`)}
  </div>`);
}

export function receiptHtml(r, settings) {
  const p = r.priced || {};
  return str(html`<div class="slip">
    <div class="c big">${r.shopName || settings.shopName}</div>
    ${r.reprint ? html`<div class="c inv">IN LẠI</div>` : ''}
    ${r.voided ? html`<div class="c inv">ĐÃ HUỶ</div>` : ''}
    <div class="c">${r.boxNames.join(', ')} · ${dmy(r.at || r.outAt)}</div>
    <div class="c">Vào ${hm(r.inAt)}${r.outAt ? html` – Ra ${hm(r.outAt)}` : ''}${r.minutes != null ? html` · ngồi ${fmtDur(r.minutes)}` : ''}</div><hr>
    ${r.lines.map((l) => html`${row(`${l.qty} × ${l.name}`, fmtMoney(l.price * l.qty))}
      ${(l.picks || []).map((x) => html`<div class="sub">- ${x.name}</div>`)}`)}
    ${p.extraAmount ? row(`Ngồi thêm ${p.extraHours} giờ × ${fmtMoney(p.extraPrice)}`, fmtMoney(p.extraAmount)) : ''}
    ${(p.promos || []).map((x) => row(x.name || 'Khuyến mãi', fmtMoney(-x.amount)))}
    ${p.manualAmount ? row('Giảm tay', fmtMoney(-p.manualAmount)) : ''}
    <hr>${row('TỔNG', fmtMoney(p.total), 'big')}
    ${(r.payments || []).map((x) => row(METHOD[x.method] || x.method, fmtMoney(x.amount)))}
    ${r.change ? row('Tiền thối', fmtMoney(r.change)) : ''}
    <hr><div class="c">${r.footer || settings.billFooter || ''}</div>
    <div class="c sub">Thu ngân: ${r.paidBy || ''}</div>
  </div>`);
}

function slipCss(paper) {
  const w = paper === '58' ? '48mm' : '72mm';
  return `@page { margin: 0; } body { margin: 0; font: 13px/1.35 Arial, sans-serif; color: #000; }
  .slip { width: ${w}; padding: 2mm; } .c { text-align: center; } .big { font-size: 16px; font-weight: 700; }
  .inv { background: #000; color: #fff; font-weight: 700; margin: 2px 0; } .sub { padding-left: 4mm; font-size: 12px; }
  .r { display: flex; justify-content: space-between; gap: 6px; } .r span:last-child { white-space: nowrap; } hr { border: 0; border-top: 1px dashed #000; }`;
}

// In bằng khung ẩn; Chrome mở với --kiosk-printing sẽ in thẳng không hỏi.
export function printHtml(bodyHtml, settings = {}) {
  (window.__lelaPrints ||= []).push(bodyHtml);
  if (window.__lelaNoPrint) return Promise.resolve();
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;';
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><style>${slipCss(settings.paper)}</style></head><body>${bodyHtml}</body></html>`); d.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* bỏ qua */ } setTimeout(() => { f.remove(); resolve(); }, 1000); }, 50);
  });
}
