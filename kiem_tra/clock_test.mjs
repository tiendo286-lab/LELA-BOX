import { t, eq, done } from './t.mjs';
import * as clock from '../docs/js/clock.js';
import { atMs } from '../docs/js/time.js';
await t('fromQuery đóng băng giờ VN', () => { clock.fromQuery('?now=2026-11-19T14:32'); eq(clock.now(), atMs('2026-11-19', 872)); });
await t('advance', () => { const a = clock.now(); clock.advance(10); eq(clock.now() - a, 600000); });
await t('set', () => { clock.set(123); eq(clock.now(), 123); });
await t('không có now → giờ thật', () => { clock.fromQuery(''); const d = Math.abs(clock.now() - Date.now()); if (d > 1000) throw new Error('lệch ' + d); });
done();
