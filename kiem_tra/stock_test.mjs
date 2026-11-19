import { t, eq, done } from './t.mjs';
import { expectedQty, deductions } from '../docs/js/stock.js';
import { parseMenuRows } from '../docs/js/menu_import.js';

const M = (kind, qty, at, id = 'k_coca') => ({ stockItemId: id, kind, qty, at });
const moves = [M('nhap', 24, 1), M('ban', 3, 2), M('ban', 2, 4), M('hoan', 1, 5), M('nhap', 50, 1, 'k_khac')];

await t('đáng lẽ còn: tính từ lần đếm gần nhất', () => eq(expectedQty('k_coca', moves, [{ at: 3, items: [{ stockItemId: 'k_coca', counted: 20 }] }]), 19));
await t('đáng lẽ còn: chưa đếm lần nào', () => eq(expectedQty('k_coca', moves, []), 20));
await t('đáng lẽ còn: lần đếm không có hàng này thì bỏ qua', () => eq(expectedQty('k_coca', moves, [{ at: 3, items: [{ stockItemId: 'k_khac', counted: 5 }] }]), 20));
await t('đáng lẽ còn: lấy lần đếm MỚI nhất', () => eq(expectedQty('k_coca', moves, [
  { at: 4.5, items: [{ stockItemId: 'k_coca', counted: 10 }] }, { at: 3, items: [{ stockItemId: 'k_coca', counted: 20 }] }]), 11));

const stock = [{ id: 'k_coca', menuItemId: 'm_coca' }, { id: 'k_sua', menuItemId: null }];
await t('trừ kho: món bán nguyên + món trong combo, gộp theo hàng', () => eq(deductions([
  { menuItemId: 'm_coca', kind: 'mon', qty: 2 },
  { menuItemId: 'm_combo', kind: 'combo', qty: 1, picks: [{ menuItemId: 'm_coca' }, { menuItemId: 'm_tra' }] },
  { menuItemId: 'm_coca', kind: 'mon', qty: 5, voided: { by: 'QL' } },
], stock), [{ stockItemId: 'k_coca', qty: 3 }]));
await t('trừ kho: combo 2 suất nhân số pick', () => eq(deductions([{ kind: 'combo', qty: 2, picks: [{ menuItemId: 'm_coca' }] }], stock), [{ stockItemId: 'k_coca', qty: 2 }]));

await t('đọc Excel KiotViet', () => eq(parseMenuRows([
  ['Danh sách hàng hoá'],
  ['Loại hàng', 'Nhóm hàng(3 Cấp)', 'Mã hàng', 'Tên hàng', 'Giá bán', 'Giá vốn'],
  ['Hàng hóa', 'Trà', 'SP01', 'Trà đào', '35,000', '10000'],
  ['Hàng hóa', 'Nước', 'SP02', 'Coca', 20000, 8000],
  ['Hàng hóa', 'Nước', 'SP03', '', '1000', ''],
  ['Hàng hóa', 'Nước', 'SP04', 'Hết bán', '0', ''],
]), { items: [{ name: 'Trà đào', group: 'Trà', price: 35000 }, { name: 'Coca', group: 'Nước', price: 20000 }], error: null }));
await t('đọc Excel: thiếu cột giá', () => eq(parseMenuRows([['Tên hàng', 'Nhóm hàng'], ['Trà', 'Trà']]).error, 'Không thấy cột Tên hàng / Giá bán trong file'));
await t('đọc Excel: không có cột nhóm → nhóm "Khác"', () => eq(parseMenuRows([['Tên', 'Giá'], ['Bánh', '15.000']]).items, [{ name: 'Bánh', group: 'Khác', price: 15000 }]));
done();
