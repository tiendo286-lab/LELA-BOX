import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { boxState, reminders, summary } from '../docs/js/board.js';

const S = { open: '08:00', close: '23:00', holdMin: 180, freeMin: 180, graceMin: 10, lateMin: 15, perBox: 3 };
const D = '2026-11-19';
const at = (min) => atMs(D, min);
const boxes = Array.from({ length: 12 }, (_, i) => ({ id: 'b' + (i + 1), name: 'Box ' + (i + 1), active: true, sort: i + 1 }));
const customers = [{ id: 'c1', name: 'Lan', phone: '0912345678' }];
const ngoi = (id, box, inMin) => ({ id, bookingId: null, boxId: box, customerId: null, status: 'ngoi', date: D, startMin: null, durMin: 180, inAt: at(inMin), outAt: null, people: 1 });
const dat = (id, box, startMin) => ({ id, bookingId: 'k' + id, boxId: box, customerId: 'c1', status: 'dat', date: D, startMin, durMin: 180, inAt: null, outAt: null, people: 2 });
const kindAt = (elapsed) => boxState(boxes[0], [ngoi('v1', 'b1', 600)], at(600 + elapsed), S).kind;
const kinds = (vs, now) => reminders(vs, boxes, customers, now, S).map((r) => r.kind);

await t('trống', () => eq(boxState(boxes[0], [], at(600), S).kind, 'trong'));
await t('ngưỡng ngồi / sắp hết / quá giờ', () => eq([164, 165, 190, 191].map(kindAt), ['ngoi', 'sap_het', 'sap_het', 'qua_gio']));
await t('elapsed', () => eq(boxState(boxes[0], [ngoi('v1', 'b1', 600)], at(730), S).elapsed, 130));
await t('tạm ngừng', () => eq(boxState({ ...boxes[0], active: false }, [], at(600), S).kind, 'tam_ngung'));
await t('next là lượt đặt sắp tới', () => eq(boxState(boxes[0], [dat('v2', 'b1', 780)], at(600), S).next.id, 'v2'));
await t('next bỏ lượt quá xa', () => eq(boxState(boxes[0], [dat('v2', 'b1', 800)], at(600), S).next, null));
await t('next gồm lượt đang trễ', () => eq(boxState(boxes[0], [dat('v2', 'b1', 560)], at(600), S).next.id, 'v2'));
await t('tre 15 phút chưa nhắc', () => eq(kinds([dat('v2', 'b7', 600)], at(615)), []));
await t('tre 16 phút nhắc + chữ', () => eq(reminders([dat('v2', 'b7', 600)], boxes, customers, at(617), S)[0], { key: 'tre:v2', kind: 'tre', boxId: 'b7', visitId: 'v2', text: 'Box 7: Lan (0912 345 678) trễ 17 phút' }));
await t('sap_het chữ', () => eq(reminders([ngoi('v1', 'b3', 460)], boxes, customers, at(632), S)[0].text, 'Box 3 hết 3 giờ lúc 10:40'));
await t('qua_gio chữ', () => eq(reminders([ngoi('v1', 'b3', 600)], boxes, customers, at(805), S)[0].text, 'Box 3 đã ngồi 3g25 (+1 giờ)'));
await t('sap_luot 15 phút có, 16 không', () => eq([kinds([ngoi('v1', 'b5', 700), dat('v2', 'b5', 900)], at(885)).includes('sap_luot'), kinds([ngoi('v1', 'b5', 700), dat('v2', 'b5', 900)], at(884)).includes('sap_luot')], [true, false]));
await t('sap_luot chữ', () => eq(reminders([ngoi('v1', 'b5', 800), dat('v2', 'b5', 900)], boxes, customers, at(890), S).find((r) => r.kind === 'sap_luot').text, 'Box 5 còn khách, 15:00 có khách đặt (Lan)'));
await t('quen_ve sau giờ đóng', () => eq([kinds([ngoi('v1', 'b5', 1300)], at(1380)).includes('quen_ve'), kinds([ngoi('v1', 'b5', 1300)], at(1381)).includes('quen_ve')], [false, true]));
await t('thứ tự nhắc', () => eq(kinds([ngoi('v1', 'b3', 460), dat('v2', 'b7', 600), ngoi('v3', 'b4', 400)], at(640)), ['tre', 'qua_gio', 'sap_het']));
await t('summary', () => {
  const vs = [ngoi('v1', 'b1', 600), dat('v2', 'b2', 700)];
  eq(summary(boxes.map((b) => boxState(b, vs, at(620), S))), { trong: 11, ngoi: 1, sapDat: 1 });
});
// ===== Nhắc chưa gọi món (tính tiền bước 8) =====
const S2 = { ...S, noOrderMin: 10 };
const chuaGoi = (stats, now) => reminders([ngoi('v1', 'b1', 600)], boxes, customers, now, S2, stats).filter((r) => r.kind === 'chua_goi').map((r) => r.text);
await t('chưa gọi món sau 10 phút → nhắc', () => eq(chuaGoi({ v1: { total: 0, have: 0, need: 2, firstAt: null } }, at(610)), ['Box 1 vào 10 phút chưa gọi món']));
await t('mới 9 phút → chưa nhắc', () => eq(chuaGoi({ v1: { total: 0, have: 0, need: 2, firstAt: null } }, at(609)), []));
await t('gọi chưa đủ → nhắc số món', () => eq(chuaGoi({ v1: { total: 35000, have: 1, need: 3, firstAt: at(602) } }, at(615)), ['Box 1 mới gọi 1/3 món']));
await t('đủ món → không nhắc; không có số liệu phiếu → không nhắc', () => eq([chuaGoi({ v1: { total: 1, have: 2, need: 2 } }, at(700)), chuaGoi(undefined, at(700))], [[], []]));

done();
