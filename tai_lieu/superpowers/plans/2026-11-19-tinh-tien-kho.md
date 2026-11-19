# Tính tiền + Kho (thay KiotViet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bán hàng theo box (gọi món, phiếu pha chế, thanh toán có giờ ngồi thêm / khuyến mãi / chia tiền / tách bill, PIN quản lý), kho (nhập, tự trừ hàng bán nguyên, kiểm kê mù) và báo cáo tiền vào web Lela Box để thay KiotViet.

**Architecture:** Quy tắc tiền và kho là hàm thuần (`money.js`, `stock.js`, `menu_import.js`) kiểm bằng jsc. Lớp lưu chạy thử thêm phần bán hàng trong tệp riêng `store/local_ban.js` gắn vào `createLocalStore`; `store/supabase.js` có hàm cùng tên gọi `app_*` mới trong `supabase/02_tinh_tien_kho.sql`. Giao diện thêm màn gọi món, thanh toán, hộp PIN, in qua khung ẩn, tab Kho, mục Cài đặt và Báo cáo mới.

**Tech Stack:** JavaScript thuần (ES modules, `html\`\`` tự thoát), Supabase (Postgres, RLS, hàm SECURITY DEFINER, pgcrypto), jsc + Chrome ẩn để thử, SheetJS 0.18.5 từ cdnjs để đọc Excel.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-tinh-tien-kho-design.md`

## Global Constraints

- Tiền là số nguyên đồng; giảm % làm tròn **xuống** tới đồng; không làm tròn nghìn.
- **Chỉ 1 khuyến mãi mỗi hoá đơn** (tự động hoặc voucher, lấy cái giảm nhiều hơn). Combo và tiền ngồi thêm **không** được khuyến mãi / voucher. Giảm tay (cần PIN) áp sau cùng, được giảm cả tiền ngồi thêm.
- Giờ ngồi thêm = `extraHours(minutes, settings)` có sẵn × `settings.extraPrice`; chép số giờ + giá vào phiếu lúc thu.
- Dòng phiếu chép **tên + giá lúc gọi**; đổi menu sau không đổi phiếu cũ.
- Cần PIN QL/Chủ (nhân viên): huỷ dòng **đã gửi pha chế**, giảm tay, thu phiếu 0đ, huỷ hoá đơn đã thu. Xoá dòng **chưa gửi** không cần PIN. QL/Chủ tự làm vẫn phải ghi lý do (không cần gõ PIN của mình — ruling, xem Task 3).
- PIN 4–6 chữ số; sai 5 lần liên tiếp → khoá duyệt PIN 5 phút.
- Món tối thiểu: chỉ **nhắc + cảnh báo**, không chặn. Nhắc "chưa gọi món" sau 10 phút từ lúc vào.
- Nhân viên đếm kiểm kê **không thấy** số đáng lẽ còn / chênh lệch; QL/Chủ thấy.
- Vai trò: `chu`, `ql`, `nv`. Sửa menu / giá / khuyến mãi / voucher / giá ngồi thêm: chỉ `chu`. Báo cáo tiền, xem tồn kho, chênh lệch: `chu` + `ql`.
- Huỷ hoá đơn đã thu: hoàn kho, ghi âm doanh thu **ngày huỷ**.
- Không bán khi mất mạng; không QR; không két tiền; không tích điểm; không chốt ca.
- Tiếng Việt đơn giản trên giao diện; khung 390px không tràn ngang; không chữ "undefined/NaN/null".
- Hàm thuần dùng chung jsc + trình duyệt: không dùng `URLSearchParams`, `Intl` (jsc có thể thiếu), DOM.
- Kho mã có thể công khai: không đưa file Excel menu thật, khoá bí mật, tên nhân viên thật. Dữ liệu mẫu ghi "(thử)".
- Commit `Tien Do <tiendo286@gmail.com>`, cuối thông điệp `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Làm trên nhánh `tinh-tien`.
- Mỗi hàm mới của lớp lưu chạy thử phải có hàm cùng tên ở `store/supabase.js` ngay trong task đó (bài `supabase_test.mjs` so khớp tên).

## Review Focus

1. Bấm "Thu tiền" hai lần / hai máy cùng thu một phiếu → chỉ thu một lần, lần sau báo "Phiếu đã thu" (Task 4 + Task 11).
2. Huỷ hoá đơn hôm trước → doanh thu hôm trước giữ nguyên, hôm huỷ ghi âm; kho hoàn lại đúng số (Task 4, Task 6).
3. Đổi giá món sau khi đã gọi → phiếu đang mở và hoá đơn cũ giữ giá cũ (Task 4).
4. Trả chung nhiều box một phiếu đặt khi một box chưa gọi gì / một box đã tách bill → mỗi lượt về đúng, giờ ngồi thêm tính riêng từng box đúng một lần (Task 4).
5. Khách đổi box giữa chừng hoặc quên bấm về tới hôm sau → phiếu đi theo lượt, giờ ra mặc định giờ đóng cửa ngày vào, tiền ngồi thêm theo giờ ra đó (Task 4, Task 8).

---

### Task 1: Quy tắc tiền (`money.js`)

**Files:**
- Create: `docs/js/money.js`
- Test: `kiem_tra/money_test.mjs`

**Interfaces:**
- Consumes: `extraHours(minutes, s)` từ `docs/js/rules.js`; `fromMs(ms)` từ `docs/js/time.js`.
- Produces:
  - `fmtMoney(n: number) -> string` — `125000 → "125.000đ"`, `0 → "0đ"`, `-20000 → "-20.000đ"`.
  - `promoActive(p, atMs) -> boolean` — `p = {active, days:[1..7] (T2=1…CN=7), fromMin, toMin, fromDate?, toDate?}`; ngày giờ theo giờ VN.
  - `voucherError(v, goodsTotal, atMs) -> string|null` — `v = {code, active, kind:'pct'|'amt', value, fromDate?, toDate?, maxUses (0 = không giới hạn), used, minTotal}`. Câu lỗi: `"Mã không đúng hoặc đã tắt"`, `"Mã chưa tới ngày dùng"`, `"Mã đã hết hạn"`, `"Mã đã dùng hết lượt"`, `"Hoá đơn tối thiểu 200.000đ"`.
  - `priceOrder(order, opt) -> Priced`:
    - `order = {lines:[{id, kind:'mon'|'combo', group, name, price, qty, voided?}], extraHours?:number, extraPrice?:number, manual?: {kind:'pct'|'amt', value}|null}`
    - `opt = {promotions:[{id,name,kind,value,scope:'all'|string[] (nhóm), ...promoActive fields}], voucher?: v|null, at: ms}`
    - `Priced = {goods, comboTotal, monEligible, extraAmount, promo: {source:'tu_dong'|'voucher', id, name, amount}|null, voucherError: string|null, manualAmount, total}`.
    - Thuật toán: `goods` = Σ dòng chưa huỷ; mỗi khuyến mãi đang chạy → tiền giảm trên các dòng `mon` thuộc phạm vi; voucher hợp lệ → giảm trên mọi dòng `mon`; chọn **một** cái giảm nhiều nhất (bằng nhau thì ưu tiên voucher); `amt` không vượt nền; `extraAmount = extraHours × extraPrice`; `manualAmount` tính trên `goods + extra − promo`; `total = max(0, goods + extra − promo − manual)`.
  - `minOrder(lines, people, minPerPerson) -> {need, have, ok}` — dòng `mon` tính theo `qty`, combo tính `serves × qty`; dòng huỷ không tính.
  - `settle(total, {transfer, cashGiven}) -> {error|null, change, payments:[{method:'tien_mat'|'chuyen_khoan', amount}]}` — tiền mặt phải trả = `total − transfer`; lỗi `"Chuyển khoản lớn hơn số phải trả"`, `"Khách đưa thiếu 20.000đ"`; khoản 0 bị bỏ khỏi `payments`.

