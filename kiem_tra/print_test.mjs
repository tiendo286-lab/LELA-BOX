import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import { ticketHtml, receiptHtml } from '../docs/js/print.js';

const S = { shopName: 'Lela Box', billFooter: 'Cảm ơn quý khách!', paper: '80' };
const R = {
  shopName: 'Lela Box', footer: 'Cảm ơn quý khách!', boxNames: ['Box 2'], inAt: atMs('2026-11-19', 480), outAt: atMs('2026-11-19', 721), minutes: 241,
  lines: [{ name: 'Trà <b>đào</b>', price: 35000, qty: 1, kind: 'mon', picks: [] }, { name: 'Combo 3 người', price: 150000, qty: 1, kind: 'combo', picks: [{ name: 'Trà vải' }, { name: 'Bạc xỉu' }] }],
  priced: { goods: 185000, extraAmount: 40000, extraHours: 2, extraPrice: 20000, promos: [{ source: 'tu_dong', name: 'Giờ vàng', amount: 7000 }], manualAmount: 3000, total: 215000 },
  payments: [{ method: 'tien_mat', amount: 115000 }, { method: 'chuyen_khoan', amount: 100000 }], change: 5000, paidBy: 'NV A', at: atMs('2026-11-19', 721), reprint: false,
};
const has = (h, x) => h.includes(x);
await t('hoá đơn có đủ dòng tiền', () => {
  const h = receiptHtml(R, S);
  eq([has(h, 'Box 2'), has(h, '08:00'), has(h, '12:01'), has(h, '4g01'), has(h, 'Ngồi thêm 2 giờ × 20.000đ'), has(h, '40.000đ'), has(h, 'Giờ vàng'), has(h, '-7.000đ'), has(h, 'Giảm tay'), has(h, 'TỔNG'), has(h, '215.000đ'), has(h, 'Tiền mặt'), has(h, 'Chuyển khoản'), has(h, 'Tiền thối'), has(h, '5.000đ'), has(h, 'Cảm ơn quý khách!')],
    Array(16).fill(true));
});
await t('hoá đơn thoát ký tự HTML', () => { const h = receiptHtml(R, S); eq([has(h, '<b>đào'), has(h, '&lt;b&gt;đào')], [false, true]); });
await t('hoá đơn in lại có chữ IN LẠI', () => eq([has(receiptHtml({ ...R, reprint: true }, S), 'IN LẠI'), has(receiptHtml(R, S), 'IN LẠI')], [true, false]));
await t('hoá đơn combo liệt kê món đã chọn', () => eq(has(receiptHtml(R, S), 'Trà vải'), true));
await t('phiếu pha chế: gọi thêm + ghi chú + món combo', () => {
  const tk = { boxName: 'Box 3', at: atMs('2026-11-19', 875), again: true, by: 'NV A', lines: [{ name: 'Trà đào', qty: 2, note: 'ít đá', picks: [] }, { name: 'Combo 3 người', qty: 1, note: '', picks: ['Trà vải', 'Bạc xỉu'] }] };
  const h = ticketHtml(tk, S);
  eq([has(h, 'GỌI THÊM'), has(h, 'Box 3'), has(h, '14:35'), has(h, '2 × Trà đào'), has(h, 'ít đá'), has(h, 'Trà vải'), has(ticketHtml({ ...tk, again: false }, S), 'GỌI THÊM')], [true, true, true, true, true, true, false]);
});
done();
