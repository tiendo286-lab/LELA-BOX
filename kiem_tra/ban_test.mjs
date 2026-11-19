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

// ===== Bước 4: phiếu, gửi pha chế, thanh toán, huỷ hoá đơn =====
const vao = async (s, boxId = 'b1', people = 2) => (await s.walkIn({ boxId, people })).id;
const phieu = async (s, vid) => (await s.ordersOfVisit(vid))[0];
const goi = (s, oid, ...items) => s.addLines(oid, items.map(([menuItemId, qty = 1, picks]) => ({ menuItemId, qty, note: '', picks })));
const visitOf = async (s, vid) => (await s.snapshot(D)).visits.find((v) => v.id === vid) || (await s.visitsRange('2026-11-01', '2026-11-30')).find((v) => v.id === vid);

await t('phieu_tu_mo: khách vào → có 1 phiếu mở', async () => {
  const s = await fresh(); const vid = await vao(s);
  const os = await s.ordersOfVisit(vid); const again = await s.ordersOfVisit(vid);
  eq([os.length, os[0].status, again[0].id === os[0].id], [1, 'mo', true]);
});
await t('gia_chep_luc_goi: đổi giá menu không đổi phiếu', async () => {
  const s = await fresh(); const vid = await vao(s); const o = await phieu(s, vid);
  await goi(s, o.id, ['m_trdao']);
  await as(s, 'u_chu'); await s.saveMenuItem({ ...(await s.listMenu()).find((m) => m.id === 'm_trdao'), price: 40000 });
  eq((await phieu(s, vid)).lines[0].price, 35000);
});
await t('combo phải chọn đủ món', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s, 'b1', 3));
  eq(await msg(() => goi(s, o.id, ['m_combo3', 1, [{ menuItemId: 'm_trdao' }]])), 'Chọn đủ món cho combo');
  const r = await goi(s, o.id, ['m_combo3', 1, [{ menuItemId: 'm_trdao' }, { menuItemId: 'm_trvai' }, { menuItemId: 'm_cfs' }, { menuItemId: 'm_hd' }]]);
  eq([r.lines[0].picks.map((p) => p.name).join(), r.lines[0].serves], ['Trà đào,Trà vải,Cà phê sữa,Hướng dương', 3]);
});
await t('combo: món không thuộc nhóm của ô → lỗi', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  eq(await msg(() => goi(s, o.id, ['m_combo3', 1, [{ menuItemId: 'm_coca' }, { menuItemId: 'm_trvai' }, { menuItemId: 'm_cfs' }, { menuItemId: 'm_hd' }]])), 'Chọn đủ món cho combo');
});
await t('gui_pha_che_chi_mon_moi', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  await goi(s, o.id, ['m_trdao', 2], ['m_coca']);
  const a = await s.sendToBar(o.id);
  await goi(s, o.id, ['m_hd']);
  const b = await s.sendToBar(o.id);
  eq([a.ticket.lines.length, a.ticket.again, a.ticket.boxName, b.ticket.lines.map((l) => l.name), b.ticket.again, await msg(() => s.sendToBar(o.id))],
    [2, false, 'Box 1', ['Hướng dương'], true, 'Không có món mới để gửi']);
});
await t('xoa_chua_gui_khong_pin', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']);
  eq((await s.removeLine(o.id, r.lines[0].id)).lines.length, 0);
});
await t('huy_da_gui_can_pin', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']); await s.sendToBar(o.id);
  const lid = r.lines[0].id;
  const c1 = await code(() => s.removeLine(o.id, lid));
  const c2 = await msg(() => s.removeLine(o.id, lid, { pin: '9999', reason: 'khách đổi' }));
  const x = await s.removeLine(o.id, lid, { pin: '2222', reason: 'khách đổi' });
  eq([c1, c2, x.lines[0].voided.by, x.lines.length], ['QUYEN', 'PIN không đúng', 'Quản lý (thử)', 1]);
});
await t('QL tự huỷ không cần PIN nhưng phải ghi lý do', async () => {
  const s = await fresh('u_ql'); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']); await s.sendToBar(o.id);
  eq([await msg(() => s.removeLine(o.id, r.lines[0].id, { reason: '' })), !!(await s.removeLine(o.id, r.lines[0].id, { reason: 'pha hỏng' })).lines[0].voided], ['Ghi lý do', true]);
});
await t('pin_sai_5_lan → khoá 5 phút', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']); await s.sendToBar(o.id);
  for (let i = 0; i < 5; i++) await code(() => s.removeLine(o.id, r.lines[0].id, { pin: '000' + i, reason: 'x' }));
  const locked = await msg(() => s.removeLine(o.id, r.lines[0].id, { pin: '2222', reason: 'x' }));
  clock.advance(5);
  const ok = await code(() => s.removeLine(o.id, r.lines[0].id, { pin: '2222', reason: 'x' }));
  eq([locked, ok], ['Sai PIN quá 5 lần — chờ 5 phút', 'OK']);
});
await t('thanh_toan_mot_lenh: tiền món + giờ thêm, lượt về, trừ kho', async () => {
  const s = await fresh('u_a', 480); const vid = await vao(s); const o = await phieu(s, vid);
  await goi(s, o.id, ['m_trdao'], ['m_coca']);
  clock.set(atMs(D, 480 + 241));
  const q = await s.quote([o.id]);
  const r = await s.pay([o.id], { transfer: 0, cashGiven: 100000 });
  const v = await visitOf(s, vid);
  await as(s, 'u_chu');
  const mv = await s.movesList(D, D);
  eq([q.total, q.orders[0].priced.extraAmount, r.receipt.change, r.receipt.priced.total, v.status, v.extra, mv.filter((m) => m.kind === 'ban').map((m) => [m.name, m.qty])],
    [95000, 40000, 5000, 95000, 've', 2, [['Coca', 1]]]);
});
await t('thu_hai_lan → Phiếu đã thu', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  eq(await msg(() => s.pay([o.id], { transfer: 20000, cashGiven: 0 })), 'Phiếu đã thu');
});
await t('thu_0d_can_pin', async () => {
  const s = await fresh(); const vid = await vao(s); const o = await phieu(s, vid);
  clock.advance(60);
  const c = await code(() => s.pay([o.id], { transfer: 0, cashGiven: 0 }));
  await s.pay([o.id], { transfer: 0, cashGiven: 0, auth: { pin: '1111', reason: 'khách quen ghé chơi' } });
  eq([c, (await visitOf(s, vid)).status], ['QUYEN', 've']);
});
await t('tach_bill: giờ thêm nằm ở phiếu thu cuối', async () => {
  const s = await fresh('u_a', 480); const vid = await vao(s); const o = await phieu(s, vid);
  const r = await goi(s, o.id, ['m_trdao'], ['m_coca'], ['m_hd']);
  const o2 = await s.splitOrder(o.id, [r.lines[2].id]);
  clock.set(atMs(D, 480 + 200));
  const q2 = await s.quote([o2.id]);
  await s.pay([o2.id], { transfer: 0, cashGiven: 25000 });
  const still = (await visitOf(s, vid)).status;
  const q1 = await s.quote([o.id]);
  await s.pay([o.id], { transfer: q1.total, cashGiven: 0 });
  eq([o2.lines.length, q2.orders[0].isLast, q2.total, still, q1.orders[0].priced.extraAmount, q1.total, (await visitOf(s, vid)).status],
    [1, false, 25000, 'ngoi', 20000, 75000, 've']);
});
await t('tra_chung_nhom: 2 box, mỗi box tính giờ thêm riêng', async () => {
  const s = await fresh('u_a', 480);
  const k = await s.createBooking({ name: 'Nhóm', phone: '0911222333', date: D, startMin: 510, durMin: 180, people: 5, boxIds: ['b1', 'b2'], channel: 'tiktok', note: '' });
  clock.set(atMs(D, 510)); for (const v of k.visits) await s.checkIn(v.id);
  const [o1, o2] = [await phieu(s, k.visits[0].id), await phieu(s, k.visits[1].id)];
  await goi(s, o1.id, ['m_coca']);
  clock.set(atMs(D, 510 + 200));
  const q = await s.quote([o1.id, o2.id]);
  await s.pay([o1.id, o2.id], { transfer: q.total, cashGiven: 0 });
  eq([q.orders.map((x) => x.priced.extraAmount), q.total, (await visitOf(s, k.visits[0].id)).status, (await visitOf(s, k.visits[1].id)).status], [[20000, 20000], 60000, 've', 've']);
});
await t('doi_box_phieu_theo_luot', async () => {
  const s = await fresh(); const vid = await vao(s); const o = await phieu(s, vid);
  await goi(s, o.id, ['m_coca']); await s.moveBox(vid, 'b8');
  eq([(await phieu(s, vid)).id === o.id, (await s.quote([o.id])).boxNames], [true, ['Box 8']]);
});
await t('quen_ve_hom_sau: giờ ra = giờ đóng cửa hôm trước', async () => {
  const s = await fresh('u_a', 1200); const vid = await vao(s); const o = await phieu(s, vid);
  clock.set(atMs('2026-11-20', 540));
  const q = await s.quote([o.id], atMs(D, 1380));
  await s.pay([o.id], { transfer: 0, cashGiven: 0, outAt: atMs(D, 1380), auth: { pin: '1111', reason: 'quên bấm' } });
  const v = await visitOf(s, vid);
  eq([q.orders[0].priced.extraAmount, v.minutes, v.extra], [0, 180, 0]);
});
await t('huy_hoa_don_hoan_kho', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  clock.set(atMs('2026-11-20', 600));
  const c = await code(() => s.voidOrder(o.id, {}));
  const x = await s.voidOrder(o.id, { pin: '2222', reason: 'thu nhầm' });
  await as(s, 'u_chu');
  const mv = await s.movesList(D, '2026-11-20');
  eq([c, x.status, x.voidedBy, mv.filter((m) => m.kind === 'hoan').map((m) => [m.name, m.qty])], ['QUYEN', 'huy', 'Quản lý (thử)', [['Coca', 1]]]);
  eq(await msg(() => s.voidOrder(o.id, { reason: 'lại' })), 'Chỉ huỷ được hoá đơn đã thu');
});
await t('voucher_dung_mot_lan', async () => {
  const s = await fresh('u_chu');
  await s.saveVoucher({ code: 'ONE', active: true, kind: 'amt', value: 5000, maxUses: 1, minTotal: 0 });
  const a = await phieu(s, await vao(s, 'b1')); await goi(s, a.id, ['m_trdao']);
  const setA = await s.setVoucher(a.id, 'one');
  const qa = await s.quote([a.id]);
  await s.pay([a.id], { transfer: qa.total, cashGiven: 0 });
  const b = await phieu(s, await vao(s, 'b2')); await goi(s, b.id, ['m_trdao']);
  eq([setA.voucherCode, qa.total, await msg(() => s.setVoucher(b.id, 'ONE')), await msg(() => s.setVoucher(b.id, 'KHONGCO'))], ['ONE', 30000, 'Mã đã dùng hết lượt', 'Mã không đúng hoặc đã tắt']);
});
await t('giảm tay: nhân viên cần PIN, ghi người duyệt', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_trdao']);
  const c = await code(() => s.setManualDiscount(o.id, { kind: 'amt', value: 5000, reason: 'khách quen' }));
  const x = await s.setManualDiscount(o.id, { kind: 'amt', value: 5000, pin: '1111', reason: 'khách quen' });
  eq([c, x.manual.approvedBy, (await s.quote([o.id])).total], ['QUYEN', 'Chủ (thử)', 30000]);
});
await t('quote cảnh báo món tối thiểu', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s, 'b3', 3)); await goi(s, o.id, ['m_trdao']);
  eq((await s.quote([o.id])).minWarn, 'Box 3: 3 người mới gọi 1 món');
});
await t('nhac_chua_goi: snapshot có orderStats', async () => {
  const s = await fresh(); const vid = await vao(s);
  eq((await s.snapshot(D)).orderStats[vid], { total: 0, have: 0, need: 2, firstAt: null });
});
await t('in lại hoá đơn', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  const r = await s.receiptOf(o.id);
  eq([r.reprint, r.priced.total, r.boxNames], [true, 20000, ['Box 1']]);
});

