# Thiết kế: Tính tiền + Kho — thay KiotViet ở Lela Box

Ngày: 19/11/2026 (bản 1) · Người quyết định: anh Tiến (chủ quán, không phải lập trình viên) · Nền: web quản lý box đã làm (`docs/superpowers/specs/2026-11-19-dat-box-design.md`, nhánh `dat-box`).

## 1. Vì sao làm

Lela Box (LLB) đang dùng **KiotViet** để bán hàng (in hoá đơn, combo, giảm giá, khuyến mãi, khách thân) và kiểm kê kho định kỳ. Anh Tiến muốn **thay hẳn KiotViet** bằng chính web Lela Box: một chỗ cho cả box, khách, tiền, kho — giờ ngồi thêm tự thành tiền trên hoá đơn, không phải tính tay hay nhập hai nơi. Anh chọn làm **web riêng** (không gộp vào web Milano) dù đã nghe so sánh; LLB vẫn chốt ca bên Milano như hiện nay.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu:**
- Nhân viên ở **máy tính quầy** gọi món cho từng box nhanh như KiotViet; in **phiếu pha chế** và **hoá đơn** trên cùng một máy in, bấm một lần là ra giấy.
- Khách về: web tự cộng **giờ ngồi thêm** (theo quy tắc đã có) × giá/giờ, áp combo / khuyến mãi / voucher, thu tiền mặt / chuyển khoản / chia nhiều cách / tách bill, rồi cho box trống — **một luồng**.
- Giảm tay, huỷ món đã gửi pha chế, huỷ hoá đơn đã thu: **chỉ quản lý hoặc Chủ**, có dấu vết.
- Kho: nhập hàng (số lượng), hàng bán nguyên tự trừ khi bán, kiểm kê ra chênh lệch.
- Chủ xem doanh thu theo ngày / theo món / theo hình thức trả, danh sách giảm–huỷ, chênh lệch kho.

**Không làm (đợt này):** tích điểm khách thân (để sau); chốt ca / đếm két (chưa cần); bán khi mất mạng (mất mạng thì phát Wi-Fi điện thoại); hoá đơn điện tử (LLB không xuất); mã QR chuyển khoản trên hoá đơn; mở két tiền tự động; công thức pha chế / trừ nguyên liệu theo món; giá nhập, giá vốn, lãi lỗ; khách nợ; trang cho khách tự đặt (việc D, làm sau); gộp vào Milano.

**Thất bại nếu (dù chạy được):**
- Giờ đông khách, gọi món / thu tiền **chậm hơn KiotViet** → nhân viên quay lại KiotViet.
- Tiền trên hoá đơn khác tiền trong báo cáo, hoặc một hoá đơn thu hai lần / mất.
- Nhân viên **tự giảm giá, huỷ món, huỷ hoá đơn mà không ai duyệt / không để lại dấu vết**.
- Quên tính giờ ngồi thêm khi thanh toán.
- In ra giấy bị cắt chữ, lệch khổ, hoặc phải bấm nhiều lần mới in.

## 3. Ràng buộc

- Dùng trên **máy tính ở quầy** (màn hình to, chuột/bàn phím). Điện thoại: xem được, không bắt buộc gọi món nhanh trên điện thoại.
- Một máy in bill ở quầy. Khổ giấy là một cài đặt (80mm hoặc 58mm, mặc định 80mm) *(Claude đề xuất — xem tem máy in khi lắp)*. In qua **Chrome** với chế độ in thẳng (`--kiosk-printing`), không cài thêm phần mềm.
- Cần mạng; không bán ngoại tuyến.
- Cùng nền kỹ thuật với web box: JavaScript thuần trong `docs/`, lớp lưu dữ liệu có bản chạy thử (trình duyệt) và bản Supabase (hàm `app_*`, RLS, khoá ghi 4242). Tệp máy chủ mới: `supabase/02_tinh_tien_kho.sql`, viết chạy lại nhiều lần không sao, kèm `supabase/kiem_tra_02.sql` tự hoàn tác.
- Kho mã có thể công khai: không đưa khoá bí mật, dữ liệu thật (file Excel menu thật, tên nhân viên thật) lên kho mã. Tài liệu thiết kế / kế hoạch để ở `tai_lieu/superpowers/` (không ở `docs/` vì `docs/` sẽ là web công khai).
- Tiền là số nguyên đồng (VND), không có số lẻ.

