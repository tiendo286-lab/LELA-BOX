// Trạng thái từng box lúc này + danh sách nhắc việc (thuần).
import { atMs, fromMs, fmtMin, fmtDur, dayWindow } from './time.js';
import { holdRange, extraHours, normPhone } from './rules.js';

const MIN = 60000;
const elapsedOf = (v, now) => Math.floor((now - v.inAt) / MIN);

export function fmtPhone(p) {
  const d = normPhone(p);
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d;
}

// Lượt đặt sớm nhất của box còn giữ chỗ trong khoảng [nay, nay + giờ miễn phí] (gồm cả lượt đang trễ)
function nextBooking(boxId, visits, now, s) {
  return visits
    .filter((v) => v.boxId === boxId && v.status === 'dat')
    .map((v) => ({ v, r: holdRange(v, now, s) }))
    .filter(({ r }) => r[0] <= now + s.freeMin * MIN && r[1] > now)
    .sort((a, b) => a.r[0] - b.r[0])
    .map(({ v }) => v)[0] || null;
}

export function boxState(box, visits, now, s) {
  const next = nextBooking(box.id, visits, now, s);
  if (box.active === false) return { kind: 'tam_ngung', visit: null, next, elapsed: 0 };
  const visit = visits.find((v) => v.boxId === box.id && v.status === 'ngoi');
  if (!visit) return { kind: 'trong', visit: null, next, elapsed: 0 };
  const elapsed = elapsedOf(visit, now);
  let kind = 'ngoi';
  if (elapsed > s.freeMin + s.graceMin) kind = 'qua_gio';
  else if (elapsed >= s.freeMin - 15) kind = 'sap_het';
  return { kind, visit, next, elapsed };
}

export function summary(states) {
  const busy = (k) => ['ngoi', 'sap_het', 'qua_gio'].includes(k);
  return {
    trong: states.filter((x) => x.kind === 'trong').length,
    ngoi: states.filter((x) => busy(x.kind)).length,
    sapDat: states.filter((x) => x.kind === 'trong' && x.next).length,
  };
}

const ORDER = ['tre', 'sap_luot', 'qua_gio', 'sap_het', 'quen_ve', 'chua_goi'];

// orderStats (không bắt buộc): {visitId: {have, need}} từ snapshot → nhắc box chưa gọi đủ món
export function reminders(visits, boxes, customers, now, s, orderStats = null) {
  const bn = (id) => (boxes.find((b) => b.id === id) || { name: id }).name;
  const cu = (id) => (customers || []).find((c) => c.id === id) || { name: 'Khách', phone: '' };
  const today = fromMs(now).date;
  const { closeMin } = dayWindow(s);
  const hours = s.freeMin / 60;
  const out = [];
  const add = (kind, v, text) => out.push({ key: `${kind}:${v.id}`, kind, boxId: v.boxId, visitId: v.id, text });

  for (const v of visits) {
    if (v.status === 'dat' && v.date === today) {
      const late = Math.floor((now - atMs(v.date, v.startMin)) / MIN);
      if (late > s.lateMin) { const c = cu(v.customerId); add('tre', v, `${bn(v.boxId)}: ${c.name}${c.phone ? ` (${fmtPhone(c.phone)})` : ''} trễ ${late} phút`); }
    }
    if (v.status !== 'ngoi') continue;
    const e = elapsedOf(v, now);
    const endFree = fmtMin(fromMs(v.inAt + s.freeMin * MIN).min);
    if (e > s.freeMin + s.graceMin) add('qua_gio', v, `${bn(v.boxId)} đã ngồi ${fmtDur(e)} (+${extraHours(e, s)} giờ)`);
    else if (e >= s.freeMin - 15) add('sap_het', v, e < s.freeMin
      ? `${bn(v.boxId)} hết ${hours} giờ lúc ${endFree}`
      : `${bn(v.boxId)} đã hết ${hours} giờ lúc ${endFree} — còn ${s.freeMin + s.graceMin - e} phút cho phép`);
    const nxt = visits
      .filter((x) => x.boxId === v.boxId && x.status === 'dat')
      .map((x) => ({ x, start: atMs(x.date, x.startMin) }))
      .filter(({ start }) => start > now && start - now <= 15 * MIN)
      .sort((a, b) => a.start - b.start)[0];
    if (nxt) add('sap_luot', v, `${bn(v.boxId)} còn khách, ${fmtMin(nxt.x.startMin)} có khách đặt (${cu(nxt.x.customerId).name})`);
    if (now > atMs(fromMs(v.inAt).date, closeMin)) add('quen_ve', v, `${bn(v.boxId)} chưa bấm Khách về`);
    const os = orderStats && orderStats[v.id];
    if (os && os.have < os.need && e >= (s.noOrderMin ?? 10)) add('chua_goi', v, os.have ? `${bn(v.boxId)} mới gọi ${os.have}/${os.need} món` : `${bn(v.boxId)} vào ${e} phút chưa gọi món`);
  }
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}