// ===== Bước 5: kho =====
await t('kho: nhập → bán → kiểm kê mù, QL xem chênh lệch', async () => {
  const s = await fresh();
  await s.receiveStock({ items: [{ stockItemId: 'k_coca', qty: 24 }], note: 'hàng về' });
  const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca', 2]);
  await s.pay([o.id], { transfer: 40000, cashGiven: 0 });
  clock.advance(1);
  const nvXem = await code(() => s.stockOverview());
  const r = await s.saveCount({ items: [{ stockItemId: 'k_coca', counted: 21 }], note: '' });
  await as(s, 'u_ql');
  const ov = (await s.stockOverview()).find((x) => x.item.id === 'k_coca');
  const c = (await s.countsList(D, D))[0];
  eq([nvXem, 'expected' in r, 'diff' in r, c.items[0].expected, c.items[0].counted, c.items[0].diff, ov.expected], ['QUYEN', false, false, 22, 21, -1, 21]);
});
await t('kho: nhập số lượng 0 → lỗi; hàng không có', async () => {
  const s = await fresh();
  eq([await msg(() => s.receiveStock({ items: [{ stockItemId: 'k_coca', qty: 0 }] })), await msg(() => s.receiveStock({ items: [{ stockItemId: 'k_xx', qty: 1 }] }))], ['Số lượng phải lớn hơn 0', 'Không tìm thấy hàng']);
});
await t('kho: nhân viên xem danh sách hàng nhưng không có số lượng; không sửa hàng', async () => {
  const s = await fresh();
  const l = await s.listStock();
  eq([l.length >= 4, l.some((x) => 'expected' in x || 'qty' in x), await code(() => s.saveStockItem({ name: 'Đá', unit: 'bao' }))], [true, false, 'QUYEN']);
});
await t('kho: QL thêm hàng; thiếu tên → lỗi', async () => {
  const s = await fresh('u_ql');
  const l = await s.saveStockItem({ name: 'Đá viên', unit: 'bao', menuItemId: null });
  eq([l.some((x) => x.name === 'Đá viên'), await msg(() => s.saveStockItem({ name: ' ', unit: 'bao' }))], [true, 'Nhập tên hàng']);
});
await t('kho: kiểm kê không có dòng nào → lỗi', async () => { const s = await fresh(); eq(await msg(() => s.saveCount({ items: [] })), 'Nhập số đếm ít nhất 1 hàng'); });

