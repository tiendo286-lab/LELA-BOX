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
done();