## 4. Các cách đã cân nhắc

| Việc | Các cách | Anh chọn |
|---|---|---|
| Nơi làm | (a) tab trong web Milano — số tiền tự vào chốt ca, rẻ hơn khi lên gói trả phí; (b) web Lela Box riêng | **(b) riêng** |
| Tính tiền / kho | (a) giữ KiotViet, nối số sang web; (b) làm phần thay thế, bỏ KiotViet | **(b) thay thế** |
| In | (A) in thẳng từ Chrome; (B) cài phần mềm in (cắt giấy, mở két); (C) hộp in thường | **(A)** |
| Chuyển đổi | (A) chạy song song 1 tuần với KiotViet rồi mới bỏ; (B) đổi hẳn một ngày | **(A)** |
| Kho | (a) có nhập hàng đơn giản + tự trừ + kiểm kê ra chênh lệch; (b) chỉ đếm và ghi | **(a)** |
| Trừ kho món pha chế | (a) chỉ trừ hàng bán nguyên; (b) công thức từng món | **(a)** |
| Mất mạng | (a) phát Wi-Fi điện thoại; (b) làm chế độ ngoại tuyến | **(a)** |

## 5. Anh Tiến đã quyết (19/11)

| Việc | Quyết định |
|---|---|
| Thiết bị gọi món | Máy tính ở quầy |
| Lúc trả tiền | **Trả lúc về** — mỗi lượt box có một phiếu, gọi thêm cộng dồn |
| Hình thức trả | Tiền mặt, chuyển khoản, **chia nhiều cách / tách bill** |
| Giờ ngồi thêm | **Một giá mỗi giờ mỗi box**, Chủ cài; tự cộng vào hoá đơn |
| Không gọi đồ | **Bắt buộc gọi tối thiểu** |
| Khuyến mãi | Combo giá cố định; khuyến mãi theo giờ / ngày; giảm tay khi tính tiền; mã voucher |
| Giảm tay / huỷ món / huỷ hoá đơn đã thu | **Chỉ quản lý / Chủ** |
| Máy in | **1 máy in cả hoá đơn và phiếu pha chế** |
| Kho | Nhập hàng (số lượng), **chỉ hàng bán nguyên tự trừ**, kiểm kê ra chênh lệch |
| Dữ liệu từ KiotViet | **Chỉ danh sách món + giá** (file Excel xuất từ KiotViet) |
| Hoá đơn điện tử | Không |
| Tích điểm | Làm sau |
| Cuối ca | Chưa cần |

## 6. Thiết kế

### 6.1 Một lượt khách có tiền

```
Khách vào box (đã có) ──► mở PHIẾU của lượt (tự động, trống)
   │
   ├─ Gọi món: chọn món / combo → "Gửi pha chế" → in phiếu pha chế (các dòng chưa gửi)
   ├─ Gọi thêm: cộng dồn, gửi tiếp
   │   (10 phút sau khi vào mà chưa đủ món tối thiểu → nhắc việc "Box N chưa gọi món")
   │
   └─ "Thanh toán & khách về":
        giờ ra → giờ ngồi thêm (quy tắc cũ) × giá/giờ = dòng "Ngồi thêm N giờ"
        + khuyến mãi tự động / voucher / giảm tay (cần PIN)
        → chọn hình thức trả (có thể chia) → tiền thối
        → MỘT lệnh: phiếu = đã thu, lượt = đã về, trừ kho → in hoá đơn
```

Phiếu đặt nhóm 2–3 box: mỗi box một lượt, một phiếu; khi thanh toán được **chọn trả chung** các box cùng phiếu đặt *(Claude đề xuất)*.

### 6.2 Dữ liệu (thêm vào lớp lưu dữ liệu, cả bản chạy thử và Supabase)

