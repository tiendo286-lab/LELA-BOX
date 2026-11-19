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

// CSV (dấu phẩy hoặc chấm phẩy, có ngoặc kép) → mảng dòng
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

// Ô chọn combo viết bằng chữ, mỗi dòng: "Tên ô; số món; nhóm1, nhóm2"
export function parseSlots(text) {
  const slots = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    const [label, count, groups] = ln.split(';').map((x) => (x || '').trim());
    const n = Number(count);
    const gs = (groups || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!label || !Number.isInteger(n) || n < 1 || !gs.length) return { slots: [], error: `Dòng ${i + 1}: cần dạng "Tên ô; số món; nhóm1, nhóm2"` };
    slots.push({ label, count: n, groups: gs });
  }
  return { slots, error: null };
}
export const fmtSlots = (slots) => (slots || []).map((s) => `${s.label}; ${s.count}; ${s.groups.join(', ')}`).join('\n');
