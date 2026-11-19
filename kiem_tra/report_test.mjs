import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { dailyCounts, peakGrid, extraList, revenueDaily, itemSales, extraMoney, discountSummary } from '../docs/js/report.js';

const S = { open: '08:00', close: '23:00', holdMin: 180, freeMin: 180, graceMin: 10, lateMin: 15, perBox: 3 };
const ve = (id, date, inMin, mins, bookingId = null) => ({ id, bookingId, boxId: 'b1', status: 've', date, startMin: null, durMin: 180, inAt: atMs(date, inMin), outAt: atMs(date, inMin + mins), minutes: mins, people: 1 });
const V = [
  ve('a', '2026-11-16', 540, 120, 'k1'),      // T2 09:00–11:00, đặt trước
  ve('b', '2026-11-16', 600, 241),             // T2 10:00–14:01, vãng lai, +2 giờ
  ve('c', '2026-11-23', 540, 60),              // T2 tuần sau 09:00–10:00
  { id: 'd', bookingId: 'k2', boxId: 'b2', status: 'vang', date: '2026-11-16', startMin: 900, durMin: 180 },
  { id: 'e', bookingId: 'k3', boxId: 'b2', status: 'huy', date: '2026-11-17', startMin: 900, durMin: 180 },
];
await t('dailyCounts', () => {
  const r = dailyCounts(V, '2026-11-16', '2026-11-17');
  eq(r, [{ date: '2026-11-16', datTruoc: 1, vangLai: 1, khongDen: 1, huy: 0, gioNgoi: 6 }, { date: '2026-11-17', datTruoc: 0, vangLai: 0, khongDen: 0, huy: 1, gioNgoi: 0 }]);
});
await t('peakGrid trung bình theo số ngày T2', () => {
  const g = peakGrid(V, '2026-11-16', '2026-11-23', S);
  const c0900 = g.cols.indexOf(540), c1000 = g.cols.indexOf(600), c1100 = g.cols.indexOf(660);
  eq([g.rows[0], g.rows.length, g.avg[0][c0900], g.avg[0][c1000], g.avg[0][c1100], g.avg[1][c0900]], ['T2', 7, 1, 1, 0.5, 0]);
});
await t('extraList', () => { const r = extraList(V, '2026-11-16', '2026-11-23', S); eq([r.items.map((x) => x.visit.id), r.items[0].extra, r.total], [['b'], 2, 2]); });
await t('báo cáo dùng giờ thêm đã lưu lúc khách về', () => {
  const v = { ...ve('z', '2026-11-16', 600, 241), extra: 1 };
  const r = extraList([v], '2026-11-16', '2026-11-16', S); eq([r.items.length, r.total], [1, 1]);
});
// ===== Báo cáo tiền =====
const O = (id, paidDay, o = {}) => ({ id, status: 'da_thu', paidAt: atMs(paidDay, 600), voidedAt: null, paidWith: null,
  payments: [{ method: 'tien_mat', amount: 95000 }], extraHours: 2,
  priced: { goods: 55000, extraAmount: 40000, promo: null, manualAmount: 0, total: 95000 },
  lines: [{ kind: 'mon', name: 'Trà đào', price: 35000, qty: 1 }, { kind: 'mon', name: 'Coca', price: 20000, qty: 1 }], ...o });
const ORDERS = [
  O('o1', '2026-11-19', { status: 'huy', voidedAt: atMs('2026-11-20', 600) }),
  O('o2', '2026-11-20', { payments: [{ method: 'tien_mat', amount: 95000 }, { method: 'chuyen_khoan', amount: 100000 }],
    priced: { goods: 155000, extraAmount: 40000, promo: { source: 'voucher', amount: 5000 }, manualAmount: 10000, total: 195000 },
    lines: [{ kind: 'mon', name: 'Trà đào', price: 35000, qty: 1 }, { kind: 'combo', name: 'Combo 3 người', price: 150000, qty: 1 }] }),
  O('o3', '2026-11-20', { paidWith: 'o2', payments: [], priced: { goods: 0, extraAmount: 20000, promo: { source: 'tu_dong', amount: 3000 }, manualAmount: 0, total: 20000 }, extraHours: 1, lines: [] }),
];
await t('doanh thu: huỷ hôm sau → hôm trước giữ, hôm huỷ ghi âm', () => {
  const r = revenueDaily(ORDERS, '2026-11-19', '2026-11-20');
  eq(r.map((d) => [d.date, d.cash, d.transfer, d.voids, d.total, d.count]), [['2026-11-19', 95000, 0, 0, 95000, 1], ['2026-11-20', 95000, 100000, -95000, 100000, 1]]);
});
await t('bán theo món: phiếu huỷ không tính, combo một dòng', () => eq(itemSales(ORDERS, '2026-11-19', '2026-11-20'), [{ name: 'Combo 3 người', qty: 1, amount: 150000 }, { name: 'Trà đào', qty: 1, amount: 35000 }]));
await t('tiền ngồi thêm (bỏ phiếu huỷ)', () => eq(extraMoney(ORDERS, '2026-11-19', '2026-11-20'), { hours: 3, amount: 60000 }));
await t('tổng giảm giá theo loại', () => eq(discountSummary(ORDERS.filter((o) => o.status === 'da_thu')), { promo: 3000, voucher: 5000, manual: 10000 }));

done();