// ===== Bước 6: lấy phiếu / duyệt theo ngày =====
await t('ordersRange: QL/Chủ xem; phiếu huỷ hôm sau vẫn lấy theo ngày huỷ', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  const nv = await code(() => s.ordersRange(D, D));
  clock.set(atMs('2026-11-20', 600)); await as(s, 'u_ql'); await s.voidOrder(o.id, { reason: 'nhầm' });
  eq([nv, (await s.ordersRange(D, D)).length, (await s.ordersRange('2026-11-20', '2026-11-20')).length, (await s.ordersRange('2026-11-21', '2026-11-21')).length], ['QUYEN', 1, 1, 0]);
  eq((await s.approvalsRange('2026-11-20', '2026-11-20')).map((a) => [a.kind, a.approvedBy, a.reason]), [['huy_hoa_don', 'Quản lý (thử)', 'nhầm']]);
});

// ===== Bước 8: đổi số lượng dòng chưa gửi =====
await t('bumpLine: dòng chưa gửi cộng được, đã gửi thì không', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']);
  const a = await s.bumpLine(o.id, r.lines[0].id, 2);
  await s.sendToBar(o.id);
  eq([a.lines[0].qty, await msg(() => s.bumpLine(o.id, r.lines[0].id, 1))], [3, 'Món đã gửi pha chế — huỷ món thay vì sửa']);
});

