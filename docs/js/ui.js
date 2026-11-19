// Tiện ích giao diện dùng chung (esc / raw / html chép từ web Milano)

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Tagged template: html`<b>${x}</b>` tự thoát giá trị; dùng raw(...) cho đoạn HTML đã an toàn
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (Array.isArray(v)) out += v.flat(Infinity).map((x) => (x && x[RAW] !== undefined ? x[RAW] : (x === false || x === null || x === undefined ? '' : esc(x)))).join('');
      else if (v && v[RAW] !== undefined) out += v[RAW];
      else if (v === false || v === null || v === undefined) out += '';
      else out += esc(v);
    }
  });
  return raw(out);
}
export const str = (h) => (h && h[RAW] !== undefined ? h[RAW] : String(h ?? ''));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Bỏ dấu để tìm kiếm
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Bắt sự kiện theo bộ chọn trong một vùng
export function on(root, type, sel, fn) {
  root.addEventListener(type, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
}

// Thông báo nhanh ở dưới màn hình
export function toast(message, kind = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3000);
}

// Bảng trượt (thay cho hộp thoại): điện thoại trượt từ dưới lên, máy tính hiện giữa màn hình
export function openSheet(title, body) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = str(html`<div class="sheet" role="dialog" aria-label="${title}">
    <header><h2>${title}</h2><button type="button" class="ghost x" data-act="close" aria-label="Đóng">✕</button></header>
    <div class="sheet-body">${body}</div></div>`);
  document.body.appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-act="close"]')) close(); });
  return { el: bg.querySelector('.sheet'), close };
}

export const closeSheets = () => $$('.sheet-bg').forEach((x) => x.remove());

// Báo lỗi từ store cho người dùng
export function showError(e) { toast((e && e.message) || 'Có lỗi, thử lại', 'err'); }
