import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { normPhone, extraHours, suggestBoxCount, holdRange, clashes, checkBooking, checkCheckIn, freeBoxes } from '../docs/js/rules.js';

const S = { open: '08:00', close: '23:00', holdMin: 180, freeMin: 180, graceMin: 10, lateMin: 15, perBox: 3 };
const D = '2026-11-19';
const NOW = atMs(D, 600); // 10:00
const boxes = Array.from({ length: 12 }, (_, i) => ({ id: 'b' + (i + 1), name: 'Box ' + (i + 1), active: true, sort: i + 1 }));
const customers = [{ id: 'c1', name: 'Lan', phone: '0912345678' }];
const dat = (id, box, startMin, durMin = 180, date = D) => ({ id, bookingId: 'k' + id, boxId: box, customerId: 'c1', status: 'dat', date, startMin, durMin, inAt: null, outAt: null, people: 2 });
const ngoi = (id, box, inMin, durMin = 180) => ({ id, bookingId: null, boxId: box, customerId: null, status: 'ngoi', date: D, startMin: null, durMin, inAt: atMs(D, inMin), outAt: null, people: 1 });
const ctx = (visits, extra = {}) => ({ settings: S, boxes, customers, visits, now: NOW, ignoreVisitIds: [], ...extra });
const input = (o = {}) => ({ name: 'Minh', phone: '0987654321', date: D, startMin: 840, durMin: 180, people: 2, boxIds: ['b1'], ...o });

await t('gio_them', () => eq([190, 191, 240, 241, 301].map((m) => extraHours(m, S)), [0, 1, 1, 2, 3]));
await t('normPhone', () => eq(normPhone('+84 912.345.678'), '0912345678'));
await t('suggestBoxCount', () => eq([suggestBoxCount(5, 3), suggestBoxCount(10, 3), suggestBoxCount(1, 3)], [2, 3, 1]));
await t('holdRange dat', () => eq(holdRange(dat('v1', 'b1', 540), NOW, S), [atMs(D, 540), atMs(D, 720)]));
await t('holdRange ngoi kéo tới hiện tại', () => eq(holdRange(ngoi('v1', 'b1', 300), NOW, S), [atMs(D, 300), NOW]));
await t('holdRange ve → null', () => eq(holdRange({ ...ngoi('v1', 'b1', 300), status: 've' }, NOW, S), null));
await t('cham_mep', () => eq(clashes('b1', [atMs(D, 720), atMs(D, 900)], [dat('v1', 'b1', 540)], NOW, S).length, 0));
await t('giao_nhau', () => eq(clashes('b1', [atMs(D, 700), atMs(D, 900)], [dat('v1', 'b1', 540)], NOW, S).map((v) => v.id), ['v1']));
await t('khac_box', () => eq(clashes('b2', [atMs(D, 700), atMs(D, 900)], [dat('v1', 'b1', 540)], NOW, S).length, 0));
await t('huy_khong_giu', () => eq(clashes('b1', [atMs(D, 700), atMs(D, 900)], [{ ...dat('v1', 'b1', 540), status: 'huy' }], NOW, S).length, 0));
await t('booking hợp lệ', () => eq(checkBooking(input(), ctx([])), { error: null, warn: null }));
await t('trung báo rõ', () => eq(checkBooking(input({ startMin: 720 }), ctx([dat('v1', 'b1', 600)])).error, 'Box 1 trùng với Lan, 10:00–13:00'));
await t('sua_khong_trung', () => eq(checkBooking(input({ startMin: 600 }), ctx([dat('v1', 'b1', 600)], { ignoreVisitIds: ['v1'] })).error, null));
await t('dat_vuong_ngoi', () => eq(checkBooking(input({ startMin: 660, boxIds: ['b1'] }), ctx([ngoi('v1', 'b1', 570)])).error, 'Box 1 đang có khách ngồi'));
await t('bat_buoc ten', () => eq(checkBooking(input({ name: ' ' }), ctx([])).error, 'Nhập tên khách'));
await t('bat_buoc sdt', () => eq(checkBooking(input({ phone: '' }), ctx([])).error, 'Số điện thoại chưa đúng'));
await t('so box', () => eq([checkBooking(input({ boxIds: [] }), ctx([])).error, checkBooking(input({ boxIds: ['b1', 'b2', 'b3', 'b4'] }), ctx([])).error], ['Chọn 1–3 box', 'Chọn 1–3 box']));
await t('qua_7_ngay', () => eq([checkBooking(input({ date: '2026-11-26' }), ctx([])).error, checkBooking(input({ date: '2026-11-25' }), ctx([])).error], ['Chỉ đặt trước tối đa 7 ngày', null]));
await t('qua_khu', () => eq(checkBooking(input({ startMin: 570 }), ctx([])).error, 'Giờ này đã qua'));
await t('buoc_30', () => eq(checkBooking(input({ startMin: 845 }), ctx([])).error, 'Giờ phải theo bước 30 phút'));
await t('ngoai_gio', () => eq(checkBooking(input({ startMin: 1260 }), ctx([])).error, 'Ngoài giờ mở cửa (08:00–23:00)'));
await t('box tam ngung', () => eq(checkBooking(input({ boxIds: ['b4'] }), ctx([], { boxes: boxes.map((b) => (b.id === 'b4' ? { ...b, active: false } : b)) })).error, 'Box 4 đang tạm ngừng'));
await t('warn quá người', () => eq(checkBooking(input({ people: 4 }), ctx([])), { error: null, warn: '1 box chỉ chứa 3 người' }));
await t('vao_bi_chan', () => eq(checkCheckIn('b1', ctx([ngoi('v1', 'b1', 570)])).block, 'Box 1 đang có khách'));
await t('vao_canh_bao', () => {
  const r = checkCheckIn('b1', ctx([dat('v1', 'b1', 720)]));
  eq([r.block, r.warn, r.alternatives.includes('b1'), r.alternatives.length], [null, 'Box 1 có khách đặt 12:00 — chỉ ngồi được 2g00', false, 11]);
});
await t('vao_dung_phieu', () => eq(checkCheckIn('b1', ctx([dat('v1', 'b1', 600)]), 'v1'), { block: null, warn: null, alternatives: checkCheckIn('b1', ctx([dat('v1', 'b1', 600)]), 'v1').alternatives }));
await t('freeBoxes', () => eq(freeBoxes(D, 840, 180, ctx([dat('v1', 'b3', 900)])).map((b) => b.id).includes('b3'), false));
await t('freeBoxes đếm', () => eq(freeBoxes(D, 840, 180, ctx([dat('v1', 'b3', 900)])).length, 11));
done();
