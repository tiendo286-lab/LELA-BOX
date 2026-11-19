// Phần BÁN HÀNG + KHO của bản chạy thử (gắn vào createLocalStore). Cùng tên hàm với store/supabase.js.
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
// Bản chạy thử: "băm" PIN cho khỏi lưu số trần (máy chủ thật dùng bcrypt)
const hashPin = (p) => { let h = 7; for (const ch of 'lela:' + p) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'h' + h.toString(36); };
const PIN_MAX_FAIL = 5, PIN_LOCK_MIN = 5;

export const SALES_DEFAULTS = { extraPrice: 20000, minPerPerson: 1, shopName: 'Lela Box', billFooter: 'Cảm ơn quý khách!', paper: '80', noOrderMin: 10 };

// Bổ sung các mảng bán hàng cho dữ liệu cũ (đã lưu trước khi có phần bán hàng)
export function ensureSales(st) {
  for (const k of ['menu', 'promotions', 'vouchers', 'orders', 'stockItems', 'stockMoves', 'stockCounts', 'approvals']) st[k] ||= [];
  st.pins ||= {};
  st.pinGuard ||= { fails: 0, lockUntil: 0 };
  st.settings = { ...SALES_DEFAULTS, ...st.settings };
}

export function addSalesSample(st) {
  if (st.menu.length) return;
  const m = (id, name, group, price, sort, x = {}) => ({ id, name, group, price, kind: 'mon', active: true, sort, ...x });
  st.menu.push(
    m('m_cfs', 'Cà phê sữa', 'Cà phê', 29000, 1), m('m_bx', 'Bạc xỉu', 'Cà phê', 32000, 2),
    m('m_trdao', 'Trà đào', 'Trà', 35000, 3), m('m_trvai', 'Trà vải', 'Trà', 35000, 4),
    m('m_coca', 'Coca', 'Nước chai', 20000, 5), m('m_suoi', 'Nước suối', 'Nước chai', 12000, 6),
    m('m_hd', 'Hướng dương', 'Snack', 25000, 7),
    m('m_combo3', 'Combo 3 người', 'Combo', 150000, 8, { kind: 'combo', serves: 3, slots: [
      { label: '3 đồ uống', count: 3, groups: ['Trà', 'Cà phê'] }, { label: '1 snack', count: 1, groups: ['Snack'] }] }),
  );
  st.promotions.push({ id: 'p_giovang', name: 'Giờ vàng 14–17h −20% Trà', active: true, kind: 'pct', value: 20, scope: ['Trà'], days: [1, 2, 3, 4, 5], fromMin: 840, toMin: 1020, fromDate: '', toDate: '' });
  st.vouchers.push({ code: 'LELA10', active: true, kind: 'pct', value: 10, maxUses: 0, used: 0, minTotal: 0, fromDate: '', toDate: '' });
  st.stockItems.push(
    { id: 'k_coca', name: 'Coca', unit: 'lon', menuItemId: 'm_coca', active: true },
    { id: 'k_suoi', name: 'Nước suối', unit: 'chai', menuItemId: 'm_suoi', active: true },
    { id: 'k_sua', name: 'Sữa đặc', unit: 'hộp', menuItemId: null, active: true },
    { id: 'k_tra', name: 'Trà đen', unit: 'gói', menuItemId: null, active: true },
  );
  // PIN mẫu cho bản chạy thử: Chủ 1111, Quản lý 2222
  if (st.staff.some((u) => u.id === 'u_chu')) st.pins.u_chu = hashPin('1111');
  if (st.staff.some((u) => u.id === 'u_ql')) st.pins.u_ql = hashPin('2222');
}

