import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { fmtMoney, promoActive, voucherError, priceOrder, minOrder, settle } from '../docs/js/money.js';

const at = (d, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return atMs(d, h * 60 + m); };
const GIO_VANG = { id: 'p1', name: 'Giờ vàng', active: true, kind: 'pct', value: 20, scope: ['Trà'], days: [1, 2, 3, 4, 5], fromMin: 840, toMin: 1020 };
const L = (o) => ({ id: 'l' + Math.random(), kind: 'mon', group: 'Trà', name: 'Trà đào', price: 35000, qty: 1, ...o });
const ORDER = { lines: [L({ qty: 2 }), L({ kind: 'combo', group: 'Combo', name: 'Combo 3 người', price: 150000, serves: 3 })], extraHours: 2, extraPrice: 20000 };
const V = (o) => ({ code: 'LELA10', active: true, kind: 'pct', value: 10, maxUses: 0, used: 0, minTotal: 0, ...o });
const T15 = at('2026-11-19', '15:00');

await t('fmtMoney', () => eq([fmtMoney(125000), fmtMoney(0), fmtMoney(-20000), fmtMoney(1234567)], ['125.000đ', '0đ', '-20.000đ', '1.234.567đ']));
await t('khuyến mãi T5 15:00 đang chạy', () => eq(promoActive(GIO_VANG, T15), true));
await t('khuyến mãi 17:00 hết (khoảng [từ, đến))', () => eq(promoActive(GIO_VANG, at('2026-11-19', '17:00')), false));
await t('khuyến mãi CN không chạy', () => eq(promoActive(GIO_VANG, at('2026-11-22', '15:00')), false));
await t('khuyến mãi tắt / ngoài ngày', () => eq([promoActive({ ...GIO_VANG, active: false }, T15), promoActive({ ...GIO_VANG, toDate: '2026-11-18' }, T15), promoActive({ ...GIO_VANG, fromDate: '2026-11-20' }, T15)], [false, false, false]));
await t('phiếu mẫu: khuyến mãi + ngồi thêm', () => {
  const p = priceOrder(ORDER, { promotions: [GIO_VANG], at: T15 });
  eq([p.goods, p.comboTotal, p.monEligible, p.promo && p.promo.amount, p.promo && p.promo.source, p.extraAmount, p.total], [220000, 150000, 70000, 14000, 'tu_dong', 40000, 246000]);
});
await t('chỉ 1 khuyến mãi: chọn cái lợi hơn (khuyến mãi 14.000 > voucher 7.000)', () => {
  const p = priceOrder(ORDER, { promotions: [GIO_VANG], voucher: V(), at: T15 });
  eq([p.promo.source, p.promo.amount, p.total], ['tu_dong', 14000, 246000]);
});
await t('chỉ 1 khuyến mãi: voucher 20.000 lợi hơn', () => {
  const p = priceOrder(ORDER, { promotions: [GIO_VANG], voucher: V({ kind: 'amt', value: 20000 }), at: T15 });
  eq([p.promo.source, p.promo.amount, p.total], ['voucher', 20000, 240000]);
});
await t('voucher hết lượt → báo lỗi, không áp', () => {
  const p = priceOrder(ORDER, { promotions: [], voucher: V({ maxUses: 3, used: 3 }), at: T15 });
  eq([p.voucherError, p.promo], ['Mã đã dùng hết lượt', null]);
});
await t('voucher: các câu lỗi', () => eq([
  voucherError(V({ active: false }), 100000, T15), voucherError(V({ fromDate: '2026-11-20' }), 100000, T15),
  voucherError(V({ toDate: '2026-11-18' }), 100000, T15), voucherError(V({ minTotal: 200000 }), 100000, T15), voucherError(V(), 100000, T15),
], ['Mã không đúng hoặc đã tắt', 'Mã chưa tới ngày dùng', 'Mã đã hết hạn', 'Hoá đơn tối thiểu 200.000đ', null]));
await t('voucher số tiền không vượt tiền món được giảm', () => {
  const p = priceOrder({ lines: [L({ price: 15000 })] }, { promotions: [], voucher: V({ kind: 'amt', value: 50000 }), at: T15 });
  eq([p.promo.amount, p.total], [15000, 0]);
});
await t('combo và giờ thêm không được voucher giảm', () => {
  const p = priceOrder({ lines: [L({ kind: 'combo', group: 'Combo', price: 150000 })], extraHours: 1, extraPrice: 20000 }, { promotions: [], voucher: V({ kind: 'amt', value: 50000 }), at: T15 });
  eq([p.promo, p.total], [null, 170000]);
});
await t('giảm tay 10% sau khuyến mãi, được giảm cả giờ thêm', () => {
  const p = priceOrder({ ...ORDER, manual: { kind: 'pct', value: 10 } }, { promotions: [GIO_VANG], at: T15 });
  eq([p.manualAmount, p.total], [24600, 221400]);
});
await t('giảm tay quá lớn → tổng 0, không âm', () => {
  const p = priceOrder({ ...ORDER, manual: { kind: 'amt', value: 999999 } }, { promotions: [], at: T15 });
  eq([p.manualAmount, p.total], [260000, 0]);
});
await t('giảm 15% trên 33.333 → 4.999 (làm tròn xuống)', () => {
  const p = priceOrder({ lines: [L({ price: 33333 })] }, { promotions: [{ ...GIO_VANG, value: 15 }], at: T15 });
  eq(p.promo.amount, 4999);
});
await t('dòng huỷ không tính tiền', () => {
  const p = priceOrder({ lines: [L({}), L({ voided: { by: 'QL', reason: 'x' } })] }, { promotions: [], at: T15 });
  eq([p.goods, p.total], [35000, 35000]);
});
await t('khuyến mãi phạm vi "all" áp mọi món thường', () => {
  const p = priceOrder({ lines: [L({ group: 'Cà phê', price: 30000 })] }, { promotions: [{ ...GIO_VANG, scope: 'all' }], at: T15 });
  eq(p.promo.amount, 6000);
});
await t('món tối thiểu: thiếu', () => eq(minOrder([L({}), L({ kind: 'combo', serves: 3, qty: 0 })], 3, 1), { need: 3, have: 1, ok: false }));
await t('món tối thiểu: combo đủ cho 3 người', () => eq(minOrder([L({}), L({ kind: 'combo', serves: 3 })], 3, 1), { need: 3, have: 4, ok: true }));
await t('món tối thiểu: dòng huỷ không tính', () => eq(minOrder([L({ qty: 2, voided: { by: 'x' } })], 1, 1).ok, false));
await t('chia tiền: CK + tiền mặt, tiền thối', () => eq(settle(246000, { transfer: 100000, cashGiven: 200000 }), {
  error: null, change: 54000, payments: [{ method: 'tien_mat', amount: 146000 }, { method: 'chuyen_khoan', amount: 100000 }] }));
await t('chia tiền: khách đưa thiếu', () => eq(settle(246000, { transfer: 0, cashGiven: 200000 }).error, 'Khách đưa thiếu 46.000đ'));
await t('chia tiền: CK lớn hơn số phải trả', () => eq(settle(100000, { transfer: 150000, cashGiven: 0 }).error, 'Chuyển khoản lớn hơn số phải trả'));
await t('chia tiền: chuyển khoản hết', () => eq(settle(95000, { transfer: 95000, cashGiven: 0 }), { error: null, change: 0, payments: [{ method: 'chuyen_khoan', amount: 95000 }] }));
await t('chia tiền: phiếu 0đ', () => eq(settle(0, { transfer: 0, cashGiven: 0 }), { error: null, change: 0, payments: [] }));
await t('chia tiền: số âm / lẻ bị chặn', () => eq([settle(1000, { transfer: -5, cashGiven: 2000 }).error, settle(1000, { transfer: 0, cashGiven: 1000.5 }).error], ['Số tiền chưa đúng', 'Số tiền chưa đúng']));
done();