- [ ] **Step 1: Viết bài thử** `kiem_tra/money_test.mjs` (dùng `t, eq, done` từ `./t.mjs`), tối thiểu:
  - `fmtMoney(125000) === '125.000đ'`, `fmtMoney(-20000) === '-20.000đ'`.
  - Khuyến mãi T2–T6 14:00–17:00 giảm 20% nhóm "Trà": ngày 2026-11-19 (Thứ 5) 15:00 → đang chạy; 17:00 → không (khoảng `[from, to)`); 2026-11-22 (CN) → không.
  - Phiếu: 2 × Trà đào 35.000 (mon, Trà) + 1 × Combo 3 người 150.000 (combo) + ngồi thêm 2 giờ × 20.000 + khuyến mãi 20% Trà → `goods 220000, promo.amount 14000, extraAmount 40000, total 246000`.
  - Cùng phiếu + voucher 10% (min 0) → khuyến mãi 14.000 vs voucher 7.000 → chọn khuyến mãi `source 'tu_dong'`; voucher `amt` 20.000 → chọn voucher 20.000.
  - Voucher hết lượt (`maxUses 3, used 3`) → `voucherError` = `"Mã đã dùng hết lượt"` và `promo` không phải voucher.
  - Giảm tay 10% trên phiếu trên (không voucher) → `manualAmount = floor((220000+40000−14000)×0.1) = 24600`, `total 221400`.
  - Giảm tay `amt` 999.999 → `total 0` (không âm).
  - Giảm 15% trên 33.333 → 4.999 (làm tròn xuống).
  - Dòng `voided` không tính tiền.
  - `minOrder` 3 người, 1 Trà × 1 + combo serves 3 × 0 → `{need 3, have 1, ok false}`; thêm combo serves 3 × 1 → `ok true`.
  - `settle(246000, {transfer: 100000, cashGiven: 200000})` → `change 54000`, payments 2 dòng; `settle(246000, {transfer: 0, cashGiven: 200000})` → lỗi `"Khách đưa thiếu 46.000đ"`; `settle(100000, {transfer: 150000, cashGiven: 0})` → lỗi chuyển khoản; `settle(0, {transfer:0, cashGiven:0})` → `payments []`, không lỗi.
- [ ] **Step 2: Chạy** `kiem_tra/chay_jsc.sh money_test.mjs` — Expected: lỗi import (chưa có `money.js`).
- [ ] **Step 3: Viết `docs/js/money.js`** theo Interfaces. `fmtMoney` tự chèn dấu chấm (không dùng `toLocaleString`). Thứ trong tuần lấy từ ngày VN: `new Date(Date.UTC(y,m-1,d)).getUTCDay()` → CN=0 đổi thành 7.
- [ ] **Step 4: Chạy** `kiem_tra/chay_jsc.sh money_test.mjs` — Expected: `== N đạt, 0 hỏng`.
- [ ] **Step 5: Commit** `git add docs/js/money.js kiem_tra/money_test.mjs && git commit -m "Tính tiền bước 1: quy tắc tiền (khuyến mãi, voucher, giảm tay, chia tiền)"`

### Task 2: Quy tắc kho + đọc menu Excel (`stock.js`, `menu_import.js`)

**Files:**
- Create: `docs/js/stock.js`, `docs/js/menu_import.js`
- Test: `kiem_tra/stock_test.mjs`

**Interfaces:**
- Produces:
  - `expectedQty(stockItemId, moves, counts) -> number` — `moves = [{stockItemId, kind:'nhap'|'ban'|'hoan'|'dieu_chinh', qty (dương), at}]`, `counts = [{at, items:[{stockItemId, counted}]}]`; lấy lần đếm gần nhất có hàng đó (số đếm làm mốc) rồi cộng `nhap`/`hoan`, trừ `ban` có `at` sau mốc; chưa đếm lần nào → mốc 0 từ đầu. `dieu_chinh` không dùng ở đây (dành cho sau).
  - `deductions(lines, stockItems) -> [{stockItemId, qty}]` — dòng chưa huỷ; dòng `mon` có `menuItemId` trùng `stockItem.menuItemId` → trừ `qty`; dòng `combo` có `picks:[{menuItemId, name}]` → mỗi pick trừ `qty` (mỗi combo); gộp theo `stockItemId`.
  - `parseMenuRows(rows: string[][]) -> {items:[{name, group, price}], error|null}` — tìm dòng tiêu đề trong 10 dòng đầu, so cột đã bỏ dấu + chữ thường: tên ∈ {"ten hang","ten hang hoa","ten mon","ten"}, nhóm ∈ {"nhom hang","nhom hang(3 cap)","nhom"} (bắt đầu bằng "nhom hang" cũng nhận), giá ∈ {"gia ban","gia"}; giá bỏ mọi ký tự không phải số; bỏ dòng tên trống hoặc giá ≤ 0. Không thấy cột tên / giá → `error: "Không thấy cột Tên hàng / Giá bán trong file"`.

