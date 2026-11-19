// Số liệu báo cáo (thuần).
import { atMs, addDays, slots } from './time.js';
import { extraHours } from './rules.js';

const MIN = 60000;
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const used = (v) => v.status === 'ngoi' || v.status === 've';
const minutesOf = (v) => (v.outAt && v.inAt ? Math.floor((v.outAt - v.inAt) / MIN) : 0);

function eachDate(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
// Thứ trong tuần: T2 = 0 … CN = 6
const weekdayIdx = (iso) => (new Date(atMs(iso, 12 * 60)).getUTCDay() + 6) % 7;

export function dailyCounts(visits, from, to) {
  return eachDate(from, to).map((date) => {
    const vs = visits.filter((v) => v.date === date);
    const mins = vs.filter((v) => v.status === 've').reduce((a, v) => a + minutesOf(v), 0);
    return {
      date,
      datTruoc: vs.filter((v) => used(v) && v.bookingId).length,
      vangLai: vs.filter((v) => used(v) && !v.bookingId).length,
      khongDen: vs.filter((v) => v.status === 'vang').length,
      huy: vs.filter((v) => v.status === 'huy').length,
      gioNgoi: Math.round((mins / 60) * 10) / 10,
    };
  });
}

// Số box có người trung bình theo thứ × mốc 30 phút
export function peakGrid(visits, from, to, s) {
  const cols = slots(s, 30);
  const dates = eachDate(from, to);
  const occur = Array(7).fill(0);
  dates.forEach((d) => occur[weekdayIdx(d)]++);
  const cnt = DAYS.map(() => cols.map(() => 0));
  for (const v of visits) {
    if (!used(v) || !v.inAt || v.date < from || v.date > to) continue;
    const end = v.outAt || v.inAt + (v.durMin || s.freeMin) * MIN;
    const r = weekdayIdx(v.date);
    cols.forEach((m, c) => { const a = atMs(v.date, m); if (v.inAt < a + 30 * MIN && a < end) cnt[r][c]++; });
  }
  const avg = cnt.map((row, r) => row.map((n) => (occur[r] ? Math.round((n / occur[r]) * 10) / 10 : 0)));
  return { rows: DAYS, cols, avg };
}

export function extraList(visits, from, to, s) {
  const items = visits
    .filter((v) => v.status === 've' && v.date >= from && v.date <= to)
    // Dùng giờ thêm đã lưu lúc khách về (đổi cài đặt sau này không làm đổi số cũ)
    .map((v) => { const minutes = minutesOf(v); return { visit: v, minutes, extra: v.extra ?? extraHours(minutes, s) }; })
    .filter((x) => x.extra > 0)
    .sort((a, b) => a.visit.inAt - b.visit.inAt);
  return { items, total: items.reduce((a, x) => a + x.extra, 0) };
}
