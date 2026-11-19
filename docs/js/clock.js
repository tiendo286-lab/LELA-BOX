// Đồng hồ của web. Bài thử dùng ?now=2026-11-19T14:32 (giờ VN) để đóng băng giờ.
import { atMs } from './time.js';

let fixed = null;
export function now() { return fixed === null ? Date.now() : fixed; }
export function set(ms) { fixed = ms; }
export function advance(min) { fixed = now() + min * 60000; }
export function fromQuery(search) {
  const m = String(search || '').match(/[?&]now=(\d{4}-\d{2}-\d{2})T(\d{2})(?::|%3A)(\d{2})(?:&|$)/i);
  fixed = m ? atMs(m[1], Number(m[2]) * 60 + Number(m[3])) : null;
}
