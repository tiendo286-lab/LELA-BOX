import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { dailyCounts, peakGrid, extraList } from '../docs/js/report.js';

const S = { open: '08:00', close: '23:00', holdMin: 180, freeMin: 180, graceMin: 10, lateMin: 15, perBox: 3 };
const ve = (id, date, inMin, mins, bookingId = null) => ({ id, bookingId, boxId: 'b1', status: 've', date, startMin: null, durMin: 180, inAt: atMs(date, inMin), outAt: atMs(date, inMin + mins), minutes: mins, extra: 0, people: 1 });
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
done();
