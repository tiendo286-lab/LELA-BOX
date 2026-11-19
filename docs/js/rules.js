// Quy tắc thuần: khoảng giữ box, chống trùng, kiểm phiếu đặt, khách vào, giờ thêm.
import { atMs, fromMs, addDays, dayWindow, fmtMin, fmtDur } from './time.js';

export const STATUS_LABEL = { dat: 'Đã đặt', ngoi: 'Đang ngồi', ve: 'Đã về', huy: 'Huỷ', vang: 'Không đến' };
const MIN = 60000;

export function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
  return d;
}

// Giờ tính thêm: cho phép graceMin sau giờ miễn phí, quá thì làm tròn lên từng giờ tính từ mốc miễn phí
export function extraHours(minutes, s) {
  if (minutes <= s.freeMin + s.graceMin) return 0;
  return Math.ceil((minutes - s.freeMin) / 60);
}

export function suggestBoxCount(people, perBox) {
  return Math.min(3, Math.max(1, Math.ceil((Number(people) || 1) / perBox)));
}

export function holdRange(v, now, s) {
  if (v.status === 'dat') { const from = atMs(v.date, v.startMin); return [from, from + v.durMin * MIN]; }
  if (v.status === 'ngoi') return [v.inAt, Math.max(now, v.inAt + (v.durMin || s.freeMin) * MIN)];
  return null;
}

export function clashes(boxId, range, visits, now, s, ignoreIds = []) {
  return visits.filter((v) => {
    if (v.boxId !== boxId || ignoreIds.includes(v.id)) return false;
    const r = holdRange(v, now, s);
    return r && range[0] < r[1] && r[0] < range[1];
  });
}

const boxName = (boxes, id) => (boxes.find((b) => b.id === id) || { name: id }).name;
const custName = (customers, id) => ((customers || []).find((c) => c.id === id) || { name: 'khách khác' }).name;

function clashText(v, ctx) {
  const name = boxName(ctx.boxes, v.boxId);
  if (v.status === 'ngoi') return `${name} đang có khách ngồi`;
  return `${name} trùng với ${custName(ctx.customers, v.customerId)}, ${fmtMin(v.startMin)}–${fmtMin(v.startMin + v.durMin)}`;
}

export function checkBooking(input, ctx) {
  const s = ctx.settings;
  const fail = (error) => ({ error, warn: null });
  if (!String(input.name || '').trim()) return fail('Nhập tên khách');
  const p = normPhone(input.phone);
  if (p.length < 10 || p.length > 11) return fail('Số điện thoại chưa đúng');
  const ids = input.boxIds || [];
  if (ids.length < 1 || ids.length > 3) return fail('Chọn 1–3 box');
  const today = fromMs(ctx.now).date;
  if (input.date > addDays(today, 6)) return fail('Chỉ đặt trước tối đa 7 ngày');
  const from = atMs(input.date, input.startMin);
  if (from < ctx.now) return fail('Giờ này đã qua');
  if (input.startMin % 30 || input.durMin % 30 || input.durMin < 30) return fail('Giờ phải theo bước 30 phút');
  const w = dayWindow(s);
  if (input.startMin < w.openMin || input.startMin + input.durMin > w.closeMin) return fail(`Ngoài giờ mở cửa (${s.open}–${s.close})`);
  for (const id of ids) {
    const b = ctx.boxes.find((x) => x.id === id);
    if (!b || b.active === false) return fail(`${boxName(ctx.boxes, id)} đang tạm ngừng`);
  }
  const range = [from, from + input.durMin * MIN];
  for (const id of ids) {
    const c = clashes(id, range, ctx.visits, ctx.now, s, ctx.ignoreVisitIds || []);
    if (c.length) return fail(clashText(c[0], ctx));
  }
  const cap = s.perBox * ids.length;
  return { error: null, warn: Number(input.people) > cap ? `${ids.length} box chỉ chứa ${cap} người` : null };
}

// Khách vào box lúc này: chặn nếu box đang có người; báo nếu vướng lượt đặt sắp tới
export function checkCheckIn(boxId, ctx, selfVisitId = null) {
  const s = ctx.settings, now = ctx.now, end = now + s.freeMin * MIN;
  const others = ctx.visits.filter((v) => v.id !== selfVisitId);
  const busy = (id) => others.some((v) => v.boxId === id && v.status === 'ngoi');
  const nextDat = (id) => others
    .filter((v) => v.boxId === id && v.status === 'dat')
    .filter((v) => { const r = holdRange(v, now, s); return r[0] < end && r[1] > now; })
    .sort((a, b) => holdRange(a, now, s)[0] - holdRange(b, now, s)[0])[0];
  const alternatives = ctx.boxes.filter((b) => b.active !== false && b.id !== boxId && !busy(b.id) && !nextDat(b.id)).map((b) => b.id);
  const name = boxName(ctx.boxes, boxId);
  if (busy(boxId)) return { block: `${name} đang có khách`, warn: null, alternatives };
  const n = nextDat(boxId);
  let warn = null;
  if (n) {
    const start = holdRange(n, now, s)[0];
    warn = start <= now
      ? `${name} đang giữ cho khách đặt ${fmtMin(n.startMin)}`
      : `${name} có khách đặt ${fmtMin(n.startMin)} — chỉ ngồi được ${fmtDur((start - now) / MIN)}`;
  }
  return { block: null, warn, alternatives };
}

export function freeBoxes(date, startMin, durMin, ctx) {
  const from = atMs(date, startMin), range = [from, from + durMin * MIN];
  return ctx.boxes.filter((b) => b.active !== false && !clashes(b.id, range, ctx.visits, ctx.now, ctx.settings, ctx.ignoreVisitIds || []).length);
}
