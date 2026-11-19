import config from '../config.js';
import { createLocalStore } from './local.js';

export async function makeStore() {
  if (config.store === 'supabase') {
    const m = await import('./supabase.js');
    return m.createSupabaseStore(config);
  }
  return createLocalStore();
}