- [ ] **Step 1: Viết bài thử** `kiem_tra/stock_test.mjs`:
  - nhập 24 lúc 1, bán 3 lúc 2, đếm 20 lúc 3, bán 2 lúc 4, hoàn 1 lúc 5 → `expectedQty` = 19; không có lần đếm → `24 − 3 − 2 + 1 = 20`.
  - `deductions`: 2 × "Coca" (menuItemId m_coca, có hàng kho k_coca) + 1 combo picks [m_coca, m_tra] (m_tra không có hàng kho) → `[{stockItemId:'k_coca', qty:3}]`; dòng huỷ bỏ qua.
  - `parseMenuRows` với tiêu đề KiotViet `["Loại hàng","Nhóm hàng(3 Cấp)","Mã hàng","Tên hàng","Giá bán","Giá vốn"]` + dòng `["Hàng hóa","Trà","SP01","Trà đào","35,000","10000"]` → `{name:'Trà đào', group:'Trà', price:35000}`; file không có cột giá → `error`.
- [ ] **Step 2: Chạy** `kiem_tra/chay_jsc.sh stock_test.mjs` — Expected: lỗi import.
- [ ] **Step 3: Viết** `docs/js/stock.js`, `docs/js/menu_import.js` theo Interfaces (bỏ dấu bằng `normalize('NFD')` như `norm` ở `ui.js`, viết lại tại chỗ vì `ui.js` có DOM).
- [ ] **Step 4: Chạy** — Expected: `0 hỏng`.
- [ ] **Step 5: Commit** `"Tính tiền bước 2: quy tắc kho + đọc menu Excel KiotViet"`

### Task 3: Lớp lưu chạy thử — vai trò QL, PIN, menu, khuyến mãi, voucher, cài đặt

**Files:**
- Create: `docs/js/store/local_ban.js`
- Modify: `docs/js/store/local.js` (gọi `addSales`, `saveStaff` nhận `ql`, `DEFAULT_SETTINGS` thêm khoá, `DEFAULT_STAFF` thêm QL thử, `baseState` thêm mảng)
- Modify: `docs/js/store/supabase.js` (thêm hàm cùng tên)
- Test: `kiem_tra/ban_test.mjs`

**Interfaces:**
- Consumes: `StoreError`, state `st`, `save`, `id`, `needMe`, `err` trong `local.js`.
- Produces:
  - `local.js` export `addSales(api, h)` được gọi trong `createLocalStore`, `h = {st: () => st, save, id, needMe, err, copy, log}` (st truyền dạng hàm vì `st` có thể thay).
  - `DEFAULT_SETTINGS` thêm: `extraPrice: 20000, minPerPerson: 1, shopName: 'Lela Box', billFooter: 'Cảm ơn quý khách!', paper: '80', noOrderMin: 10`.
  - `DEFAULT_STAFF` thêm `{ id: 'u_ql', name: 'Quản lý (thử)', role: 'ql', email: 'ql@vi-du.local' }`; PIN mẫu: Chủ `1111`, QL `2222` (lưu băm đơn giản trong bản chạy thử).
  - `api.setPin(pin) -> true` — người đang đăng nhập phải là `chu`/`ql`; `/^\d{4,6}$/` sai → LOI `"PIN gồm 4–6 chữ số"`.
  - nội bộ `approve({pin, reason}, what) -> approverName` — người đăng nhập là `chu`/`ql` → không cần PIN, vẫn bắt `reason` không trống (`"Ghi lý do"`); `nv` → PIN khớp một `chu`/`ql` (sai → QUYEN `"PIN không đúng"`; 5 lần sai liên tiếp → QUYEN `"Sai PIN quá 5 lần — chờ 5 phút"` cho tới `lockUntil`); ghi `st.approvals.push({id, at, kind, orderId, amount, reason, askedBy, approvedBy})`. **Ruling** (ghi ledger): QL/Chủ tự làm không gõ PIN — chính họ là người duyệt.
  - `api.listMenu({all=false}) -> MenuItem[]` — `MenuItem = {id, name, group, price, kind:'mon'|'combo', active, sort, serves? (combo), slots? (combo): [{label, count, group? , itemIds?}], stockTracked? }`.
  - `api.saveMenuItem(item) -> MenuItem[]` (chu) — lỗi `"Nhập tên món"`, `"Giá phải lớn hơn 0"`, combo thiếu ô chọn → `"Combo cần ít nhất 1 ô chọn món"`.
  - `api.importMenu(items:[{name, group, price}]) -> {added, updated}` (chu) — trùng tên (bỏ dấu, chữ thường) → cập nhật giá + nhóm.
  - `api.listPromotions()`, `api.savePromotion(p)` (chu); `api.listVouchers()`, `api.saveVoucher(v)` (chu) — mã voucher lưu chữ HOA, trùng mã → LOI `"Mã này đã có"`.
  - `saveSettings` nhận thêm các khoá mới; `extraPrice` ≥ 0, `minPerPerson` 0–5, `paper` ∈ {'58','80'}.
  - Dữ liệu mẫu (khi `seed`): menu (thử) — Cà phê: Cà phê sữa 29.000, Bạc xỉu 32.000; Trà: Trà đào 35.000, Trà vải 35.000; Nước chai: Coca 20.000, Nước suối 12.000 (có hàng kho); Snack: Hướng dương 25.000; Combo 3 người 150.000 (serves 3, ô "3 đồ uống" nhóm Trà/Cà phê count 3 + "1 snack" nhóm Snack count 1). 1 khuyến mãi mẫu "Giờ vàng 14–17h −20% Trà" T2–T6. 1 voucher mẫu `LELA10` 10%.
  - `supabase.js`: `setPin → app_pin_set {p_pin}`, `listMenu → app_menu_list {p_all}`, `saveMenuItem → app_menu_save {p}`, `importMenu → app_menu_import {p_items}`, `listPromotions → app_promo_list`, `savePromotion → app_promo_save {p}`, `listVouchers → app_voucher_list`, `saveVoucher → app_voucher_save {p}`.

- [ ] **Step 1: Viết bài thử** `kiem_tra/ban_test.mjs` (mẫu `fresh()` như `local_test.mjs`, đăng nhập theo id): nv `saveMenuItem` → QUYEN; chu thêm món giá 0 → LOI; `importMenu` 2 dòng (1 trùng tên "trà đào" không dấu khác hoa thường) → `{added:1, updated:1}`; `setPin('12a4')` → LOI; nv gọi `setPin` → QUYEN; voucher trùng mã `lela10` → LOI; `saveStaff({name:'QL2', role:'ql'})` chạy được.
- [ ] **Step 2: Chạy** `kiem_tra/chay_jsc.sh ban_test.mjs` — Expected: FAIL (`saveMenuItem is not a function`).
- [ ] **Step 3: Viết** `local_ban.js` + sửa `local.js` + `supabase.js` theo Interfaces.
- [ ] **Step 4: Chạy** `kiem_tra/chay_jsc.sh` (tất cả) — Expected: mọi tệp `0 hỏng` (kể cả `supabase_test.mjs`, `local_test.mjs`).
- [ ] **Step 5: Commit** `"Tính tiền bước 3: vai trò Quản lý, PIN, menu, khuyến mãi, voucher (bản chạy thử)"`

