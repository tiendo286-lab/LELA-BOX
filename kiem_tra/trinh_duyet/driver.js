// Bộ điều khiển bài thử: chạy test/<script>.js rồi gửi kết quả về máy chủ (POST /ketqua).
const q = new URLSearchParams(location.search);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [], notes = [];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const visible = (e) => e && e.offsetParent !== null;

async function settle() {
  let last = '';
  for (let i = 0; i < 40; i++) { await sleep(60); const x = document.body.innerHTML; if (x === last) return; last = x; }
}
async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const v = typeof fn === 'string' ? $(fn) : fn(); if (v) return v; } catch { /* thử lại */ }
    await sleep(60);
  }
  return null;
}

const h = {
  q, $, $$, sleep, settle, waitFor, errs, notes, visible,
  check(ok, msg) { if (!ok) errs.push(msg); else notes.push('✓ ' + msg); return ok; },
  note(m) { notes.push(m); },
  async go(hash) { location.hash = hash; await sleep(80); await settle(); },
  async click(target) {
    const el = typeof target === 'string' ? await waitFor(target) : target;
    if (!el) { errs.push('không thấy để bấm: ' + target); return null; }
    el.click(); await settle(); return el;
  },
  async clickText(text, sel = 'button, a, [role=button]') {
    const el = await waitFor(() => $$(sel).find((e) => visible(e) && e.textContent.trim().includes(text)));
    if (!el) { errs.push('không thấy nút: ' + text); return null; }
    el.click(); await settle(); return el;
  },
  async fill(sel, value) {
    const el = typeof sel === 'string' ? await waitFor(sel) : sel;
    if (!el) { errs.push('không thấy ô: ' + sel); return null; }
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(); return el;
  },
  has: (t) => document.body.innerText.includes(t),
  text: () => document.body.innerText,
  noOverflow(label = '') {
    const w = document.documentElement.scrollWidth, iw = window.innerWidth;
    h.check(w <= iw + 1, `không tràn ngang ${label} (rộng ${w}/${iw})`);
  },
  strange() {
    const m = document.body.innerText.match(/.{0,30}(undefined|NaN|\[object Object\]|\bnull\b).{0,30}/);
    h.check(!m, 'không có chữ lạ' + (m ? ': ' + m[0] : ''));
  },
};

async function main() {
  notes.push(`trang ${location.pathname} · rộng ${innerWidth}px · ${window.top === window ? 'cửa sổ chính' : 'trong khung'}`);
  await waitFor(() => window.__lela && window.__lela.ready, 8000);
  await settle();
  try {
    const m = await import('./' + q.get('script') + '.js');
    await m.default(h);
  } catch (e) { errs.push('bài thử lỗi: ' + (e.stack || e)); }
  errs.push(...(window.__ERR || []));
  await fetch('/ketqua', { method: 'POST', body: JSON.stringify({ errs, notes }) });
}
if (q.get('auto')) main();
