import { t, eq, done } from './t.mjs';
import { atMs } from '../docs/js/time.js';
import * as clock from '../docs/js/clock.js';
import { createLocalStore } from '../docs/js/store/local.js';

const D = '2026-11-19';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
// seed=false: không có khách mẫu; menu mẫu vẫn cần → sales:true nạp menu / khuyến mãi / kho mẫu
const fresh = async (who = 'u_a', min = 600) => { clock.set(atMs(D, min)); const s = createLocalStore({ storage: mem(), seed: false, salesSeed: true }); await s.login(who); return s; };
const code = async (fn) => { try { await fn(); return 'OK'; } catch (e) { return e.code || String(e); } };
const msg = async (fn) => { try { await fn(); return 'OK'; } catch (e) { return e.message; } };
const as = async (s, who) => { await s.login(who); return s; };

// ===== Bước 3: vai trò, PIN, menu, khuyến mãi, voucher =====
await t('có menu mẫu + Quản lý (thử)', async () => {
  const s = await fresh();
  const menu = await s.listMenu();
  eq([menu.some((m) => m.name === 'Trà đào' && m.price === 35000), menu.some((m) => m.kind === 'combo' && m.serves === 3), (await s.listStaff()).some((u) => u.role === 'ql')], [true, true, true]);
});
await t('cài đặt có giá ngồi thêm mặc định', async () => { const s = await fresh(); const x = await s.getSettings(); eq([x.extraPrice, x.minPerPerson, x.paper, x.noOrderMin], [20000, 1, '80', 10]); });
await t('nhân viên không sửa được menu', async () => { const s = await fresh(); eq(await code(() => s.saveMenuItem({ name: 'X', group: 'Trà', price: 1000, kind: 'mon' })), 'QUYEN'); });
await t('Chủ thêm món giá 0 → lỗi', async () => { const s = await fresh('u_chu'); eq(await msg(() => s.saveMenuItem({ name: 'X', group: 'Trà', price: 0, kind: 'mon' })), 'Giá phải lớn hơn 0'); });
await t('combo thiếu ô chọn → lỗi', async () => { const s = await fresh('u_chu'); eq(await msg(() => s.saveMenuItem({ name: 'C', group: 'Combo', price: 100000, kind: 'combo', serves: 2, slots: [] })), 'Combo cần ít nhất 1 ô chọn món'); });
await t('nhập menu: trùng tên (bỏ dấu, hoa thường) thì cập nhật', async () => {
  const s = await fresh('u_chu');
  const r = await s.importMenu([{ name: 'TRA DAO', group: 'Trà', price: 38000 }, { name: 'Trà chanh', group: 'Trà', price: 30000 }]);
  const menu = await s.listMenu();
  eq([r, menu.find((m) => m.name === 'Trà đào').price, menu.some((m) => m.name === 'Trà chanh')], [{ added: 1, updated: 1 }, 38000, true]);
});
await t('PIN phải 4–6 số', async () => { const s = await fresh('u_ql'); eq(await msg(() => s.setPin('12a4')), 'PIN gồm 4–6 chữ số'); });
await t('nhân viên không đặt PIN', async () => { const s = await fresh(); eq(await code(() => s.setPin('1234')), 'QUYEN'); });
await t('voucher trùng mã → lỗi; mã lưu chữ HOA', async () => {
  const s = await fresh('u_chu');
  await s.saveVoucher({ code: 'abc5', active: true, kind: 'amt', value: 5000, maxUses: 0, minTotal: 0 });
  eq([(await s.listVouchers()).some((v) => v.code === 'ABC5'), await msg(() => s.saveVoucher({ code: 'lela10', active: true, kind: 'pct', value: 5 }))], [true, 'Mã này đã có']);
});
await t('khuyến mãi: Chủ lưu được, nhân viên không', async () => {
  const s = await fresh('u_chu');
  const n = (await s.listPromotions()).length;
  await s.savePromotion({ name: 'Cuối tuần', active: true, kind: 'pct', value: 10, scope: 'all', days: [6, 7], fromMin: 480, toMin: 1380 });
  eq((await s.listPromotions()).length, n + 1);
  await as(s, 'u_a');
  eq(await code(() => s.savePromotion({ name: 'X', active: true, kind: 'pct', value: 10 })), 'QUYEN');
});
await t('thêm nhân viên vai trò Quản lý', async () => { const s = await fresh('u_chu'); const l = await s.saveStaff({ name: 'QL2', role: 'ql' }); eq(l.some((u) => u.name === 'QL2' && u.role === 'ql'), true); });
await t('cài đặt mới: giá ngồi thêm âm / khổ giấy lạ → lỗi', async () => {
  const s = await fresh('u_chu');
  eq([await code(() => s.saveSettings({ extraPrice: -1 })), await code(() => s.saveSettings({ paper: '72' })), (await s.saveSettings({ extraPrice: 25000 })).extraPrice], ['LOI', 'LOI', 25000]);
});

done();
