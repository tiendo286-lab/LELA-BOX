// Hàm thuần về giờ và "ngày làm việc".
// Giờ trong ngày làm việc tính bằng phút kể từ 00:00 của ngày đó; ca qua đêm có phút > 1440.

export const DAY = 1440;
const pad = (n) => String(n).padStart(2, '0');

export function toMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fmtMin(min) {
  const m = ((min % DAY) + DAY) % DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// Giờ đóng ≤ giờ mở nghĩa là đóng vào sáng hôm sau
export function dayWindow(settings) {
  const openMin = toMin(settings.open);
  let closeMin = toMin(settings.close);
  if (closeMin <= openMin) closeMin += DAY;
  return { openMin, closeMin };
}

export function slots(settings, step = 30) {
  const { openMin, closeMin } = dayWindow(settings);
  const out = [];
  for (let m = openMin; m + step <= closeMin; m += step) out.push(m);
  return out;
}

const parse = (iso) => { const [y, mo, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d)); };
const iso = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

export function addDays(isoDate, n) {
  const dt = parse(isoDate);
  dt.setUTCDate(dt.getUTCDate() + n);
  return iso(dt);
}

// Ngày làm việc hiện tại theo giờ Việt Nam (UTC+7).
// Trong ca qua đêm (vd 00:30 khi đóng cửa 01:00) vẫn thuộc ngày làm việc hôm trước.
export function todayIso(now = new Date(), settings = null) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const today = iso(vn);
  if (settings) {
    const { closeMin } = dayWindow(settings);
    const nowMin = vn.getUTCHours() * 60 + vn.getUTCMinutes();
    if (closeMin > DAY && nowMin < closeMin - DAY) return addDays(today, -1);
  }
  return today;
}

const THU = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export function fmtDay(isoDate) {
  const dt = parse(isoDate);
  return `${THU[dt.getUTCDay()]}, ${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}`;
}
