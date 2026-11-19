// Phần BÁN HÀNG + KHO của bản chạy thử (gắn vào createLocalStore). Cùng tên hàm với store/supabase.js.
import { priceOrder, settle, minOrder, voucherError } from '../money.js';
import { deductions } from '../stock.js';
import { extraHours } from '../rules.js';
import { fromMs } from '../time.js';
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

const goodsOf = (o) => o.lines.filter((l) => !l.voided).reduce((n, l) => n + l.price * l.qty, 0);

// Số liệu phiếu của các lượt đang ngồi (cho ô box + nhắc "chưa gọi món")
export function orderStatsOf(st) {
  const out = {};
  for (const v of st.visits.filter((x) => x.status === 'ngoi')) {
    const os = (st.orders || []).filter((o) => o.visitId === v.id && o.status !== 'huy');
    const lines = os.flatMap((o) => o.lines);
    const m = minOrder(lines, v.people, st.settings.minPerPerson ?? 1);
    const first = lines.length ? Math.min(...lines.map((l) => l.at)) : null;
    out[v.id] = { total: os.filter((o) => o.status === 'mo').reduce((n, o) => n + goodsOf(o), 0), have: m.have, need: m.need, firstAt: first };
  }
  return out;
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

  const nowMs = () => h.clock.now();
  const boxName = (boxId) => (S().boxes.find((b) => b.id === boxId) || { name: boxId }).name;
  const order = (oid) => S().orders.find((o) => o.id === oid) || err('LOI', 'Không tìm thấy phiếu');
  const openOrder = (oid) => { const o = order(oid); if (o.status !== 'mo') err('LOI', o.status === 'da_thu' ? 'Phiếu đã thu' : 'Phiếu đã đóng'); return o; };
  function newOrder(v, splitFrom = null) {
    const o = { id: id(), visitId: v.id, boxId: v.boxId, status: 'mo', lines: [], voucherCode: null, manual: null, extraHours: 0, extraPrice: 0, priced: null,
      payments: [], change: 0, paidWith: null, openedBy: needMe().name, openedAt: nowMs(), paidBy: null, paidAt: null, voidedBy: null, voidedAt: null, voidReason: '', splitFrom };
    S().orders.push(o); return o;
  }
  const voucherByCode = (code) => (code ? S().vouchers.find((x) => x.code === String(code).toUpperCase()) : null);

  // Ghép món vào các ô combo: mỗi ô lấy đủ `count` món thuộc nhóm của ô
  function fitCombo(m, picks) {
    const left = [...(picks || [])].map((p) => S().menu.find((x) => x.id === p.menuItemId)).filter(Boolean);
    if (left.length !== (picks || []).length) return null;
    const total = m.slots.reduce((n, x) => n + x.count, 0);
    if (left.length !== total) return null;
    const out = [];
    for (const slot of m.slots) {
      for (let i = 0; i < slot.count; i++) {
        const k = left.findIndex((x) => x.kind !== 'combo' && slot.groups.includes(x.group));
        if (k < 0) return null;
        out.push({ menuItemId: left[k].id, name: left[k].name }); left.splice(k, 1);
      }
    }
    return out;
  }

  // Tính tiền các phiếu sẽ thu cùng lúc. Lượt nào thu hết phiếu mở thì phiếu cuối mang giờ ngồi thêm.
  function quoteSync(orderIds, outAt) {
    const st = S();
    if (!orderIds || !orderIds.length) err('LOI', 'Chọn phiếu để thu');
    const os = [...new Set(orderIds)].map(openOrder);
    const now = nowMs();
    const visits = [...new Set(os.map((o) => o.visitId))].map((vid) => h.visit(vid));
    // Không ghi giờ ra → lúc này (không sớm hơn giờ vào muộn nhất của các lượt)
    const out = outAt == null ? Math.max(now, ...visits.map((v) => v.inAt || 0)) : Number(outAt);
    for (const v of visits) {
      if (v.status === 'ngoi') {
        if (outAt != null && !(out > v.inAt)) err('LOI', 'Giờ ra phải sau giờ vào');
        if (out > now + 60000) err('LOI', 'Giờ ra chưa tới');
      }
    }
    const lastOf = new Map();
    for (const v of visits) {
      const openIds = st.orders.filter((o) => o.visitId === v.id && o.status === 'mo').map((o) => o.id);
      const mine = os.filter((o) => o.visitId === v.id);
      if (openIds.every((x) => mine.some((o) => o.id === x))) lastOf.set(v.id, mine[mine.length - 1].id);
    }
    const rows = os.map((o) => {
      const v = visits.find((x) => x.id === o.visitId);
      const isLast = lastOf.get(v.id) === o.id;
      const minutes = v.status === 'ngoi' ? Math.floor((out - v.inAt) / 60000) : v.minutes || 0;
      const eh = isLast ? (v.status === 'ngoi' ? extraHours(minutes, st.settings) : v.extra || 0) : 0;
      const priced = priceOrder({ ...o, extraHours: eh, extraPrice: st.settings.extraPrice }, { promotions: st.promotions, voucher: voucherByCode(o.voucherCode), at: out });
      return { order: o, priced, isLast, extraHours: eh, minutes };
    });
    const warns = [];
    for (const v of visits) {
      const lines = st.orders.filter((o) => o.visitId === v.id && o.status !== 'huy').flatMap((o) => o.lines);
      const m = minOrder(lines, v.people, st.settings.minPerPerson);
      if (!m.ok) warns.push(`${boxName(v.boxId)}: ${v.people} người mới gọi ${m.have} món`);
    }
    return { rows, visits, out, total: rows.reduce((n, r) => n + r.priced.total, 0), boxNames: [...new Set(visits.map((v) => boxName(v.boxId)))], minWarn: warns.join('; ') || null };
  }

  function receiptFor(os, reprint) {
    const st = S();
    const visits = [...new Set(os.map((o) => o.visitId))].map((vid) => st.visits.find((v) => v.id === vid)).filter(Boolean);
    const root = os.find((o) => !o.paidWith) || os[0];
    const sum = (k) => os.reduce((n, o) => n + ((o.priced && o.priced[k]) || 0), 0);
    return copy({
      shopName: st.settings.shopName, footer: st.settings.billFooter, boxNames: [...new Set(visits.map((v) => boxName(v.boxId)))],
      inAt: Math.min(...visits.map((v) => v.inAt || Infinity)), outAt: root.paidAt && visits.every((v) => v.outAt) ? Math.max(...visits.map((v) => v.outAt)) : null,
      minutes: visits.length === 1 ? visits[0].minutes ?? null : null,
      lines: os.flatMap((o) => o.lines.filter((l) => !l.voided)),
      priced: { goods: sum('goods'), extraAmount: sum('extraAmount'), extraHours: os.reduce((n, o) => n + (o.extraHours || 0), 0), extraPrice: st.settings.extraPrice,
        promos: os.map((o) => o.priced && o.priced.promo).filter(Boolean), manualAmount: sum('manualAmount'), total: sum('total') },
      payments: root.payments, change: root.change, paidBy: root.paidBy, at: root.paidAt, reprint, voided: root.status === 'huy',
    });
  }
  const groupOf = (o) => { const r = o.paidWith || o.id; return S().orders.filter((x) => x.id === r || x.paidWith === r); };
  const pushMove = (m) => S().stockMoves.push({ id: id(), at: nowMs(), by: needMe().name, note: '', ...m });

  Object.assign(api, {
    async ordersOfVisit(visitId) {
      needMe();
      const v = h.visit(visitId);
      if (v.status === 'ngoi' && !S().orders.some((o) => o.visitId === v.id && o.status === 'mo')) { newOrder(v); save(); }
      return copy(S().orders.filter((o) => o.visitId === v.id).sort((a, b) => a.openedAt - b.openedAt || (a.id < b.id ? -1 : 1)));
    },
    async addLines(orderId, items) {
      needMe();
      const o = openOrder(orderId), st = S();
      const add = (items || []).map((it) => {
        const m = st.menu.find((x) => x.id === it.menuItemId && x.active) || err('LOI', 'Món không còn bán');
        const qty = int(it.qty);
        if (qty < 1) err('LOI', 'Số lượng phải từ 1');
        let picks = [];
        if (m.kind === 'combo') { picks = fitCombo(m, it.picks) || err('LOI', 'Chọn đủ món cho combo'); }
        return { id: id(), menuItemId: m.id, kind: m.kind, group: m.group, name: m.name, price: m.price, qty, note: str(it.note), picks,
          ...(m.kind === 'combo' ? { serves: m.serves } : {}), sentAt: null, voided: null, addedBy: needMe().name, at: nowMs() };
      });
      o.lines.push(...add); save(); return copy(o);
    },
    async removeLine(orderId, lineId, auth = null) {
      needMe();
      const o = openOrder(orderId);
      const l = o.lines.find((x) => x.id === lineId) || err('LOI', 'Không tìm thấy món');
      if (l.voided) err('LOI', 'Món này đã huỷ');
      if (!l.sentAt) o.lines = o.lines.filter((x) => x.id !== lineId);
      else {
        const by = approve(auth, 'huy_mon', { orderId, amount: l.price * l.qty, item: l.name });
        l.voided = { by, reason: str(auth && auth.reason), at: nowMs() };
      }
      save(); return copy(o);
    },
    async sendToBar(orderId) {
      needMe();
      const o = openOrder(orderId);
      const fresh = o.lines.filter((l) => !l.sentAt && !l.voided);
      if (!fresh.length) err('LOI', 'Không có món mới để gửi');
      const again = o.lines.some((l) => l.sentAt);
      const at = nowMs();
      fresh.forEach((l) => { l.sentAt = at; });
      save();
      return copy({ order: o, ticket: { boxName: boxName(h.visit(o.visitId).boxId), at, again, by: needMe().name,
        lines: fresh.map((l) => ({ name: l.name, qty: l.qty, note: l.note, picks: l.picks.map((p) => p.name) })) } });
    },
    async splitOrder(orderId, lineIds) {
      needMe();
      const o = openOrder(orderId);
      const move = o.lines.filter((l) => (lineIds || []).includes(l.id));
      if (!move.length) err('LOI', 'Chọn món để tách');
      const n = newOrder(h.visit(o.visitId), o.id);
      o.lines = o.lines.filter((l) => !move.includes(l));
      n.lines = move; save(); return copy(n);
    },
    async setVoucher(orderId, code) {
      needMe();
      const o = openOrder(orderId);
      if (!code) { o.voucherCode = null; save(); return copy(o); }
      const v = voucherByCode(code);
      const e = voucherError(v, goodsOf(o), nowMs());
      if (e) err('LOI', e);
      o.voucherCode = v.code; save(); return copy(o);
    },
    async setManualDiscount(orderId, x) {
      needMe();
      const o = openOrder(orderId);
      if (!x) { o.manual = null; save(); return copy(o); }
      const value = int(x.value);
      if (!['pct', 'amt'].includes(x.kind) || value <= 0 || (x.kind === 'pct' && value > 100)) err('LOI', 'Mức giảm chưa đúng');
      const by = approve(x, 'giam_tay', { orderId, amount: x.kind === 'amt' ? value : null, pct: x.kind === 'pct' ? value : null });
      o.manual = { kind: x.kind, value, approvedBy: by, reason: str(x.reason) };
      save(); return copy(o);
    },
    async quote(orderIds, outAt = null) {
      needMe();
      const q = quoteSync(orderIds, outAt);
      return copy({ orders: q.rows.map((r) => ({ order: r.order, priced: r.priced, isLast: r.isLast, extraHours: r.extraHours, minutes: r.minutes })),
        total: q.total, minWarn: q.minWarn, outAt: q.out, boxNames: q.boxNames });
    },
    async pay(orderIds, { transfer = 0, cashGiven = 0, outAt = null, auth = null } = {}) {
      const u = needMe(), st = S();
      const q = quoteSync(orderIds, outAt);
      const r = settle(q.total, { transfer, cashGiven });
      if (r.error) err('LOI', r.error);
      if (q.total === 0) approve(auth, 'thu_0d', { orderId: q.rows[0].order.id, amount: 0 });
      const at = nowMs(), root = q.rows[0].order;
      for (const row of q.rows) {
        const o = row.order;
        Object.assign(o, { status: 'da_thu', priced: row.priced, extraHours: row.extraHours, extraPrice: st.settings.extraPrice, paidBy: u.name, paidAt: at,
          payments: o === root ? r.payments : [], change: o === root ? r.change : 0, paidWith: o === root ? null : root.id });
        if (row.priced.promo && row.priced.promo.source === 'voucher') { const v = voucherByCode(o.voucherCode); if (v) v.used = (v.used || 0) + 1; }
        for (const d of deductions(o.lines, st.stockItems)) pushMove({ stockItemId: d.stockItemId, kind: 'ban', qty: d.qty, orderId: o.id });
      }
      for (const v of q.visits) {
        if (v.status === 'ngoi' && !st.orders.some((o) => o.visitId === v.id && o.status === 'mo')) h.checkOutVisit(v, outAt == null ? null : q.out);
      }
      save();
      return { receipt: receiptFor(q.rows.map((x) => x.order), false) };
    },
    async voidOrder(orderId, auth = null) {
      needMe();
      const o = order(orderId);
      if (o.status !== 'da_thu') err('LOI', 'Chỉ huỷ được hoá đơn đã thu');
      const grp = groupOf(o);
      const by = approve(auth, 'huy_hoa_don', { orderId, amount: grp.reduce((n, x) => n + x.priced.total, 0) });
      const at = nowMs();
      for (const x of grp) {
        Object.assign(x, { status: 'huy', voidedBy: by, voidedAt: at, voidReason: str(auth && auth.reason) });
        S().stockMoves.filter((m) => m.orderId === x.id && m.kind === 'ban').forEach((m) => pushMove({ stockItemId: m.stockItemId, kind: 'hoan', qty: m.qty, orderId: x.id }));
      }
      save(); return copy(o);
    },
    async receiptOf(orderId) {
      needMe();
      const o = order(orderId);
      if (o.status === 'mo') err('LOI', 'Phiếu chưa thu');
      return receiptFor(groupOf(o), true);
    },
    async movesList(from, to) {
      needRole('chu', 'ql');
      const st = S();
      return copy(st.stockMoves.filter((m) => { const d = fromMs(m.at).date; return d >= from && d <= to; })
        .map((m) => ({ at: m.at, kind: m.kind, name: (st.stockItems.find((k) => k.id === m.stockItemId) || { name: '?' }).name, qty: m.qty, by: m.by, note: m.note })));
    },

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