### Task 4: Lớp lưu chạy thử — phiếu, gửi pha chế, thanh toán, huỷ hoá đơn

**Files:**
- Modify: `docs/js/store/local_ban.js`, `docs/js/store/local.js` (`snapshot` thêm `orderStats`), `docs/js/store/supabase.js`
- Test: `kiem_tra/ban_test.mjs` (thêm)

**Interfaces:**
- Consumes: `priceOrder`, `settle`, `minOrder` (Task 1); `deductions` (Task 2); `approve` (Task 3); `finish(v)` + logic `checkOut` của `local.js` (tách thành hàm nội bộ `doCheckOut(v, outAt)` dùng chung).
- Produces:
  - `Order = {id, visitId, boxId, status:'mo'|'da_thu'|'huy', lines: Line[], voucherCode, manual: {kind, value, approvedBy, reason}|null, extraHours, extraPrice, priced: Priced|null, payments, change, openedBy, openedAt, paidBy, paidAt, voidedBy, voidedAt, voidReason, splitFrom}`.
  - `Line = {id, menuItemId, kind, group, name, price, qty, note, picks: [{menuItemId, name}], sentAt: ms|null, voided: {by, reason, at}|null}`.
  - `api.ordersOfVisit(visitId) -> Order[]` — lượt đang ngồi chưa có phiếu `mo` nào → tự tạo một phiếu `mo`.
  - `api.addLines(orderId, items:[{menuItemId, qty, note, picks?}]) -> Order` — giá + tên chép từ menu lúc gọi; combo kiểm số pick đúng tổng `count` các ô (`"Chọn đủ món cho combo"`); phiếu không `mo` → LOI `"Phiếu đã đóng"`.
  - `api.removeLine(orderId, lineId, auth?: {pin, reason}) -> Order` — chưa gửi → xoá hẳn; đã gửi → `approve(auth, 'huy_mon')` rồi đánh `voided`.
  - `api.sendToBar(orderId) -> {order, ticket:{boxName, at, again:boolean, lines:[{name, qty, note, picks}], by}}` — chỉ dòng `sentAt == null`; không có dòng mới → LOI `"Không có món mới để gửi"`.
  - `api.splitOrder(orderId, lineIds) -> Order` (phiếu mới, cùng lượt, `splitFrom`).
  - `api.setVoucher(orderId, code|null) -> Order` — lỗi theo `voucherError`.
  - `api.setManualDiscount(orderId, {kind, value, pin, reason}|null) -> Order` — `approve(…, 'giam_tay')`.
  - `api.quote(orderIds[], outAt?) -> {orders:[{order, priced, isLast}], total, minWarn: string|null, outAt}` — `isLast` = phiếu `mo` cuối cùng của lượt (chỉ phiếu này mang giờ ngồi thêm của lượt); giờ ngồi thêm tính tới `outAt` (mặc định lúc này) theo `extraHours`; `minWarn` ví dụ `"Box 3: 3 người mới gọi 1 món"`.
  - `api.pay(orderIds[], {transfer, cashGiven, outAt?, auth?}) -> {receipt}` — **một lệnh**: mọi phiếu phải `mo` (không → LOI `"Phiếu đã thu"`); tổng 0 → `approve(auth, 'thu_0d')`; `settle` lỗi → LOI; đánh `da_thu` + `priced` + `payments` (chia tiền theo tỉ lệ không cần — lưu `payments` ở phiếu đầu, các phiếu khác ghi `paidWith: firstOrderId`); voucher đã dùng `used += 1`; sinh `stock_moves` `ban` từ `deductions`; mỗi lượt không còn phiếu `mo` → `doCheckOut(v, outAt)`. `receipt = {shopName, footer, boxNames, inAt, outAt, minutes, lines, priced (gộp), payments, change, paidBy, at, reprint:false}`.
  - `api.voidOrder(orderId, {pin, reason}) -> Order` — chỉ phiếu `da_thu`; `approve(…, 'huy_hoa_don')`; `status 'huy'`, `voidedAt`; sinh `hoan` cho mọi `ban` của phiếu.
  - `api.receiptOf(orderId) -> receipt` (in lại, `reprint: true`).
  - `snapshot(date)` thêm `orderStats: {[visitId]: {total, have, need, firstAt}}` cho lượt đang ngồi (`total` = tạm tính chưa có giờ thêm; `firstAt` = lúc gọi món đầu).
  - `supabase.js`: `ordersOfVisit → app_orders_of_visit {p_visit}`, `addLines → app_order_add {p_id, p_items}`, `removeLine → app_order_remove_line {p_id, p_line, p_auth}`, `sendToBar → app_order_send {p_id}`, `splitOrder → app_order_split {p_id, p_lines}`, `setVoucher → app_order_voucher {p_id, p_code}`, `setManualDiscount → app_order_manual {p_id, p}`, `quote → app_order_quote {p_ids, p_out_ms}`, `pay → app_order_pay {p_ids, p}`, `voidOrder → app_order_void {p_id, p_auth}`, `receiptOf → app_order_receipt {p_id}`.