- **Món (menu_items):** tên, nhóm, giá, loại `mon` (món thường) | `combo`, đang bán / ngừng, thứ tự. Combo có: giá cố định, **đủ cho N người** (để tính món tối thiểu), các **ô chọn**: mỗi ô = "chọn N món từ nhóm / danh sách X" (vd "3 đồ uống nhóm Trà" + "1 snack"). **Khách tự chọn món trong combo** (anh chốt): bấm combo → nhân viên chọn món cho từng ô → phiếu pha chế in đúng món đã chọn, kho trừ theo món đã chọn; giá = giá combo.
- **Phiếu (orders):** gắn 1 lượt (visit) + box; trạng thái `mo` | `da_thu` | `huy`; các dòng; các khoản giảm; giờ ngồi thêm + giá/giờ chốt lúc thu; các khoản trả; người mở / thu / huỷ; giờ thu.
- **Dòng (order_lines):** món, tên + giá **chép lại lúc gọi** (đổi giá menu sau không đổi phiếu cũ), số lượng, ghi chú (ít đá, không đường…), lúc gửi pha chế (trống = chưa gửi), huỷ (ai duyệt, lý do).
- **Khoản giảm:** loại `tu_dong` | `voucher` | `tay`, % hoặc số tiền, phạm vi (cả phiếu / một dòng), người duyệt (với `tay`).
- **Khoản trả (payments):** `tien_mat` | `chuyen_khoan`, số tiền; tiền khách đưa (để tính thối).
- **Khuyến mãi (promotions):** tên, % hoặc số tiền, áp cho (tất cả / nhóm món), thứ trong tuần, khung giờ, từ ngày – đến ngày, bật/tắt.
- **Voucher:** mã, % hoặc số tiền, hạn dùng, số lần dùng tối đa, hoá đơn tối thiểu, đã dùng bao nhiêu lần.
- **Hàng kho (stock_items):** tên, đơn vị, gắn với 1 món bán nguyên (hoặc không — nguyên liệu pha chế), đang theo dõi.
- **Phiếu kho (stock_moves):** `nhap` | `ban` (tự sinh khi thu tiền) | `hoan` (khi huỷ hoá đơn) | `kiem_ke` (điều chỉnh), số lượng, người, lúc, ghi chú.
- **Kiểm kê (stock_counts):** lần đếm, từng hàng: số đáng lẽ còn, số đếm thật, chênh lệch, người đếm.
- **Duyệt (approvals):** mọi việc cần PIN: loại việc, phiếu, số tiền, lý do, người xin, người duyệt, lúc.
- **Cài đặt thêm:** giá ngồi thêm / giờ / box; món tối thiểu mỗi người (mặc định 1); tên quán + dòng chân hoá đơn; khổ giấy.
- **Vai trò thêm:** `ql` (Quản lý). Chủ và Quản lý mỗi người đặt một **mã PIN 4–6 số** (máy chủ lưu dạng băm, không lưu số thật).

### 6.3 Quy tắc tiền

1. **Tổng phiếu** = Σ(dòng chưa huỷ: giá × SL) + tiền ngồi thêm − giảm. Làm tròn: số nguyên đồng, giảm % làm tròn xuống tới đồng, không làm tròn nghìn *(Claude đề xuất)*.
2. **Giờ ngồi thêm** = `extraHours` đã có (3g10 → 0, 3g11 → 1, 4g01 → 2) × giá/giờ lúc thu. Ghi số giờ + giá vào phiếu, đổi giá sau không đổi phiếu cũ.
3. **Chỉ 1 khuyến mãi mỗi hoá đơn** (anh chốt): khuyến mãi theo giờ/ngày và voucher **không cộng dồn** — web tính cả hai, áp cái **giảm nhiều hơn** cho khách, ghi rõ trên hoá đơn. Combo đã giá cố định nên **không giảm thêm**; tiền ngồi thêm không được khuyến mãi. Giảm tay (cần PIN) vẫn thêm được, áp sau cùng, được giảm cả tiền ngồi thêm.
4. Tổng các khoản trả **phải đúng bằng** tổng phiếu (tiền mặt được đưa dư → tính thối, phần ghi nhận = đúng phần còn lại). Không thu được phiếu 0đ trừ khi có duyệt.
5. **Tách bill:** chọn các dòng chuyển sang một phiếu mới cùng lượt; mỗi phiếu thu riêng; giờ ngồi thêm nằm ở phiếu thu cuối cùng (phiếu làm box trống) *(Claude đề xuất)*.
6. **Món tối thiểu:** số món (món thường tính theo SL, combo tính N người) ≥ số người × mức tối thiểu. Thiếu → nhắc việc + cảnh báo lúc thanh toán; **không chặn** *(Claude đề xuất — chặn thì nhân viên kẹt khi khách nhất quyết không gọi)*.

