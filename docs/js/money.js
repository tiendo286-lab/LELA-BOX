// Quy tắc tiền (thuần, dùng cho cả jsc và trình duyệt): khuyến mãi, voucher, giảm tay, giờ thêm, chia tiền.
// Tiền là số nguyên đồng. Giảm % làm tròn xuống. Mỗi hoá đơn chỉ 1 khuyến mãi (tự động hoặc voucher, lấy cái lợi hơn).
import { fromMs } from './time.js';

export function fmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + s + 'đ';
}

// Thứ trong tuần theo ngày VN: T2 = 1 … CN = 7
function weekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function promoActive(p, atMs) {
  if (!p || !p.active) return false;
  const { date, min } = fromMs(atMs);
  if (p.fromDate && date < p.fromDate) return false;
  if (p.toDate && date > p.toDate) return false;
  if (Array.isArray(p.days) && p.days.length && !p.days.includes(weekday(date))) return false;
  const from = p.fromMin ?? 0, to = p.toMin ?? 1440;
  return min >= from && min < to;
}

export function voucherError(v, goodsTotal, atMs) {
  if (!v || !v.active) return 'Mã không đúng hoặc đã tắt';
  const { date } = fromMs(atMs);
  if (v.fromDate && date < v.fromDate) return 'Mã chưa tới ngày dùng';
  if (v.toDate && date > v.toDate) return 'Mã đã hết hạn';
  if (v.maxUses > 0 && (v.used || 0) >= v.maxUses) return 'Mã đã dùng hết lượt';
  if ((v.minTotal || 0) > goodsTotal) return `Hoá đơn tối thiểu ${fmtMoney(v.minTotal)}`;
  return null;
}

const cut = (kind, value, base) => {
  if (base <= 0) return 0;
  const n = kind === 'pct' ? Math.floor((base * Number(value || 0)) / 100) : Math.floor(Number(value || 0));
  return Math.max(0, Math.min(n, base));
};
const live = (lines) => (lines || []).filter((l) => !l.voided);
const amountOf = (l) => Math.round(Number(l.price) || 0) * (Number(l.qty) || 0);
const inScope = (scope, group) => scope === 'all' || !scope || (Array.isArray(scope) && scope.includes(group));

export function priceOrder(order, opt = {}) {
  const lines = live(order.lines);
  const goods = lines.reduce((s, l) => s + amountOf(l), 0);
  const comboTotal = lines.filter((l) => l.kind === 'combo').reduce((s, l) => s + amountOf(l), 0);
  const mon = lines.filter((l) => l.kind !== 'combo');
  const monEligible = mon.reduce((s, l) => s + amountOf(l), 0);
  const at = opt.at ?? 0;

  const cands = [];
  for (const p of opt.promotions || []) {
    if (!promoActive(p, at)) continue;
    const base = mon.filter((l) => inScope(p.scope, l.group)).reduce((s, l) => s + amountOf(l), 0);
    const amount = cut(p.kind, p.value, base);
    if (amount > 0) cands.push({ source: 'tu_dong', id: p.id, name: p.name, amount });
  }
  let voucherErr = null;
  if (opt.voucher) {
    voucherErr = voucherError(opt.voucher, goods, at);
    if (!voucherErr) {
      const amount = cut(opt.voucher.kind, opt.voucher.value, monEligible);
      if (amount > 0) cands.push({ source: 'voucher', id: opt.voucher.code, name: 'Mã ' + opt.voucher.code, amount });
    }
  }
  // Lấy cái giảm nhiều nhất; bằng nhau thì ưu tiên voucher (khách đã đưa mã)
  const promo = cands.sort((a, b) => b.amount - a.amount || (a.source === 'voucher' ? -1 : 1))[0] || null;

  const extraAmount = Math.max(0, Number(order.extraHours) || 0) * Math.max(0, Math.round(Number(order.extraPrice) || 0));
  const beforeManual = goods + extraAmount - (promo ? promo.amount : 0);
  const manualAmount = order.manual ? cut(order.manual.kind, order.manual.value, beforeManual) : 0;
  return { goods, comboTotal, monEligible, extraAmount, promo, voucherError: voucherErr, manualAmount, total: Math.max(0, beforeManual - manualAmount) };
}

export function minOrder(lines, people, minPerPerson) {
  const have = live(lines).reduce((s, l) => s + (l.kind === 'combo' ? (Number(l.serves) || 1) * (Number(l.qty) || 0) : Number(l.qty) || 0), 0);
  const need = Math.max(0, (Number(people) || 0) * (Number(minPerPerson) || 0));
  return { need, have, ok: have >= need };
}

export function settle(total, { transfer = 0, cashGiven = 0 } = {}) {
  const tr = Number(transfer) || 0, given = Number(cashGiven) || 0;
  const bad = (x) => !Number.isInteger(x) || x < 0;
  if (bad(tr) || bad(given) || bad(total)) return { error: 'Số tiền chưa đúng', change: 0, payments: [] };
  if (tr > total) return { error: 'Chuyển khoản lớn hơn số phải trả', change: 0, payments: [] };
  const cash = total - tr;
  if (given < cash) return { error: `Khách đưa thiếu ${fmtMoney(cash - given)}`, change: 0, payments: [] };
  const payments = [];
  if (cash > 0) payments.push({ method: 'tien_mat', amount: cash });
  if (tr > 0) payments.push({ method: 'chuyen_khoan', amount: tr });
  return { error: null, change: cash > 0 ? given - cash : 0, payments };
}