- [ ] **Step 1: Viết bài thử** (thêm vào `ban_test.mjs`), mỗi bài một hành vi:
  - `phieu_tu_mo`: khách vãng lai vào b1 → `ordersOfVisit` trả 1 phiếu `mo`.
  - `gia_chep_luc_goi`: gọi Trà đào, Chủ đổi giá thành 40.000 → dòng vẫn 35.000.
  - `gui_pha_che_chi_mon_moi`: gọi 2 món, gửi → ticket 2 dòng `again false`; gọi thêm 1, gửi → ticket 1 dòng `again true`; gửi lần nữa → LOI.
  - `xoa_chua_gui_khong_pin` / `huy_da_gui_can_pin`: nv xoá dòng chưa gửi được; dòng đã gửi không PIN → QUYEN; PIN `2222` + lý do → `voided.by === 'Quản lý (thử)'`; QL đăng nhập tự huỷ không PIN, thiếu lý do → LOI.
  - `pin_sai_5_lan`: 5 lần PIN sai → lần 6 dù đúng PIN vẫn QUYEN "Sai PIN quá 5 lần"; `clock.advance(5)` → đúng PIN chạy được.
  - `thanh_toan_mot_lenh`: vào 10:00, gọi 1 Trà đào 35.000 + 1 Coca 20.000, `clock.set(10:00 + 4g01)` → `quote` total = 55.000 + 2×20.000 = 95.000; `pay(transfer 0, cashGiven 100.000)` → `change 5.000`, lượt `ve` với `extra 2`, Coca kho: `ban` 1.
  - `thu_hai_lan`: `pay` lại cùng phiếu → LOI `"Phiếu đã thu"`.
  - `thu_0d_can_pin`: lượt không gọi gì, ngồi 1 giờ → `pay` nv không PIN → QUYEN; có PIN → lượt `ve`.
  - `tach_bill`: phiếu 3 dòng, tách 1 dòng → thu phiếu tách trước: lượt vẫn `ngoi`, không có tiền ngồi thêm trên phiếu tách; thu phiếu còn lại → lượt `ve`, tiền ngồi thêm nằm ở phiếu này.
  - `tra_chung_nhom`: phiếu đặt 2 box, cả hai vào; b1 gọi 1 món, b2 không gọi; ra lúc 3g20 → `quote([o1,o2])` có 2 dòng giờ thêm 1 giờ (mỗi box một) → `pay` → cả hai lượt `ve`.
  - `doi_box_phieu_theo_luot`: gọi món ở b1, `moveBox` sang b8 → `ordersOfVisit` vẫn phiếu cũ, `quote` boxNames có "Box 8".
  - `quen_ve_hom_sau`: vào 20:00, hôm sau 09:00 `quote(ids, outAt = 23:00 hôm trước)` → giờ ngồi thêm theo 3g00 → 0.
  - `huy_hoa_don_hoan_kho`: thu xong (có 1 Coca), hôm sau nv `voidOrder` không PIN → QUYEN; có PIN → `status 'huy'`, `stock_moves` có `hoan` 1 Coca, `voidedAt` = hôm sau.
  - `voucher_dung_mot_lan`: voucher `maxUses 1` → phiếu A dùng + thu → phiếu B `setVoucher` → LOI `"Mã đã dùng hết lượt"`.
  - `nhac_chua_goi`: `snapshot` có `orderStats` cho lượt đang ngồi `{have 0, need 2}`.
- [ ] **Step 2: Chạy** `kiem_tra/chay_jsc.sh ban_test.mjs` — Expected: các bài mới FAIL.
- [ ] **Step 3: Viết** các hàm theo Interfaces; tách `doCheckOut` trong `local.js` để `checkOut` cũ và `pay` dùng chung.
- [ ] **Step 4: Chạy** `kiem_tra/chay_jsc.sh` — Expected: mọi tệp `0 hỏng`.
- [ ] **Step 5: Commit** `"Tính tiền bước 4: phiếu theo box, gửi pha chế, thanh toán một lệnh, tách bill, huỷ hoá đơn (bản chạy thử)"`

### Task 5: Lớp lưu chạy thử — kho

**Files:**
- Modify: `docs/js/store/local_ban.js`, `docs/js/store/supabase.js`
- Test: `kiem_tra/ban_test.mjs` (thêm)

**Interfaces:**
- Consumes: `expectedQty` (Task 2); `stock_moves` từ `pay` / `voidOrder` (Task 4).
- Produces:
  - `StockItem = {id, name, unit, menuItemId|null, active}`.
  - `api.listStock() -> StockItem[]` (mọi vai trò; **không** có số lượng).
  - `api.saveStockItem(it) -> StockItem[]` (chu, ql) — lỗi `"Nhập tên hàng"`.
  - `api.receiveStock({items:[{stockItemId, qty}], note}) -> true` (mọi vai trò) — `qty` nguyên > 0 (`"Số lượng phải lớn hơn 0"`).
  - `api.stockOverview() -> [{item, expected, lastCount: {at, counted}|null}]` (chu, ql; nv → QUYEN).
  - `api.saveCount({items:[{stockItemId, counted}], note}) -> {id, at}` (mọi vai trò) — trả về **không** kèm số đáng lẽ còn; lưu cả `expected` + `diff` mỗi hàng tại lúc đếm.
  - `api.countsList(from, to) -> [{id, at, by, items:[{stockItemId, name, expected, counted, diff}]}]` (chu, ql).
  - `api.movesList(from, to) -> [{at, kind, name, qty, by, note}]` (chu, ql).
  - Mẫu: hàng kho Coca (lon), Nước suối (chai) gắn món; Sữa đặc (hộp), Trà đen (gói) không gắn món.
  - `supabase.js`: `listStock → app_stock_list`, `saveStockItem → app_stock_save {p}`, `receiveStock → app_stock_receive {p}`, `stockOverview → app_stock_overview`, `saveCount → app_stock_count {p}`, `countsList → app_stock_counts {p_from, p_to}`, `movesList → app_stock_moves {p_from, p_to}`.

- [ ] **Step 1: Viết bài thử**: nhập 24 Coca → bán 2 qua `pay` → nv `stockOverview` → QUYEN; nv `saveCount` Coca 21 → kết quả không có khoá `expected`/`diff`; chu `countsList` → `{expected 22, counted 21, diff -1}`; `receiveStock` qty 0 → LOI.
- [ ] **Step 2: Chạy** — Expected: FAIL.
- [ ] **Step 3: Viết** theo Interfaces.
- [ ] **Step 4: Chạy** `kiem_tra/chay_jsc.sh` — Expected: `0 hỏng` mọi tệp.
- [ ] **Step 5: Commit** `"Tính tiền bước 5: kho — nhập, tự trừ, kiểm kê mù (bản chạy thử)"`

### Task 6: Báo cáo tiền (hàm thuần + lớp lưu)

**Files:**
- Modify: `docs/js/report.js`, `docs/js/store/local_ban.js`, `docs/js/store/supabase.js`
- Test: `kiem_tra/report_test.mjs` (thêm), `kiem_tra/ban_test.mjs` (thêm)