### 6.4 Quyền và PIN

| Việc | Nhân viên | Quản lý | Chủ |
|---|---|---|---|
| Mở phiếu, gọi món, gửi pha chế, thu tiền | ✅ | ✅ | ✅ |
| Xoá dòng **chưa gửi pha chế** | ✅ *(Claude đề xuất — sửa gõ nhầm)* | ✅ | ✅ |
| Huỷ dòng **đã gửi**, giảm tay, thu phiếu 0đ | cần PIN QL/Chủ | ✅ (vẫn ghi lý do) | ✅ |
| Huỷ hoá đơn **đã thu** (hoàn kho, ghi âm doanh thu ngày huỷ) | cần PIN QL/Chủ | ✅ | ✅ |
| Nhập hàng, đếm kiểm kê | ✅ | ✅ | ✅ |
| Xem chênh lệch kiểm kê | ❌ *(Claude đề xuất: đếm "mù", không thấy số đáng lẽ còn → khó lấp số)* | ✅ | ✅ |
| Sửa menu, giá, khuyến mãi, voucher, giá ngồi thêm | ❌ | ❌ | ✅ |
| Báo cáo tiền | ❌ | ✅ | ✅ |

PIN kiểm ở máy chủ (hàm duyệt nhận PIN, so băm, sai 5 lần khoá PIN người đó 5 phút). Mỗi lần duyệt ghi vào `approvals`.

### 6.5 Kho

- **Số đáng lẽ còn** = số đếm lần kiểm kê gần nhất + nhập − bán + hoàn kể từ đó (hàng chưa kiểm kê lần nào: bắt đầu từ 0).
- Bán: khi phiếu thu xong, mỗi dòng món có gắn hàng kho → trừ SL; combo → trừ theo thành phần đã chọn.
- Kiểm kê: nhân viên chọn "Kiểm kê" → nhập số đếm từng hàng (có thể đếm một phần) → lưu; QL/Chủ thấy chênh lệch và tổng theo lần đếm.
- Không chặn bán khi kho âm (chỉ hiện số âm cho QL/Chủ).

### 6.6 In

- In qua một khung ẩn trong trang + lệnh in của trình duyệt; mẫu in rộng theo khổ giấy cài đặt, chữ đậm, không ảnh.
- **Phiếu pha chế:** box, giờ, các dòng mới gửi (tên, SL, ghi chú), người gửi. Có dòng "GỌI THÊM" nếu không phải lần đầu.
- **Hoá đơn:** tên quán, box, giờ vào – ra, thời gian ngồi, các dòng, giảm (ghi tên khuyến mãi / voucher / "giảm tay"), ngồi thêm N giờ × giá, tổng, đã trả từng hình thức, tiền thối, dòng chân. In lại được (ghi "IN LẠI").
- Hướng dẫn tạo biểu tượng Chrome in thẳng cho máy quầy (Windows / Mac) trong README.

### 6.7 Màn hình *(Claude đề xuất)*

- **Bảng box:** ô box đang ngồi hiện thêm **tổng tiền tạm**; bấm vào → khung box có nút **Gọi món**, **Thanh toán & khách về** (thay nút "Khách về" cũ khi bật bán hàng).
- **Màn gọi món (máy tính):** trái = lưới nút món theo nhóm + ô tìm; phải = phiếu của box (dòng đã gửi / chưa gửi, tổng tạm), nút **Gửi pha chế**. Phím tắt: gõ tên món + Enter.
- **Màn thanh toán:** danh sách dòng, ngồi thêm, ô voucher, nút Giảm tay (PIN), ô chia tiền mặt / chuyển khoản, tiền khách đưa → tiền thối, nút **Thu tiền & in**.
- **Tab mới "Kho":** tồn (QL/Chủ), Nhập hàng, Kiểm kê, lịch sử.
- **Cài đặt thêm:** Menu (thêm/sửa, nhập Excel KiotViet), Khuyến mãi, Voucher, giá ngồi thêm, máy in, PIN của tôi.
- **Báo cáo thêm:** doanh thu theo ngày (tiền mặt / chuyển khoản / tổng), theo món, tiền ngồi thêm, giảm–huỷ (ai duyệt, lý do), voucher đã dùng, chênh lệch kiểm kê.

