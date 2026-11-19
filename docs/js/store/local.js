// Bản cắm dữ liệu CHẠY THỬ: lưu trong trình duyệt (localStorage). Cùng giao diện với store/supabase.js.
import * as clock from '../clock.js';
import { atMs, fromMs, addDays, fmtDur } from '../time.js';
import { checkBooking, checkCheckIn, clashes, holdRange, extraHours, normPhone, STATUS_LABEL } from '../rules.js';

const KEY = 'lelabox.v1';
const MIN = 60000;

export class StoreError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const err = (code, message) => { throw new StoreError(code, message); };
const clashCode = (msg) => (/trùng với|đang có khách/.test(msg) ? 'TRUNG' : 'LOI');
const copy = (x) => JSON.parse(JSON.stringify(x));

export const DEFAULT_SETTINGS = { open: '08:00', close: '23:00', holdMin: 180, freeMin: 180, graceMin: 10, lateMin: 15, perBox: 3 };
const DEFAULT_STAFF = [
  { id: 'u_chu', name: 'Chủ (thử)', role: 'chu', email: 'chu@vi-du.local' },
  { id: 'u_a', name: 'Nhân viên A (thử)', role: 'nv', email: 'a@vi-du.local' },
  { id: 'u_b', name: 'Nhân viên B (thử)', role: 'nv', email: 'b@vi-du.local' },
];

function baseState() {
  return {
    v: 1, seq: 0, me: null, settings: { ...DEFAULT_SETTINGS }, staff: copy(DEFAULT_STAFF),
    boxes: Array.from({ length: 12 }, (_, i) => ({ id: 'b' + (i + 1), name: 'Box ' + (i + 1), active: true, sort: i + 1 })),
    customers: [], bookings: [], visits: [],
  };
}