**Interfaces:**
- Produces:
  - `api.ordersRange(from, to) -> Order[]` (chu, ql) — phiếu `da_thu` có ngày thu trong khoảng **hoặc** `huy` có ngày huỷ trong khoảng (ngày theo giờ VN).
  - `api.approvalsRange(from, to) -> Approval[]` (chu, ql).
  - `revenueDaily(orders, from, to) -> [{date, cash, transfer, total, voids, count}]` — phiếu `da_thu` cộng vào ngày `paidAt`; phiếu `huy` cộng vào ngày `paidAt` **và** trừ ở ngày `voidedAt` (`voids` = tổng âm ngày đó). Tiền mặt / chuyển khoản lấy từ `payments` (đã trừ tiền thối).
  - `itemSales(orders, from, to) -> [{name, qty, amount}]` sắp theo `amount` giảm; combo tính 1 dòng tên combo; phiếu huỷ không tính.
  - `extraMoney(orders, from, to) -> {hours, amount}`; `discountSummary(orders) -> {promo, voucher, manual}`.
  - `supabase.js`: `ordersRange → app_orders_range {p_from, p_to}`, `approvalsRange → app_approvals_range {p_from, p_to}`.

- [ ] **Step 1: Viết bài thử** `report_test.mjs`: phiếu 95.000 tiền mặt thu 19/11, huỷ 20/11 → 19/11 total 95.000; 20/11 `voids -95000`, total −95.000. Phiếu chia 100.000 CK + 95.000 tiền mặt (khách đưa 100.000, thối 5.000)... → cash 95.000 transfer 100.000.
- [ ] **Step 2: Chạy** — FAIL. **Step 3: Viết.** **Step 4: Chạy** `kiem_tra/chay_jsc.sh` — `0 hỏng`.
- [ ] **Step 5: Commit** `"Tính tiền bước 6: báo cáo doanh thu, theo món, giờ thêm, giảm–huỷ"`

### Task 7: In (`print.js`) + hộp PIN (`pages/pin.js`)

**Files:**
- Create: `docs/js/print.js`, `docs/js/pages/pin.js`
- Modify: `docs/css/app.css`
- Test: `kiem_tra/money_test.mjs` không đổi; hàm dựng mẫu in kiểm trong `kiem_tra/print_test.mjs` (thuần, không DOM)

**Interfaces:**
- Produces:
  - `ticketHtml(ticket, settings) -> string` — box, giờ `HH:MM`, "GỌI THÊM" khi `again`, từng dòng `SL × tên` + picks thụt lề + ghi chú, người gửi. Dùng `html\`\`` → chuỗi đã thoát.
  - `receiptHtml(receipt, settings) -> string` — tên quán, box, vào–ra, ngồi `fmtDur`, dòng hàng + tiền, khuyến mãi (tên + `-số`), "Ngồi thêm N giờ × giá", giảm tay, TỔNG, từng khoản trả, tiền thối, chân, "IN LẠI" khi `reprint`. Khổ: CSS `width: 72mm` (80) / `48mm` (58).
  - `printHtml(bodyHtml, settings) -> Promise<void>` — tạo `iframe` ẩn, ghi tài liệu có CSS in, gọi `contentWindow.print()`, gỡ khung sau 1 giây; luôn đẩy `bodyHtml` vào `window.__lelaPrints` (mảng, cho bài thử).
  - `askPin({title, needReason=true, amount?}) -> Promise<{pin, reason}|null>` — mở sheet; ô PIN `input[name=pin]` (`inputmode=numeric`, `type=password`), ô lý do `input[name=reason]`, nút `[data-act="pin-ok"]`, `[data-act="pin-cancel"]`. Người đăng nhập là `chu`/`ql` → ẩn ô PIN (chỉ lý do).
- [ ] **Step 1: Viết** `kiem_tra/print_test.mjs` kiểm `receiptHtml` chứa `"Ngồi thêm 2 giờ × 20.000đ"`, `"TỔNG"`, `"95.000đ"`, tên khách có `<b>` bị thoát thành `&lt;b&gt;`; `ticketHtml` có `"GỌI THÊM"` khi `again`. (`print.js` tách phần dựng chuỗi khỏi phần DOM: `printHtml` chỉ chạm DOM khi gọi.)
- [ ] **Step 2: Chạy** — FAIL. **Step 3: Viết.** **Step 4: Chạy** — `0 hỏng`.
- [ ] **Step 5: Commit** `"Tính tiền bước 7: mẫu in phiếu pha chế / hoá đơn + hộp PIN"`

### Task 8: Màn gọi món + thanh toán, gắn vào Bảng box

**Files:**
- Create: `docs/js/pages/goi_mon.js`, `docs/js/pages/thanh_toan.js`
- Modify: `docs/js/pages/bang.js` (ô box hiện tạm tính; khung box đang ngồi: nút **Gọi món**, **Thanh toán & khách về** thay "Khách về"; giữ "Đổi box", "Sửa giờ vào"), `docs/js/board.js` (`reminders` thêm tham số thứ 6 `orderStats` → loại `chua_goi`), `docs/js/app.js` (truyền `snap.orderStats` vào `reminders`), `docs/css/app.css`
- Modify test: `kiem_tra/trinh_duyet/flow_bang.js` (đổi đoạn "Khách về" sang luồng thanh toán), `kiem_tra/board_test.mjs` (thêm `chua_goi`)
- Create test: `kiem_tra/trinh_duyet/flow_ban_hang.js`; thêm vào `danh_sach.txt`: `flow_ban_hang nv`, `flow_ban_hang nv phone`, `flow_ban_hang ql`
- Modify: `kiem_tra/chay_chrome.sh` / `app.js` `TEST_USER` thêm `ql: 'u_ql'`

**Interfaces:**
- Consumes: Task 3–7.
- Produces:
  - `openOrder(ctx, visit, boxName) -> Promise<void>` (sheet lớn): trái lưới nút `.menu-btn[data-item]` theo nhóm (tab nhóm `.grp[data-grp]`) + ô tìm `#q-mon` (Enter = thêm món đầu tiên khớp); phải danh sách dòng `.oline[data-line]` (đã gửi có nhãn "đã gửi"), nút xoá `[data-act="del-line"]`, tạm tính `#o-total`, nút `[data-act="send"]` "Gửi pha chế" (in phiếu), `[data-act="pay"]` mở thanh toán. Combo: bấm → sheet chọn món cho từng ô (`.pick-item[data-item]`, nút `[data-act="combo-ok"]` chỉ bật khi đủ).
  - `openPay(ctx, visitIds[], after) -> Promise<void>`: hiện `quote`; nếu lượt thuộc phiếu đặt nhiều box còn ngồi → hộp chọn trả chung `input[name=together]`; ô giờ ra (mặc định như logic cũ: lúc này, hoặc giờ đóng cửa ngày vào nếu quên); ô voucher `#v-code` + `[data-act="voucher"]`; `[data-act="manual"]` (gọi `askPin`, rồi chọn % / số tiền); `[data-act="split"]` chọn dòng tách; ô `#pay-transfer`, `#pay-given` (nút nhanh: "Đủ tiền mặt", "Chuyển khoản hết"), `#pay-change`; cảnh báo `minWarn`; nút `[data-act="pay-ok"]` "Thu tiền & in" → `pay` → `printHtml(receiptHtml)` → toast → `after()`.
  - Nhắc `chua_goi`: `"Box N vào X phút chưa gọi món"` khi `now − inAt ≥ noOrderMin` và `have < need`; nằm sau `quen_ve` trong thứ tự.
