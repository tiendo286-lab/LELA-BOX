// Dải nhắc việc + chuông. Nhắc mới (chưa từng hiện) kêu chuông một lần; "Đã xem" ẩn nhắc trên máy này.
import { html, str, on } from '../ui.js';

const SEEN = 'lelabox.seen';
const announced = new Set();
let memSeen = [];
let ac = null;

function readSeen() { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return memSeen; } }
function writeSeen(list) { memSeen = list.slice(-300); try { localStorage.setItem(SEEN, JSON.stringify(memSeen)); } catch { /* chỉ nhớ trong phiên */ } }

export function beep() {
  window.__lelaBeeps = (window.__lelaBeeps || 0) + 1;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    [0, 0.35].forEach((t) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.25, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.3);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3);
    });
  } catch { /* máy không phát được âm thanh */ }
}
// Trình duyệt chỉ cho phát âm thanh sau lần chạm đầu tiên
document.addEventListener('pointerdown', () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { /* bỏ qua */ } }, { once: true });

// Vẽ dải nhắc; onOpen(boxId) khi bấm vào một nhắc
export function mountReminders(el, list, onOpen) {
  const seen = new Set(readSeen());
  const shown = list.filter((r) => !seen.has(r.key));
  const fresh = shown.filter((r) => !announced.has(r.key));
  fresh.forEach((r) => announced.add(r.key));
  if (fresh.length) beep();
  el.innerHTML = shown.length ? str(html`<ul class="nhac">${shown.map((r) => html`
    <li class="nhac-item k-${r.kind}" data-key="${r.key}">
      <button type="button" class="ghost nhac-text" data-open="${r.boxId}">🔔 ${r.text}</button>
      <button type="button" data-act="seen">Đã xem</button>
    </li>`)}</ul>`) : '';
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    on(el, 'click', '[data-act="seen"]', (e, b) => {
      const li = b.closest('.nhac-item');
      writeSeen([...readSeen(), li.dataset.key]);
      li.remove();
    });
    on(el, 'click', '[data-open]', (e, b) => el.__onOpen && el.__onOpen(b.dataset.open));
  }
  el.__onOpen = onOpen;
}