// ===== Sửa sau duyệt cuối =====
await t('I3: trả chung + voucher số tiền → trừ 1 lần cho cả hoá đơn, voucher +1 lượt', async () => {
  const s = await fresh('u_chu', 480);
  await s.saveVoucher({ code: 'GIAM20', active: true, kind: 'amt', value: 20000, maxUses: 0, minTotal: 0 });
  const k = await s.createBooking({ name: 'Nhóm', phone: '0911222444', date: D, startMin: 510, durMin: 180, people: 4, boxIds: ['b1', 'b2'], channel: 'tiktok', note: '' });
  clock.set(atMs(D, 510)); for (const v of k.visits) await s.checkIn(v.id);
  const [o1, o2] = [await phieu(s, k.visits[0].id), await phieu(s, k.visits[1].id)];
  await goi(s, o1.id, ['m_trdao', 2]); await goi(s, o2.id, ['m_cfs', 1]);
  await s.setVoucher(o1.id, 'GIAM20');
  clock.set(atMs(D, 510 + 60));
  const q = await s.quote([o1.id, o2.id]);
  const r = await s.pay([o1.id, o2.id], { transfer: q.total, cashGiven: 0 });
  eq([q.total, q.orders.map((x) => x.priced.promo && x.priced.promo.amount), r.receipt.priced.promos.map((p) => p.source), (await s.listVouchers()).find((v) => v.code === 'GIAM20').used],
    [99000 - 20000, [14142, 5858], ['voucher', 'voucher'], 1]);
});
await t('I4: bấm thêm món đã có (chưa gửi) → gộp vào dòng; bumpLine cộng/trừ, về 0 thì xoá', async () => {
  const s = await fresh(); const vid = await vao(s); const o = await phieu(s, vid);
  await Promise.all([goi(s, o.id, ['m_trdao']), goi(s, o.id, ['m_trdao']), goi(s, o.id, ['m_trdao'])]);
  let x = await phieu(s, vid);
  const lid = x.lines[0].id;
  await Promise.all([s.bumpLine(o.id, lid, 1), s.bumpLine(o.id, lid, 1)]);
  x = await phieu(s, x.visitId);
  const qty5 = x.lines[0].qty;
  await s.bumpLine(o.id, lid, -5);
  eq([x.lines.length, qty5, (await phieu(s, x.visitId)).lines.length], [1, 5, 0]);
});
await t('I4: món đã gửi không gộp — thêm dòng mới; bumpLine dòng đã gửi bị chặn', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s));
  const r = await goi(s, o.id, ['m_trdao']); await s.sendToBar(o.id);
  const x = await goi(s, o.id, ['m_trdao']);
  eq([x.lines.length, await msg(() => s.bumpLine(o.id, r.lines[0].id, 1))], [2, 'Món đã gửi pha chế — huỷ món thay vì sửa']);
});
await t('I2: huỷ & thu lại → phiếu mới chép món, thu được dù lượt đã về, giờ thêm giữ như cũ', async () => {
  const s = await fresh('u_a', 480); const vid = await vao(s); const o = await phieu(s, vid);
  await goi(s, o.id, ['m_trdao'], ['m_coca']);
  clock.set(atMs(D, 480 + 241));
  await s.pay([o.id], { transfer: 0, cashGiven: 100000 });            // 95.000 (55.000 + 2 giờ)
  clock.advance(10);
  const x = await s.voidOrder(o.id, { pin: '2222', reason: 'nhập nhầm tiền mặt', reopen: true });
  const open = (await s.ordersOfVisit(vid)).filter((y) => y.status === 'mo');
  const q = await s.quote([open[0].id]);
  await s.pay([open[0].id], { transfer: q.total, cashGiven: 0 });
  await as(s, 'u_chu');
  const mv = (await s.movesList(D, D)).filter((m) => m.name === 'Coca').map((m) => m.kind);
  eq([x.status, open.length, open[0].lines.map((l) => l.name), q.total, (await visitOf(s, vid)).status, mv], ['huy', 1, ['Trà đào', 'Coca'], 95000, 've', ['ban', 'hoan', 'ban']]);
});
await t('I2: huỷ thường (không thu lại) không tạo phiếu mới', async () => {
  const s = await fresh(); const vid = await vao(s); const o = await phieu(s, vid); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  await s.voidOrder(o.id, { pin: '2222', reason: 'khách không lấy' });
  eq((await s.ordersOfVisit(vid)).filter((y) => y.status === 'mo').length, 0);
});
await t('M5: in lại dùng giá ngồi thêm lúc thu, không phải giá mới', async () => {
  const s = await fresh('u_chu', 480); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  clock.set(atMs(D, 480 + 241)); await s.pay([o.id], { transfer: 60000, cashGiven: 0 });
  await s.saveSettings({ extraPrice: 25000 });
  const r = await s.receiptOf(o.id);
  eq([r.priced.extraPrice, r.priced.extraAmount], [20000, 40000]);
});
await t('C1: billsOfDay — mọi vai trò xem hoá đơn trong ngày (cả hoá đơn đã huỷ)', async () => {
  const s = await fresh(); const o = await phieu(s, await vao(s)); await goi(s, o.id, ['m_coca']);
  await s.pay([o.id], { transfer: 20000, cashGiven: 0 });
  const o2 = await phieu(s, await vao(s, 'b2')); await goi(s, o2.id, ['m_hd']);
  await s.pay([o2.id], { transfer: 0, cashGiven: 50000 });
  await s.voidOrder(o2.id, { pin: '1111', reason: 'thử' });
  const b = await s.billsOfDay(D);
  eq(b.map((x) => [x.boxNames.join(), x.total, x.status, x.payments.map((p) => p.method).join()]), [['Box 2', 25000, 'huy', 'tien_mat'], ['Box 1', 20000, 'da_thu', 'chuyen_khoan']]);
  eq([b[0].voidedBy, b[0].voidReason, b[1].paidBy], ['Chủ (thử)', 'thử', 'Nhân viên A (thử)']);
});

done();