- [ ] **Step 1: Viết bài thử** `board_test.mjs` cho `chua_goi` + `flow_ban_hang.js`: nv mở Box 2 → Gọi món → bấm Trà đào ×2, Coca → Gửi pha chế → `__lelaPrints` cuối chứa "Trà đào" và không chứa "GỌI THÊM"; gọi thêm Hướng dương → gửi → có "GỌI THÊM"; xoá dòng đã gửi → hiện hộp PIN, Huỷ → dòng còn; Thanh toán & khách về → nhập CK 50.000, khách đưa 100.000 → tiền thối đúng → Thu tiền & in → `__lelaPrints` cuối có "TỔNG"; ô Box 2 thành `k-trong`. Vai trò `ql`: bấm Giảm tay → không có ô PIN, có ô lý do. Mỗi luồng: `h.noOverflow(); h.strange();`.
- [ ] **Step 2: Chạy** `kiem_tra/chay_jsc.sh board_test.mjs` và `kiem_tra/chay_chrome.sh flow_ban_hang nv` — Expected: FAIL.
- [ ] **Step 3: Viết** `goi_mon.js`, `thanh_toan.js`, sửa `bang.js`, `board.js`, `app.js`, CSS. Máy tính: sheet gọi món rộng 2 cột (≥ 900px); điện thoại: 1 cột, danh sách dòng dưới lưới.
- [ ] **Step 4: Chạy** `kiem_tra/chay_jsc.sh` và `kiem_tra/chay_het.sh` — Expected: mọi bài đạt (kể cả `flow_bang` đã sửa).
- [ ] **Step 5: Commit** `"Tính tiền bước 8: màn gọi món, thanh toán, nhắc chưa gọi món"`

### Task 9: Cài đặt — menu, nhập Excel, khuyến mãi, voucher, giá ngồi thêm, máy in, PIN, vai trò QL

**Files:**
- Create: `docs/js/pages/cai_dat_ban.js` (các mục mới, gọi từ `cai_dat.js`)
- Modify: `docs/js/pages/cai_dat.js` (gắn mục mới; chọn vai trò thêm "Quản lý"; Quản lý vào được mục "PIN của tôi" — xem dưới), `docs/js/app.js` (tab Cài đặt: Chủ thấy đủ; QL thấy trang chỉ có "PIN của tôi")
- Create test: `kiem_tra/trinh_duyet/flow_cai_dat_ban.js`; `danh_sach.txt`: `flow_cai_dat_ban chu`, `flow_cai_dat_ban chu phone`

**Interfaces:**
- Consumes: Task 3 API, `parseMenuRows` (Task 2).
- Produces (selector cho bài thử):
  - Menu: bảng `.menu-row[data-id]` (tên, nhóm, giá, đang bán), nút `[data-act="add-item"]`, `[data-act="save-item"]`; combo: ô `serves`, danh sách ô chọn `.slot-row` (nhãn, số món, nhóm).
  - Nhập Excel: `input#f-excel[type=file]` (nhận .xlsx/.xls/.csv) → tải SheetJS `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` khi cần (thẻ `<script>` chèn động, một lần) → `parseMenuRows` → bảng xem trước `#imp-preview` → `[data-act="imp-ok"]`. CSV đọc không cần thư viện.
  - Khuyến mãi `.promo-row`, voucher `.voucher-row`, ô `extraPrice`, `minPerPerson`, `noOrderMin`, `shopName`, `billFooter`, `paper` trong form cài đặt cũ (`#f-set`).
  - "PIN của tôi": `#f-pin` (ô `pin`, `pin2`), lưu bằng `setPin`.
  - Nút "In thử" `[data-act="test-print"]` in hoá đơn mẫu.
- [ ] **Step 1: Viết** `flow_cai_dat_ban.js`: Chủ thêm món "Trà chanh (thử)" 30.000 → có trong danh sách; nhập CSV giả (tạo bằng `new File([...])` gán vào ô qua `DataTransfer`) 2 dòng → xem trước 2 dòng → nhập → thông báo "Thêm 1, cập nhật 1"; tạo voucher `TEST5`; đổi giá ngồi thêm 25.000 lưu được; In thử → `__lelaPrints` có "Ngồi thêm".
- [ ] **Step 2: Chạy** `kiem_tra/chay_chrome.sh flow_cai_dat_ban chu` — FAIL. **Step 3: Viết.** **Step 4: Chạy** `kiem_tra/chay_het.sh` — đạt hết.
- [ ] **Step 5: Commit** `"Tính tiền bước 9: Cài đặt menu, nhập Excel, khuyến mãi, voucher, PIN, máy in"`

### Task 10: Tab Kho + Báo cáo tiền

**Files:**
- Create: `docs/js/pages/kho.js`
- Modify: `docs/js/app.js` (tab `#/kho` "Kho" mọi vai trò; `#/bao-cao` cho `chu` + `ql` — đổi cờ `chu: true` thành `roles: ['chu','ql']` cho Báo cáo, Cài đặt giữ như Task 9), `docs/js/pages/bao_cao.js` (thêm bảng `.t-revenue`, `.t-items`, `.t-voids`, dòng "Tiền ngồi thêm", "Giảm giá")
- Create test: `kiem_tra/trinh_duyet/flow_kho.js`; `danh_sach.txt`: `flow_kho nv`, `flow_kho ql`, `flow_kho nv phone`; sửa `flow_khach_bc.js` nếu cần cho bảng mới

**Interfaces:**
- Consumes: Task 5, Task 6.
- Produces: `kho.js` có 3 mục: **Nhập hàng** (`.recv-row[data-id]` ô số lượng, `[data-act="recv-ok"]`), **Kiểm kê** (`.count-row[data-id]` ô số đếm, `[data-act="count-ok"]`; nv không thấy cột đáng lẽ còn), **Tồn & chênh lệch** (chỉ ql/chu: `.stock-row` có "đáng lẽ còn", lịch sử kiểm kê `.count-hist` có chênh lệch tô đỏ khi ≠ 0), thêm/sửa hàng kho (ql/chu).
- [ ] **Step 1: Viết** `flow_kho.js`: nv nhập 24 Coca → kiểm kê nhập 20 → trang **không** có chữ "đáng lẽ còn"/"chênh lệch"; ql → thấy lần đếm với chênh lệch ≠ 0 tô đỏ. Sửa / thêm vào `flow_khach_bc.js` (chu): bảng doanh thu có dòng hôm nay sau khi thu một phiếu mẫu.
- [ ] **Step 2: Chạy** — FAIL. **Step 3: Viết.** **Step 4: Chạy** `kiem_tra/chay_het.sh` — đạt hết.
- [ ] **Step 5: Commit** `"Tính tiền bước 10: tab Kho + báo cáo tiền"`

