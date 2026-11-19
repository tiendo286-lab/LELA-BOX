// Đọc bảng menu (từ file Excel / CSV xuất ở KiotViet) → [{name, group, price}]. Thuần.
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const NAME = ['ten hang', 'ten hang hoa', 'ten mon', 'ten'];
const GROUP = ['nhom hang', 'nhom'];
const PRICE = ['gia ban', 'gia'];

export function parseMenuRows(rows) {
  const R = (rows || []).map((r) => (Array.isArray(r) ? r : []));
  for (let h = 0; h < Math.min(10, R.length); h++) {
    const head = R[h].map(fold);
    const find = (names, prefix) => head.findIndex((c) => names.includes(c) || (prefix && c.startsWith(prefix)));
    const ci = find(NAME), gi = find(GROUP, 'nhom hang'), pi = find(PRICE);
    if (ci < 0 || pi < 0) continue;
    const items = [];
    for (const r of R.slice(h + 1)) {
      const name = String(r[ci] ?? '').trim();
      const price = Number(String(r[pi] ?? '').replace(/\D/g, '')) || 0;
      if (!name || price <= 0) continue;
      items.push({ name, group: (gi >= 0 && String(r[gi] ?? '').trim()) || 'Khác', price });
    }
    return { items, error: null };
  }
  return { items: [], error: 'Không thấy cột Tên hàng / Giá bán trong file' };
}
