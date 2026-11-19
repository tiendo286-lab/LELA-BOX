import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import * as clock from '../docs/js/clock.js';
import { createLocalStore } from '../docs/js/store/local.js';

const D = '2026-11-19';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const fresh = async (who = 'u_a') => { clock.set(atMs(D, 600)); const s = createLocalStore({ storage: mem(), seed: false }); await s.login(who); return s; };
const B = (o = {}) => ({ name: 'Minh', phone: '0987 654 321', tiktok: '@minh', channel: 'tiktok', date: D, startMin: 660, durMin: 180, people: 5, note: '', boxIds: ['b1', 'b2'], ...o });
const code = async (fn) => { try { await fn(); return 'OK'; } catch (e) { return e.code || String(e); } };

await t('mặc định 12 box + cài đặt', async () => { const s = await fresh(); eq([(await s.listBoxes({ all: true })).length, (await s.getSettings()).freeMin], [12, 180]); });
await t('phiếu nhóm 2 box → 2 lượt dat', async () => {
  const s = await fresh(); const r = await s.createBooking(B());
  eq([r.visits.length, r.visits.map((v) => v.status).join(), r.visits.map((v) => v.people).join()], [2, 'dat,dat', '3,2']);
});
await t('log có người làm', async () => { const s = await fresh(); const r = await s.createBooking(B()); eq(r.visits[0].log[0].by, 'Nhân viên A (thử)'); });
await t('đặt trùng → TRUNG', async () => { const s = await fresh(); await s.createBooking(B()); eq(await code(() => s.createBooking(B({ boxIds: ['b2'], startMin: 720 }))), 'TRUNG'); });
await t('thiếu SĐT → LOI', async () => { const s = await fresh(); eq(await code(() => s.createBooking(B({ phone: '' }))), 'LOI'); });
await t('khách gắn theo SĐT', async () => {
  const s = await fresh(); const a = await s.createBooking(B()); const b = await s.createBooking(B({ name: 'Minh Anh', phone: '0987654321', boxIds: ['b3'] }));
  eq([a.booking.customerId === b.booking.customerId, (await s.snapshot(D)).customers.find((c) => c.id === a.booking.customerId).name], [true, 'Minh Anh']);
});
await t('nhom_ve_lech', async () => {
  const s = await fresh(); const r = await s.createBooking(B());
  clock.set(atMs(D, 660)); await s.checkIn(r.visits[0].id); await s.checkIn(r.visits[1].id);
  clock.set(atMs(D, 660 + 185)); const x = await s.checkOut(r.visits[0].id);
  clock.set(atMs(D, 660 + 241)); const y = await s.checkOut(r.visits[1].id);
  eq([x.minutes, x.extra, y.minutes, y.extra], [185, 0, 241, 2]);
});
await t('nhom_huy chỉ huỷ lượt còn dat', async () => {
  const s = await fresh(); const r = await s.createBooking(B());
  clock.set(atMs(D, 660)); await s.checkIn(r.visits[0].id); await s.cancelBooking(r.booking.id);
  const vs = (await s.snapshot(D)).visits; eq([vs.find((v) => v.id === r.visits[0].id).status, vs.find((v) => v.id === r.visits[1].id).status], ['ngoi', 'huy']);
});
await t('walkIn vào box đang ngồi → TRUNG', async () => { const s = await fresh(); await s.walkIn({ boxId: 'b5', people: 2 }); eq(await code(() => s.walkIn({ boxId: 'b5', people: 1 })), 'TRUNG'); });
await t('walkIn vướng lượt đặt vẫn vào', async () => { const s = await fresh(); await s.createBooking(B({ boxIds: ['b1'] })); const v = await s.walkIn({ boxId: 'b1', people: 1, name: 'Khách lẻ' }); eq([v.status, v.guestName], ['ngoi', 'Khách lẻ']); });
await t('noShow', async () => { const s = await fresh(); const r = await s.createBooking(B({ boxIds: ['b1'] })); await s.noShow(r.visits[0].id); eq((await s.snapshot(D)).visits[0].status, 'vang'); });
await t('moveBox sang box đang ngồi → TRUNG, box trống → được', async () => {
  const s = await fresh(); const a = await s.walkIn({ boxId: 'b1', people: 1 }); await s.walkIn({ boxId: 'b2', people: 1 });
  eq([await code(() => s.moveBox(a.id, 'b2')), (await s.moveBox(a.id, 'b9')).boxId], ['TRUNG', 'b9']);
});
await t('editTimes tính lại giờ thêm', async () => {
  const s = await fresh(); const v = await s.walkIn({ boxId: 'b1', people: 1 }); clock.set(atMs(D, 600 + 200)); await s.checkOut(v.id);
  clock.set(atMs(D, 900)); const e = await s.editTimes(v.id, { inAt: atMs(D, 600), outAt: atMs(D, 600 + 250) }); eq([e.minutes, e.extra], [250, 2]);
});
await t('updateBooking không trùng chính nó + đổi box', async () => {
  const s = await fresh(); const r = await s.createBooking(B());
  const u = await s.updateBooking(r.booking.id, B({ boxIds: ['b2', 'b3'], people: 6 }));
  const live = u.visits.filter((v) => v.status === 'dat').map((v) => v.boxId).sort().join();
  eq([live, u.visits.find((v) => v.boxId === 'b1').status], ['b2,b3', 'huy']);
});
await t('nv saveSettings → QUYEN, chu được', async () => {
  const s = await fresh(); const st = await s.getSettings(); const a = await code(() => s.saveSettings({ ...st, close: '22:00' }));
  await s.login('u_chu'); await s.saveSettings({ ...st, close: '22:00' }); eq([a, (await s.getSettings()).close], ['QUYEN', '22:00']);
});
await t('findCustomers theo SĐT có dấu cách', async () => { const s = await fresh(); await s.createBooking(B()); eq((await s.findCustomers('987 654'))[0].customer.name, 'Minh'); });
await t('lưu bền qua storage', async () => {
  clock.set(atMs(D, 600)); const st = mem(); const a = createLocalStore({ storage: st, seed: false }); await a.login('u_a'); await a.walkIn({ boxId: 'b4', people: 1 });
  const b = createLocalStore({ storage: st, seed: false }); eq([(await b.snapshot(D)).visits.length, (await b.me()).id], [1, 'u_a']);
});
await t('storage hỏng → volatile', async () => { const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }; const s = createLocalStore({ storage: bad, seed: false }); eq(s.volatile, true); });
await t('dữ liệu mẫu có đủ trạng thái', async () => {
  clock.set(atMs(D, 872)); const s = createLocalStore({ storage: mem(), seed: true }); const vs = (await s.snapshot(D)).visits;
  eq([vs.filter((v) => v.status === 'ngoi').length >= 3, vs.some((v) => v.status === 'dat'), (await s.visitsRange('2026-11-13', '2026-11-18')).some((v) => v.status === 've')], [true, true, true]);
});
await t('C1 checkOut với giờ ra truyền vào (quên bấm, hôm sau mới bấm)', async () => {
  const s = await fresh(); const v = await s.walkIn({ boxId: 'b1', people: 1 });
  clock.set(atMs('2026-11-20', 540)); const r = await s.checkOut(v.id, atMs(D, 600 + 250));
  eq([r.minutes, r.extra], [250, 2]);
});
await t('C1 checkOut giờ ra trước giờ vào → LOI, lượt vẫn đang ngồi', async () => {
  const s = await fresh(); const v = await s.walkIn({ boxId: 'b1', people: 1 });
  const c = await code(() => s.checkOut(v.id, atMs(D, 500)));
  eq([c, (await s.snapshot(D)).visits[0].status], ['LOI', 'ngoi']);
});
await t('I1 editTimes sai không để lại dữ liệu hỏng', async () => {
  const s = await fresh(); const v = await s.walkIn({ boxId: 'b1', people: 1 }); clock.set(atMs(D, 660)); await s.checkOut(v.id);
  const c = await code(() => s.editTimes(v.id, { outAt: atMs(D, 500) }));
  const x = (await s.snapshot(D)).visits[0]; eq([c, x.outAt, x.minutes], ['LOI', atMs(D, 660), 60]);
});
await t('giờ mở cửa phải tròn :00 / :30', async () => {
  const s = await fresh('u_chu'); const st = await s.getSettings();
  eq([await code(() => s.saveSettings({ ...st, open: '08:15' })), await code(() => s.saveSettings({ ...st, open: '08:30' }))], ['LOI', 'OK']);
});
done();
