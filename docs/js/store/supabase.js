// Bản cắm dữ liệu MÁY CHỦ THẬT (Supabase). Cùng giao diện với store/local.js.
// Chỉ dùng khoá công khai (anon). Đăng nhập email + mật khẩu qua Supabase Auth; mọi việc đi qua hàm app_* trên máy chủ.
import { StoreError } from './local.js';
import { STATUS_LABEL } from '../rules.js';

const TOKEN = 'lelabox.sb';

export function createSupabaseStore({ supabaseUrl, anonKey }) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  let session = null;
  try { session = JSON.parse(localStorage.getItem(TOKEN) || 'null'); } catch { session = null; }
  const keep = (s) => { session = s; try { if (s) localStorage.setItem(TOKEN, JSON.stringify(s)); else localStorage.removeItem(TOKEN); } catch { /* chỉ nhớ trong phiên */ } };

  async function auth(path, body) {
    const r = await fetch(`${base}/auth/v1/${path}`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new StoreError('QUYEN', j.error_description || j.msg || 'Sai email hoặc mật khẩu');
    keep({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 });
  }
  async function token() {
    if (!session) return null;
    if (Date.now() > session.expires_at - 60000) {
      try { await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }); } catch { keep(null); return null; }
    }
    return session.access_token;
  }
  async function rpc(fn, args = {}) {
    const t = await token();
    if (!t) throw new StoreError('QUYEN', 'Phiên đăng nhập đã hết, đăng nhập lại');
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const m = String((j && (j.message || j.hint)) || `Lỗi máy chủ (${r.status})`);
      const x = m.match(/^(TRUNG|LOI|QUYEN):\s*(.*)$/s);
      throw new StoreError(x ? x[1] : 'LOI', x ? x[2] : m);
    }
    return j;
  }

  return {
    kind: 'supabase',
    volatile: false,
    statusLabel: STATUS_LABEL,

    async me() { if (!session) return null; try { return await rpc('app_me'); } catch { return null; } },
    async login(email, password) { await auth('token?grant_type=password', { email, password }); const u = await rpc('app_me'); if (!u) { keep(null); throw new StoreError('QUYEN', 'Email này chưa được Chủ gán vai trò'); } return u; },
    async logout() { try { const t = await token(); if (t) await fetch(`${base}/auth/v1/logout`, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${t}` } }); } catch { /* bỏ qua */ } keep(null); },
    listStaff: () => rpc('app_staff_list'),
    saveStaff: (u) => rpc('app_staff_save', { p: u }),

    getSettings: () => rpc('app_settings_get'),
    saveSettings: (s) => rpc('app_settings_save', { p: s }),
    listBoxes: ({ all = false } = {}) => rpc('app_boxes_list', { p_all: all }),
    saveBox: (b) => rpc('app_box_save', { p: b }),

    snapshot: (date) => rpc('app_snapshot', { p_date: date }),
    visitsRange: (from, to) => rpc('app_visits_range', { p_from: from, p_to: to }),

    createBooking: (input) => rpc('app_booking_create', { p: input }),
    updateBooking: (id, input) => rpc('app_booking_update', { p_id: id, p: input }),
    cancelBooking: (id) => rpc('app_booking_cancel', { p_id: id }),
    walkIn: (input) => rpc('app_walk_in', { p: input }),
    checkIn: (id) => rpc('app_check_in', { p_id: id }),
    checkOut: (id) => rpc('app_check_out', { p_id: id }),
    noShow: (id) => rpc('app_no_show', { p_id: id }),
    moveBox: (id, boxId) => rpc('app_move_box', { p_id: id, p_box: boxId }),
    editTimes: (id, t) => rpc('app_edit_times', { p_id: id, p: t }),
    findCustomers: (q) => (String(q || '').trim().length < 2 ? Promise.resolve([]) : rpc('app_customers_find', { p_q: q })),
  };
}
