// Bộ kiểm tra tí hon cho jsc: t(tên, fn) — fn ném lỗi là FAIL
let fails = 0, passes = 0;
const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
export function eq(a, b, msg = '') { if (show(a) !== show(b)) throw new Error(`${msg} mong ${show(b)}, nhận ${show(a)}`); }
export async function t(name, fn) {
  try { await fn(); passes++; print('PASS ' + name); }
  catch (e) { fails++; print('FAIL ' + name + ' — ' + (e && e.message || e)); }
}
export function done() { print(`== ${passes} đạt, ${fails} hỏng`); }