### 6.8 Nhập menu từ KiotViet

Nhận file Excel "Hàng hoá" xuất từ KiotViet → đọc trong trình duyệt → xem trước → chọn cột Tên / Nhóm / Giá → nhập (trùng tên thì cập nhật giá). Thư viện đọc Excel tải từ CDN cố định phiên bản. Cần anh gửi **một file mẫu** (để ngoài kho mã) để khớp tên cột.

### 6.9 Kiểm tra

- Hàm thuần (jsc): tổng phiếu, thứ tự giảm, khuyến mãi theo giờ/ngày, voucher (hạn, số lần, tối thiểu), chia tiền & tiền thối, tách bill, món tối thiểu, số đáng lẽ còn.
- Lớp lưu chạy thử: luồng thu tiền một lệnh (phiếu + lượt + kho), quyền + PIN, huỷ hoá đơn hoàn kho.
- Giao diện (Chrome ẩn): gọi món → gửi pha chế (kiểm nội dung in) → thanh toán chia 2 hình thức → hoá đơn; giảm tay bị chặn khi không PIN; kiểm kê mù.
- SQL: `kiem_tra_02.sql` (thu hai lần cùng phiếu → chỉ một lần thành công; PIN sai; tổng khoản trả ≠ tổng phiếu bị chặn).

### 6.10 Chuyển đổi (khi anh duyệt bản chạy thử)

1. Đưa web lên máy chủ thật (các bước ở `tai_lieu/BAN_GIAO.md`) + chạy `02_tinh_tien_kho.sql`.
2. Nhập menu từ Excel KiotViet, cài giá ngồi thêm, tạo PIN cho QL/Chủ, nhập tồn đầu bằng một lần kiểm kê.
3. **Chạy song song 1 tuần:** bán trên web mới, KiotViet giữ để đối chiếu / dự phòng. Cuối mỗi ngày so tổng doanh thu.
4. Đủ 1 tuần không lỗi → ngừng gia hạn KiotViet.

## 7. Để lại cho người làm

Bố cục chi tiết các màn, tên hàm / bảng cụ thể, cách chia tệp; mẫu in cụ thể; cách đọc Excel. Giữ nguyên các quy tắc và bài thử của web box. Chuyển 2 tài liệu cũ `docs/superpowers/` sang `tai_lieu/superpowers/` *(Claude đề xuất — tránh lộ trên web công khai)*.

## 8. Câu hỏi chờ anh Tiến

Đã hỏi và anh trả lời (19/11):
- **Combo:** khách tự chọn món trong combo → ô chọn (mục 6.2).
- **Cộng dồn khuyến mãi:** chỉ 1 khuyến mãi, lấy cái lợi hơn cho khách (mục 6.3 quy tắc 3).

Còn mở, không chặn việc làm: khổ giấy thật (cài đặt, xem tem máy in); file Excel mẫu từ KiotViet (để khớp cột nhập menu); giá ngồi thêm / giờ (Chủ tự cài).

**Các điểm Claude tự đề xuất (anh xem giúp):** trả chung các box cùng phiếu đặt; xoá dòng chưa gửi pha chế không cần PIN; đếm kiểm kê "mù" với nhân viên; món tối thiểu chỉ nhắc, không chặn; nhắc "chưa gọi món" sau 10 phút; tách bill thì tiền ngồi thêm ở phiếu thu cuối; huỷ hoá đơn đã thu thì ghi âm vào ngày huỷ; PIN sai 5 lần khoá 5 phút; không làm tròn nghìn; khổ giấy mặc định 80mm; thêm vai trò Quản lý; chuyển tài liệu cũ khỏi `docs/`.