### Task 11: Máy chủ — `02_tinh_tien_kho.sql` + bài thử tự hoàn tác

**Files:**
- Create: `supabase/02_tinh_tien_kho.sql`, `supabase/kiem_tra_02.sql`
- Modify: `supabase/01_khoi_tao.sql` **không sửa** (đã viết nhưng chưa chạy — vẫn coi là cố định; mọi thay đổi nằm ở 02).

**Interfaces:**
- Consumes: bảng / hàm của `01_khoi_tao.sql` (`app__need`, `app__me`, `app__extra`, `app__ms`, `app__vn_ts`, `app__fold`, khoá ghi `pg_advisory_xact_lock(4242)`).
- Produces: đủ mọi hàm `app_*` đã khai ở `supabase.js` trong Task 3–6, cùng tên tham số; JSON trả về cùng khoá camelCase như bản chạy thử.
  - `staff.role` check mở thêm `'ql'` (drop + add constraint); `staff.pin_hash text`, `pin_fail int`, `pin_lock_until timestamptz` (khoá theo **toàn bảng** cho duyệt: dùng bảng `pin_guard(id=1, fails, lock_until)` — cùng ruling với bản chạy thử).
  - `settings` thêm cột: `extra_price int default 20000`, `min_per_person int default 1`, `no_order_min int default 10`, `shop_name text default 'Lela Box'`, `bill_footer text default 'Cảm ơn quý khách!'`, `paper text default '80'`; `app__settings_json` + `app_settings_save` viết lại (create or replace) gồm khoá mới.
  - Bảng: `menu_items`, `promotions`, `vouchers`, `orders` (lines jsonb, payments jsonb, priced jsonb), `stock_items`, `stock_moves`, `stock_counts` (items jsonb), `approvals`. RLS bật, thu hồi quyền.
  - Tính tiền trên máy chủ: `app__price_order(o orders, p_out timestamptz) returns jsonb` viết lại đúng thuật toán `priceOrder` (Task 1). Đây là chỗ dễ lệch nhất → `kiem_tra_02.sql` so với đúng các con số trong `money_test.mjs` (220.000 / 14.000 / 40.000 / 246.000; giảm tay 24.600 → 221.400; 15% × 33.333 = 4.999).
  - PIN: `crypt(pin, gen_salt('bf'))` (pgcrypto, schema `extensions`).
  - `app_order_pay` khoá `4242`, kiểm `status = 'mo'` **trong** khoá → hai lần thu chỉ một lần chạy.
  - Cuối tệp: vòng `do $$` cấp quyền như `01` (chạy lại cho hàm mới).
- [ ] **Step 1: Viết** `kiem_tra_02.sql` (khối `DO $$ … RAISE EXCEPTION 'REPORT>> %' … $$`, tự hoàn tác): giả lập đăng nhập bằng `set local request.jwt.claims` cho email Chủ / NV / QL tạo trong khối; kiểm: 4 con số tiền ở trên; thu hai lần → lần 2 lỗi `LOI: Phiếu đã thu`; NV giảm tay không PIN → `QUYEN`; PIN sai 5 lần → khoá; tổng khoản trả thiếu → lỗi; huỷ hoá đơn sinh `hoan`; nv gọi `app_stock_overview` → `QUYEN`.
- [ ] **Step 2: Viết** `02_tinh_tien_kho.sql` theo Interfaces.
- [ ] **Step 3: Tự soát** (máy không có Postgres): đối chiếu từng hàm `supabase.js` ↔ tên + tham số trong `02`: `grep -o "rpc('app_[a-z_]*'" docs/js/store/supabase.js | sort -u` so với `grep -o "function public.app_[a-z_]*" supabase/02_tinh_tien_kho.sql supabase/01_khoi_tao.sql | sort -u` — Expected: mọi tên ở vế trái có ở vế phải. Ghi vào ledger: SQL chưa chạy thật, lần đầu chạy theo `tai_lieu/BAN_GIAO.md` (chạy `01`+`kiem_tra_01`, rồi `02`+`kiem_tra_02` tự hoàn tác trước).
- [ ] **Step 4: Commit** `"Tính tiền bước 11: SQL máy chủ (chưa chạy) + bài thử tự hoàn tác"`

### Task 12: Tài liệu, dọn tài liệu cũ, chạy toàn bộ

**Files:**
- Move: `docs/superpowers/specs/2026-11-19-dat-box-design.md`, `docs/superpowers/plans/2026-11-19-dat-box.md` → `tai_lieu/superpowers/specs/`, `tai_lieu/superpowers/plans/` (`git mv`)
- Modify: `README.md` (mục "Máy in ở quầy": tạo biểu tượng Chrome in thẳng — Windows: thêm ` --kiosk-printing` vào ô Target của shortcut Chrome; Mac: `open -na "Google Chrome" --args --kiosk-printing <địa chỉ web>` trong một tệp `.command`; đặt máy in bill làm máy in mặc định; In thử ở Cài đặt), `tai_lieu/BAN_GIAO.md` (tình trạng, bài thử mới, bước chuyển đổi chạy song song 1 tuần, câu hỏi còn mở: khổ giấy thật, file Excel mẫu), `CLAUDE.md` (nơi để tài liệu `tai_lieu/superpowers/`), `docs/version.json` (`2026.11.19.2`)
- [ ] **Step 1:** `git mv` + sửa các đường dẫn nhắc tới tài liệu cũ (`grep -rn "docs/superpowers" --include=*.md .`) — Expected: không còn chỗ nhắc đường dẫn cũ.
- [ ] **Step 2:** Viết README / BAN_GIAO / CLAUDE.md theo Files.
- [ ] **Step 3: Chạy** `kiem_tra/chay_jsc.sh && kiem_tra/chay_het.sh` — Expected: mọi tệp `0 hỏng`, mọi luồng đạt.
- [ ] **Step 4: Commit** `"Tính tiền bước 12: hướng dẫn máy in, bàn giao, chuyển tài liệu khỏi docs/"`
