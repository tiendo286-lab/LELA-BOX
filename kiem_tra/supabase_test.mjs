import { t, eq, done } from './t.mjs';
import { createLocalStore } from '../docs/js/store/local.js';
import { createSupabaseStore } from '../docs/js/store/supabase.js';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };
const fns = (o) => Object.keys(o).filter((k) => typeof o[k] === 'function').sort();
await t('bản máy chủ có đủ hàm như bản chạy thử', () => {
  const a = fns(createLocalStore({ storage: mem(), seed: false })), b = fns(createSupabaseStore({ supabaseUrl: 'https://x.supabase.co', anonKey: 'k' }));
  eq(a.filter((k) => !b.includes(k)), []);
});
await t('chưa đăng nhập → me() = null', async () => eq(await createSupabaseStore({ supabaseUrl: 'https://x.supabase.co', anonKey: 'k' }).me(), null));
await t('chưa đăng nhập → gọi hàm báo QUYEN', async () => {
  try { await createSupabaseStore({ supabaseUrl: 'https://x.supabase.co', anonKey: 'k' }).snapshot('2026-11-19'); eq('không lỗi', 'QUYEN'); }
  catch (e) { eq(e.code, 'QUYEN'); }
});
// Máy chủ trả {__error} (không ném lỗi) khi PIN sai để bộ đếm sai PIN không bị hoàn tác → web phải coi là lỗi
await t('kết quả {__error: "QUYEN: …"} → báo lỗi QUYEN', async () => {
  const store = createSupabaseStore({ supabaseUrl: 'https://x.supabase.co', anonKey: 'k' });
  const realLS = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 3600000 }), setItem() {}, removeItem() {} };
  const s2 = createSupabaseStore({ supabaseUrl: 'https://x.supabase.co', anonKey: 'k' });
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ __error: 'QUYEN: PIN không đúng' }) });
  try { await s2.removeLine('o1', 'l1', { pin: '1', reason: 'x' }); eq('không lỗi', 'QUYEN'); }
  catch (e) { eq([e.code, e.message], ['QUYEN', 'PIN không đúng']); }
  globalThis.localStorage = realLS; void store;
});

done();