export function addSales(api, h) {
  const { save, id, needMe, err, copy } = h;
  const S = () => h.st();
  const needRole = (...roles) => { const u = needMe(); if (!roles.includes(u.role)) err('QUYEN', roles.length === 1 ? 'Chỉ Chủ được làm việc này' : 'Chỉ Quản lý / Chủ được làm việc này'); return u; };
  const str = (x) => String(x ?? '').trim();
  const int = (x) => Math.round(Number(x) || 0);

  // Duyệt việc cần quyền quản lý: QL/Chủ tự làm → chỉ cần lý do; nhân viên → PIN của một QL/Chủ.
  function approve(auth, kind, extra = {}) {
    const st = S(), u = needMe(), a = auth || {};
    const reason = str(a.reason);
    let approver = null;
    if (u.role === 'chu' || u.role === 'ql') approver = u;
    else {
      const now = h.clock.now();
      if (st.pinGuard.lockUntil > now) err('QUYEN', `Sai PIN quá ${PIN_MAX_FAIL} lần — chờ ${PIN_LOCK_MIN} phút`);
      const hp = a.pin ? hashPin(String(a.pin)) : null;
      approver = hp && st.staff.find((x) => (x.role === 'chu' || x.role === 'ql') && st.pins[x.id] === hp);
      if (!approver) {
        if (a.pin) { st.pinGuard.fails += 1; if (st.pinGuard.fails >= PIN_MAX_FAIL) { st.pinGuard.lockUntil = now + PIN_LOCK_MIN * 60000; st.pinGuard.fails = 0; } save(); }
        err('QUYEN', a.pin ? 'PIN không đúng' : 'Cần quản lý nhập PIN');
      }
      st.pinGuard.fails = 0;
    }
    if (!reason) err('LOI', 'Ghi lý do');
    st.approvals.push({ id: id(), at: h.clock.now(), kind, reason, askedBy: u.name, approvedBy: approver.name, ...extra });
    return approver.name;
  }
  h.approve = approve;

  Object.assign(api, {
    async setPin(pin) {
      const u = needRole('chu', 'ql');
      if (!/^\d{4,6}$/.test(String(pin || ''))) err('LOI', 'PIN gồm 4–6 chữ số');
      S().pins[u.id] = hashPin(String(pin)); save(); return true;
    },

    async listMenu({ all = false } = {}) { return copy(S().menu.filter((m) => all || m.active).sort((a, b) => a.sort - b.sort)); },
    async saveMenuItem(item) {
      needRole('chu');
      const st = S();
      const name = str(item.name), price = int(item.price), kind = item.kind === 'combo' ? 'combo' : 'mon';
      if (!name) err('LOI', 'Nhập tên món');
      if (price <= 0) err('LOI', 'Giá phải lớn hơn 0');
      const slots = (item.slots || []).map((x) => ({ label: str(x.label) || 'Chọn món', count: Math.max(1, int(x.count)), groups: (x.groups || []).filter(Boolean) })).filter((x) => x.groups.length);
      if (kind === 'combo' && !slots.length) err('LOI', 'Combo cần ít nhất 1 ô chọn món');
      const v = { name, group: str(item.group) || 'Khác', price, kind, active: item.active !== false, ...(kind === 'combo' ? { serves: Math.max(1, int(item.serves) || 1), slots } : {}) };
      const cur = item.id && st.menu.find((m) => m.id === item.id);
      if (cur) { delete cur.serves; delete cur.slots; Object.assign(cur, v); }
      else st.menu.push({ id: id(), sort: Math.max(0, ...st.menu.map((m) => m.sort)) + 1, ...v });
      save(); return api.listMenu({ all: true });
    },
    async importMenu(items) {
      needRole('chu');
      const st = S(); let added = 0, updated = 0;
      for (const it of items || []) {
        const name = str(it.name), price = int(it.price);
        if (!name || price <= 0) continue;
        const cur = st.menu.find((m) => fold(m.name) === fold(name));
        if (cur) { cur.price = price; if (str(it.group)) cur.group = str(it.group); updated++; }
        else { st.menu.push({ id: id(), name, group: str(it.group) || 'Khác', price, kind: 'mon', active: true, sort: Math.max(0, ...st.menu.map((m) => m.sort)) + 1 }); added++; }
      }
      save(); return { added, updated };
    },

    async listPromotions() { return copy(S().promotions); },
    async savePromotion(p) {
      needRole('chu');
      const st = S();
      if (!str(p.name)) err('LOI', 'Nhập tên khuyến mãi');
      if (!['pct', 'amt'].includes(p.kind) || int(p.value) <= 0 || (p.kind === 'pct' && int(p.value) > 100)) err('LOI', 'Mức giảm chưa đúng');
      const v = { name: str(p.name), active: p.active !== false, kind: p.kind, value: int(p.value), scope: Array.isArray(p.scope) && p.scope.length ? p.scope : 'all',
        days: (p.days || []).map(Number).filter((d) => d >= 1 && d <= 7), fromMin: int(p.fromMin ?? 0), toMin: int(p.toMin ?? 1440), fromDate: str(p.fromDate), toDate: str(p.toDate) };
      if (v.toMin <= v.fromMin) err('LOI', 'Giờ kết thúc phải sau giờ bắt đầu');
      const cur = p.id && st.promotions.find((x) => x.id === p.id);
      if (cur) Object.assign(cur, v); else st.promotions.push({ id: id(), ...v });
      save(); return copy(st.promotions);
    },
    async listVouchers() { return copy(S().vouchers); },
    async saveVoucher(v) {
      needRole('chu');
      const st = S();
      const code = str(v.code).toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) err('LOI', 'Mã gồm 3–20 chữ / số, không dấu');
      if (!['pct', 'amt'].includes(v.kind) || int(v.value) <= 0 || (v.kind === 'pct' && int(v.value) > 100)) err('LOI', 'Mức giảm chưa đúng');
      const cur = st.vouchers.find((x) => x.code === code);
      if (cur && !v.editing) err('LOI', 'Mã này đã có');
      const n = { code, active: v.active !== false, kind: v.kind, value: int(v.value), maxUses: Math.max(0, int(v.maxUses)), minTotal: Math.max(0, int(v.minTotal)), fromDate: str(v.fromDate), toDate: str(v.toDate) };
      if (cur) Object.assign(cur, n); else st.vouchers.push({ ...n, used: 0 });
      save(); return copy(st.vouchers);
    },
  });
}