export function createLocalStore({ storage = globalThis.localStorage, seed = true } = {}) {
  let volatile = false;
  let st = null;
  try {
    // ?reset=1 chỉ xoá dữ liệu một lần mỗi lần mở trang
    if (!globalThis.__lelaReset && /[?&]reset=1/.test(globalThis.location?.search || '')) { globalThis.__lelaReset = true; storage.removeItem(KEY); }
    const raw = storage.getItem(KEY);
    if (raw) st = JSON.parse(raw);
  } catch { volatile = true; }
  if (!st) { st = baseState(); if (seed) addSample(st); }
  const save = () => { if (volatile) return; try { storage.setItem(KEY, JSON.stringify(st)); } catch { volatile = true; api.volatile = true; } };
  save();

  const id = () => 'x' + (++st.seq);
  const me = () => st.staff.find((u) => u.id === st.me) || null;
  const needMe = () => me() || err('QUYEN', 'Chưa đăng nhập');
  const needChu = () => { const u = needMe(); if (u.role !== 'chu') err('QUYEN', 'Chỉ Chủ được làm việc này'); return u; };
  const visit = (vid) => st.visits.find((v) => v.id === vid) || err('LOI', 'Không tìm thấy lượt');
  const log = (v, action, detail = '') => { (v.log ||= []).push({ at: clock.now(), by: needMe().name, action, detail }); };
  const live = () => st.visits.filter((v) => v.status === 'dat' || v.status === 'ngoi');
  const ctx = (extra = {}) => ({ settings: st.settings, boxes: st.boxes, customers: st.customers, visits: live(), now: clock.now(), ignoreVisitIds: [], ...extra });

  function upsertCustomer({ name, phone, tiktok }) {
    const p = normPhone(phone);
    let c = p && st.customers.find((x) => normPhone(x.phone) === p);
    if (c) { c.name = String(name).trim() || c.name; if (tiktok) c.tiktok = tiktok; return c; }
    c = { id: id(), name: String(name).trim(), phone: p, tiktok: tiktok || '' };
    st.customers.push(c);
    return c;
  }
  function splitPeople(people, n) {
    const out = []; let left = Math.max(1, Number(people) || 1);
    for (let i = 0; i < n; i++) { const k = i === n - 1 ? Math.max(1, left) : Math.min(st.settings.perBox, Math.max(1, left - (n - 1 - i))); out.push(k); left -= k; }
    return out;
  }
  function finish(v) {
    v.minutes = Math.floor((v.outAt - v.inAt) / MIN);
    v.extra = extraHours(v.minutes, st.settings);
    return { visit: copy(v), minutes: v.minutes, extra: v.extra };
  }

  const api = {
    volatile,
    kind: 'local',

    async me() { return me() && copy(me()); },
    async login(userId) { if (!st.staff.some((u) => u.id === userId)) err('LOI', 'Không có người này'); st.me = userId; save(); return copy(me()); },
    async logout() { st.me = null; save(); },
    async listStaff() { return copy(st.staff); },
    async saveStaff(u) {
      needChu();
      if (!String(u.name || '').trim()) err('LOI', 'Nhập tên nhân viên');
      if (!['chu', 'nv'].includes(u.role)) err('LOI', 'Chọn vai trò');
      const cur = u.id && st.staff.find((x) => x.id === u.id);
      if (cur) Object.assign(cur, { name: u.name.trim(), role: u.role, email: u.email || '' });
      else st.staff.push({ id: id(), name: u.name.trim(), role: u.role, email: u.email || '' });
      save(); return copy(st.staff);
    },

    async getSettings() { return copy(st.settings); },
    async saveSettings(s) {
      needChu();
      const n = { ...st.settings, ...s };
      for (const k of ['holdMin', 'freeMin', 'graceMin', 'lateMin', 'perBox']) n[k] = Number(n[k]);
      if (!/^\d{2}:\d{2}$/.test(n.open) || !/^\d{2}:\d{2}$/.test(n.close)) err('LOI', 'Giờ chưa đúng');
      if (n.close <= n.open) err('LOI', 'Giờ đóng cửa phải sau giờ mở cửa');
      if (n.perBox < 1 || n.freeMin < 30 || n.holdMin < 30) err('LOI', 'Số chưa hợp lệ');
      st.settings = n; save(); return copy(n);
    },

    async listBoxes({ all = false } = {}) { return copy(st.boxes.filter((b) => all || b.active).sort((a, b) => a.sort - b.sort)); },
    async saveBox(b) {
      needChu();
      if (!String(b.name || '').trim()) err('LOI', 'Nhập tên box');
      const cur = b.id && st.boxes.find((x) => x.id === b.id);
      if (cur) Object.assign(cur, { name: b.name.trim(), active: b.active !== false, sort: Number(b.sort ?? cur.sort) });
      else st.boxes.push({ id: id(), name: b.name.trim(), active: b.active !== false, sort: Math.max(0, ...st.boxes.map((x) => x.sort)) + 1 });
      save(); return copy(st.boxes);
    },

    async snapshot(date) {
      return copy({
        settings: st.settings, boxes: [...st.boxes].sort((a, b) => a.sort - b.sort), customers: st.customers, bookings: st.bookings,
        visits: st.visits.filter((v) => v.date === date || v.status === 'ngoi'),
      });
    },
    async visitsRange(from, to) { return copy(st.visits.filter((v) => v.date >= from && v.date <= to)); },

    async createBooking(input) {
      needMe();
      const r = checkBooking(input, ctx());
      if (r.error) err(clashCode(r.error), r.error);
      const c = upsertCustomer(input);
      const k = { id: id(), customerId: c.id, date: input.date, startMin: input.startMin, durMin: input.durMin, people: Number(input.people) || 1, channel: input.channel || 'tiktok', note: input.note || '', createdBy: needMe().name, createdAt: clock.now() };
      st.bookings.push(k);
      const ppl = splitPeople(k.people, input.boxIds.length);
      const vs = input.boxIds.map((boxId, i) => {
        const v = { id: id(), bookingId: k.id, boxId, customerId: c.id, status: 'dat', date: k.date, startMin: k.startMin, durMin: k.durMin, inAt: null, outAt: null, people: ppl[i], log: [] };
        log(v, 'Đặt trước', `${input.boxIds.length} box`); st.visits.push(v); return v;
      });
      save(); return copy({ booking: k, visits: vs });
    },

    async updateBooking(bookingId, input) {
      needMe();
      const k = st.bookings.find((x) => x.id === bookingId) || err('LOI', 'Không tìm thấy phiếu');
      const mine = st.visits.filter((v) => v.bookingId === k.id);
      const open = mine.filter((v) => v.status === 'dat');
      const sameTime = input.date === k.date && input.startMin === k.startMin;
      const now = clock.now();
      // Phiếu đang trễ mà không đổi giờ thì vẫn sửa được thông tin
      const ctxNow = sameTime ? Math.min(now, atMs(k.date, k.startMin)) : now;
      const r = checkBooking(input, ctx({ ignoreVisitIds: open.map((v) => v.id), now: ctxNow }));
      if (r.error) err(clashCode(r.error), r.error);
      const c = upsertCustomer(input);
      Object.assign(k, { customerId: c.id, date: input.date, startMin: input.startMin, durMin: input.durMin, people: Number(input.people) || 1, channel: input.channel || k.channel, note: input.note || '' });
      const ppl = splitPeople(k.people, input.boxIds.length);
      input.boxIds.forEach((boxId, i) => {
        let v = open.find((x) => x.boxId === boxId);
        if (!v) { v = { id: id(), bookingId: k.id, boxId, status: 'dat', inAt: null, outAt: null, log: [] }; st.visits.push(v); log(v, 'Thêm box vào phiếu'); }
        else log(v, 'Sửa phiếu');
        Object.assign(v, { customerId: c.id, date: k.date, startMin: k.startMin, durMin: k.durMin, people: ppl[i] });
      });
      open.filter((v) => !input.boxIds.includes(v.boxId)).forEach((v) => { v.status = 'huy'; log(v, 'Bỏ box khỏi phiếu'); });
      save(); return copy({ booking: k, visits: st.visits.filter((v) => v.bookingId === k.id) });
    },

    async cancelBooking(bookingId) {
      needMe();
      st.visits.filter((v) => v.bookingId === bookingId && v.status === 'dat').forEach((v) => { v.status = 'huy'; log(v, 'Huỷ phiếu'); });
      save(); return true;
    },

    async walkIn({ boxId, people, name, phone }) {
      needMe();
      const r = checkCheckIn(boxId, ctx());
      if (r.block) err('TRUNG', r.block);
      const now = clock.now();
      const c = normPhone(phone).length >= 10 ? upsertCustomer({ name: name || 'Khách', phone }) : null;
      const v = { id: id(), bookingId: null, boxId, customerId: c ? c.id : null, guestName: c ? '' : String(name || '').trim(), status: 'ngoi', date: fromMs(now).date, startMin: null, durMin: st.settings.freeMin, inAt: now, outAt: null, people: Number(people) || 1, log: [] };
      log(v, 'Khách vào (vãng lai)', r.warn || ''); st.visits.push(v); save(); return copy(v);
    },

    async checkIn(visitId) {
      needMe();
      const v = visit(visitId);
      if (v.status !== 'dat') err('LOI', 'Lượt này không ở trạng thái Đã đặt');
      const r = checkCheckIn(v.boxId, ctx(), v.id);
      if (r.block) err('TRUNG', r.block);
      v.status = 'ngoi'; v.inAt = clock.now(); log(v, 'Khách vào'); save(); return copy(v);
    },

    async checkOut(visitId) {
      needMe();
      const v = visit(visitId);
      if (v.status !== 'ngoi') err('LOI', 'Lượt này không đang ngồi');
      v.status = 've'; v.outAt = clock.now();
      const res = finish(v);
      log(v, 'Khách về', `Ngồi ${fmtDur(res.minutes)} → thêm ${res.extra} giờ`);
      res.visit = copy(v); save(); return res;
    },

    async noShow(visitId) {
      needMe();
      const v = visit(visitId);
      if (v.status !== 'dat') err('LOI', 'Lượt này không ở trạng thái Đã đặt');
      v.status = 'vang'; log(v, 'Không đến'); save(); return copy(v);
    },

    async moveBox(visitId, boxId) {
      needMe();
      const v = visit(visitId);
      if (v.status === 'ngoi') { const r = checkCheckIn(boxId, ctx(), v.id); if (r.block) err('TRUNG', r.block); }
      else if (v.status === 'dat') {
        const c = clashes(boxId, holdRange(v, clock.now(), st.settings), live(), clock.now(), st.settings, [v.id]);
        if (c.length) err('TRUNG', `${(st.boxes.find((b) => b.id === boxId) || {}).name} đã có người giữ giờ này`);
      } else err('LOI', 'Lượt này đã xong');
      const from = (st.boxes.find((b) => b.id === v.boxId) || {}).name;
      v.boxId = boxId; log(v, 'Đổi box', `${from} → ${(st.boxes.find((b) => b.id === boxId) || {}).name}`); save(); return copy(v);
    },

    async editTimes(visitId, { inAt, outAt }) {
      needMe();
      const v = visit(visitId);
      if (inAt) v.inAt = inAt;
      if (outAt) v.outAt = outAt;
      if (v.outAt && v.inAt && v.outAt <= v.inAt) err('LOI', 'Giờ ra phải sau giờ vào');
      let res = { visit: v, minutes: null, extra: null };
      if (v.status === 've') res = finish(v);
      log(v, 'Sửa giờ vào/ra', v.minutes != null ? `Ngồi ${fmtDur(v.minutes)} → thêm ${v.extra} giờ` : '');
      save(); return { visit: copy(v), minutes: res.minutes, extra: res.extra };
    },

    async findCustomers(q) {
      const s = String(q || '').trim();
      if (s.length < 2) return [];
      const n = norm(s), d = s.replace(/\D/g, '');
      return st.customers
        .filter((c) => norm(c.name).includes(n) || (d.length >= 3 && normPhone(c.phone).includes(d)) || (c.tiktok && norm(c.tiktok).includes(n.replace(/^@/, ''))))
        .slice(0, 20)
        .map((c) => {
          const vs = st.visits.filter((v) => v.customerId === c.id).sort((a, b) => (b.inAt || atMs(b.date, b.startMin || 0)) - (a.inAt || atMs(a.date, a.startMin || 0)));
          const count = {}; vs.filter((v) => v.status === 've' || v.status === 'ngoi').forEach((v) => { count[v.boxId] = (count[v.boxId] || 0) + 1; });
          const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
          return copy({ customer: c, visits: vs, visitsCount: Object.values(count).reduce((a, x) => a + x, 0), noShows: vs.filter((v) => v.status === 'vang').length, topBox: top ? (st.boxes.find((b) => b.id === top[0]) || {}).name : null });
        });
    },
  };
  api.volatile = volatile;
  api.statusLabel = STATUS_LABEL;
  return api;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Dữ liệu mẫu (khách giả) quanh thời điểm hiện tại của đồng hồ
function addSample(st) {
  const now = clock.now();
  const { date: today, min: nowMin } = fromMs(now);
  let n = 0; const nid = () => 's' + (++n);
  const by = 'Dữ liệu mẫu';
  const cust = Array.from({ length: 6 }, (_, i) => ({ id: 'c' + (i + 1), name: 'Khách mẫu ' + (i + 1), phone: '090000000' + (i + 1), tiktok: '@khach.mau' + (i + 1) }));
  st.customers.push(...cust);
  const L = (action) => [{ at: now, by, action, detail: '' }];
  const sit = (box, agoMin, people, customerId = null) => st.visits.push({ id: nid(), bookingId: null, boxId: box, customerId, guestName: customerId ? '' : '', status: 'ngoi', date: today, startMin: null, durMin: 180, inAt: now - agoMin * MIN, outAt: null, people, log: L('Khách vào (mẫu)') });
  const book = (customerId, boxes, date, startMin, people) => {
    const k = { id: nid(), customerId, date, startMin, durMin: 180, people, channel: 'tiktok', note: '', createdBy: by, createdAt: now };
    st.bookings.push(k);
    boxes.forEach((b) => st.visits.push({ id: nid(), bookingId: k.id, boxId: b, customerId, status: 'dat', date, startMin, durMin: 180, inAt: null, outAt: null, people: Math.min(3, people), log: L('Đặt trước (mẫu)') }));
  };
  sit('b2', 130, 3, 'c4');
  sit('b3', 172, 2);
  sit('b6', 200, 1, 'c5');
  book('c1', ['b7'], today, Math.floor((nowMin - 20) / 30) * 30, 2);        // đặt trước đang trễ
  const later = Math.ceil((nowMin + 90) / 30) * 30;
  if (later + 180 <= 23 * 60) book('c2', ['b4', 'b5'], today, later, 5);     // nhóm 2 box chiều nay
  else book('c2', ['b4', 'b5'], addDays(today, 1), 15 * 60, 5);
  book('c3', ['b1'], addDays(today, 1), 10 * 60, 2);
  // Lịch sử 6 ngày trước cho báo cáo
  for (let d = 1; d <= 6; d++) {
    const date = addDays(today, -d);
    [[540, 150, 'b1'], [780, 200, 'b2'], [1080, 250, 'b3'], [600, 185, 'b8']].forEach(([inMin, mins, box], i) => {
      const inAt = atMs(date, inMin), outAt = inAt + mins * MIN;
      st.visits.push({ id: nid(), bookingId: i === 0 ? 'hist' : null, boxId: box, customerId: cust[(d + i) % 6].id, status: 've', date, startMin: i === 0 ? inMin : null, durMin: 180, inAt, outAt, minutes: mins, extra: extraHours(mins, DEFAULT_SETTINGS), people: 2, log: L('Lịch sử (mẫu)') });
    });
    if (d % 3 === 0) st.visits.push({ id: nid(), bookingId: 'hist', boxId: 'b9', customerId: 'c6', status: 'vang', date, startMin: 900, durMin: 180, inAt: null, outAt: null, people: 2, log: L('Không đến (mẫu)') });
  }
  st.seq = 1000;
}
