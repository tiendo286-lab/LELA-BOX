# Bàn giao — web quản lý box Lela

Cập nhật: 19/11/2026 (phiên 2 — thêm tính tiền + kho thay KiotViet).

## Tình trạng

- **Bản chạy thử trên máy đã có đủ: quản lý box + gọi món / thanh toán + hoá đơn (in lại, huỷ, huỷ & thu lại) + kho + báo cáo tiền.** Dữ liệu nằm trong trình duyệt, chưa có máy chủ thật, chưa đưa lên mạng.
- Nhánh: `dat-box` (quản lý box) → `tinh-tien` (tính tiền + kho, làm tiếp từ `dat-box`). Kho Git riêng ở `~/Lela Box`, chưa có bản trên GitHub. Chưa gộp vào `main` — chờ anh Tiến duyệt.
- Anh Tiến chốt (19/11): **web riêng**, không gộp vào web Milano; **thay hẳn KiotViet** ở Lela Box (LLB vẫn chốt ca bên Milano như cũ).
- Tệp máy chủ `supabase/01_khoi_tao.sql` + `02_tinh_tien_kho.sql` đã viết, **chưa chạy lần nào** (máy không có Postgres). Đã soát cú pháp bằng bộ đọc Postgres (pglast) và soát tên hàm / tham số khớp với web. Lần đầu phải chạy thử kèm `kiem_tra_01.sql`, `kiem_tra_02.sql` (tự hoàn tác) trước khi chạy thật.

## Đã kiểm

- Hàm thuần: `kiem_tra/chay_jsc.sh` — giờ, đồng hồ, quy tắc, bảng box / nhắc việc, lưu chạy thử, báo cáo, **tiền** (`money_test`), **kho + đọc file menu** (`stock_test`), **mẫu in** (`print_test`), **bán hàng** (`ban_test`), bản máy chủ. Tất cả đạt.
- Duyệt cuối (người duyệt mới, 19/11): sửa 1 lỗi nghiêm trọng (chưa có chỗ in lại / huỷ hoá đơn) + 4 lỗi quan trọng (huỷ xong không thu lại được; voucher khi trả chung; bấm nhanh mất số lượng; in lại sai giá ngồi thêm).
- Giao diện: `kiem_tra/chay_het.sh` — 25 bài trên Chrome ẩn (Nhân viên / Quản lý / Chủ, máy tính / khung điện thoại 390px), gồm `flow_ban_hang`, `flow_cai_dat_ban`, `flow_kho`, `flow_hoa_don`. (Thỉnh thoảng một bài báo "quá 60 giây" do máy bận — chạy lại bài đó.) Tất cả đạt, không tràn ngang, không có chữ lạ.
- SQL: `kiem_tra/soat_sql.py supabase/*.sql` (cần pglast) — đạt cú pháp.

## Quyết định anh Tiến đã chốt

- Quản lý box: xem mục 5 của `tai_lieu/superpowers/specs/2026-11-19-dat-box-design.md`.
- Tính tiền + kho: xem mục 5 và 8 của `tai_lieu/superpowers/specs/2026-11-19-tinh-tien-kho-design.md`. Chính:
  - Gọi món ở máy tính quầy; trả tiền lúc về (mỗi lượt box một phiếu); tiền mặt / chuyển khoản / chia / tách bill.
  - Giờ ngồi thêm: một giá mỗi giờ mỗi box (Chủ cài, mẫu 20.000đ), tự cộng vào hoá đơn.
  - Combo giá cố định, khách tự chọn món trong combo. Khuyến mãi theo giờ / ngày, voucher, giảm tay. **Chỉ 1 khuyến mãi mỗi hoá đơn** (lấy cái lợi hơn cho khách).
  - Giảm tay / huỷ món đã gửi / huỷ hoá đơn đã thu: chỉ Quản lý / Chủ (nhân viên cần PIN).
  - Bắt buộc gọi món tối thiểu (web nhắc, không chặn). 1 máy in cả hoá đơn + phiếu pha chế; in thẳng từ Chrome.
  - Kho: nhập số lượng, chỉ hàng bán nguyên tự trừ, kiểm kê ra chênh lệch. Không hoá đơn điện tử. Tích điểm, chốt ca: làm sau. Mất mạng: phát Wi-Fi điện thoại.
  - Chuyển đổi: chạy song song với KiotViet 1 tuần rồi mới bỏ.

## Lỗi nhỏ còn để lại (chưa sửa)

Phiên 2 (tính tiền + kho):
- Khung thanh toán ghi tên box cũ sau khi đổi box (hoá đơn in vẫn đúng box mới).
- Huỷ hoá đơn không trả lại lượt dùng của voucher.
- Ô kiểm kê gõ sai (vd "1O") bị bỏ qua, không báo.
- Bỏ chọn hết ngày của khuyến mãi = áp mọi ngày.
- Huỷ món đã gửi pha chế không in phiếu huỷ cho quầy.
- Phím Esc trong hộp PIN đóng luôn khung bên dưới.
- Máy chủ: giá ngồi thêm gửi rỗng → lỗi thô thay vì câu dễ hiểu; xem tiền (quote) có thể hiếm khi kẹt với lệnh thu cùng lúc (Postgres tự gỡ, một bên báo lỗi).
- Combo-only + voucher: báo "Đã áp mã" nhưng giảm 0đ.
- Nhập menu KiotViet chưa cho chọn cột bằng tay (chờ file mẫu).
- Hai quản lý đặt trùng PIN thì duyệt ghi tên người tạo trước.
- Lệch nhỏ bản thử / máy chủ: 2 hàng kho cùng gắn 1 món; mã voucher không tồn tại trên phiếu; hoà giữa 2 khuyến mãi tự động.

Phiên 1:

- Sửa phiếu nhóm đã có box vào rồi: có thể thêm box vượt quá 3 cho cả phiếu.
- Bản chạy thử cho khách vào box đang tạm ngừng (máy chủ thì chặn).
- Đăng xuất / đăng nhập nhiều lần trong bản chạy thử: nút chọn người bị gắn sự kiện lặp.
- Cài đặt › Nhân viên: dòng mới bấm Lưu 2 lần sẽ tạo trùng nhân viên.
- Sửa phiếu có ngày ngoài 7 ngày tới: ô ngày tự chọn hôm nay.
- Bấm nhắc việc của box tạm ngừng: chưa chặn.
- Hàm máy chủ nên đặt `search_path = public, pg_temp` để an toàn hơn.

## Việc còn mở

1. Anh Tiến bấm thử (Chủ / Quản lý / Nhân viên), góp ý.
2. **Gửi file Excel "Hàng hoá" xuất từ KiotViet** (để ngoài kho mã) để khớp tên cột khi nhập menu. Đọc file .xlsx dùng thư viện SheetJS tải từ mạng — chưa thử với file thật.
3. Khổ giấy máy in thật (xem tem máy in), giá ngồi thêm thật, giờ mở / đóng cửa thật.
4. Đưa lên dùng thật (các bước dưới) rồi chạy song song KiotViet 1 tuần.
5. Sau này: tích điểm khách thân; trang cho khách tự đặt box (link TikTok); gom tin nhắn TikTok / Facebook / Zalo (Pancake hoặc xin TikTok Business Messaging API).

## Đưa lên dùng thật (khi anh đồng ý)

1. **Tạo dự án Supabase mới** (supabase.com › New project, vùng Singapore). Ghi lại *Project URL* và *anon public key* — hai giá trị này được để trong web. **Không** dùng khoá `service_role`.
2. **Chạy SQL:**
   - Gửi `01_khoi_tao.sql` + `02_tinh_tien_kho.sql` + `kiem_tra_01.sql` (rồi một lần khác `01` + `02` + `kiem_tra_02.sql`) — xem dòng `REPORT>>`, đối chiếu từng mục "mong:". Có lỗi thì sửa bằng tệp mới `03_...sql`, không sửa 01/02 nếu đã chạy thật.
   - Đúng hết mới gửi riêng `01_khoi_tao.sql`, rồi `02_tinh_tien_kho.sql` để chạy thật.
   - **Lưu ý:** nếu sau này chạy lại `01` thì phải chạy lại `02` ngay sau (01 ghi đè vài hàm của 02 → mất cài đặt bán hàng, vai trò Quản lý bị từ chối).
3. **Tạo Chủ đầu tiên:** Authentication › Users › *Add user* (email + mật khẩu của Chủ), rồi chạy:
   `insert into staff (email, name, role) values ('<email chủ>', 'Chủ', 'chu');`
   Nhân viên / Quản lý khác: tạo tài khoản ở Authentication, rồi Chủ thêm email trong web (Cài đặt › Nhân viên). Chủ và Quản lý vào Cài đặt › **PIN của tôi** đặt PIN.
4. **Sửa `docs/js/config.js`:** `store: 'supabase'`, điền `supabaseUrl` và `anonKey`.
5. **Tạo kho GitHub mới** rồi đẩy lên. Bật GitHub Pages, chọn thư mục `docs/` trên nhánh `main`.
6. **Chuẩn bị bán:** Cài đặt › Menu › nhập file KiotViet; tạo combo (ô chọn món), khuyến mãi, voucher; giá ngồi thêm; khổ giấy; In thử. Kho › thêm hàng bán nguyên (gắn món) + nguyên liệu; làm một lần **Kiểm kê** để có tồn đầu.
7. **Máy quầy:** tạo biểu tượng Chrome in thẳng (README › Máy in bill).
8. Thử lại trên web thật: hai máy cùng đặt một giờ thì một máy bị chặn; hai máy cùng thu một phiếu thì một máy báo "Phiếu đã thu".
9. **Chạy song song KiotViet 1 tuần**, cuối mỗi ngày so tổng doanh thu. Đủ 1 tuần không lỗi → ngừng gia hạn KiotViet.

## Ghi chú cho phiên AI sau

- Kiểm tra trước khi đẩy: `kiem_tra/chay_het.sh` phải đạt hết. Bài giao diện mới thì thêm vào `kiem_tra/trinh_duyet/danh_sach.txt`. Vai trò thử: `chu`, `ql`, `nv` (`?role=`).
- Giờ giả lập: `?now=2026-11-19T14:32` (Thứ 5 — khuyến mãi mẫu "Giờ vàng 14–17h −20% Trà" đang chạy). Dữ liệu mẫu: Box 2 ngồi 2g10 (3 người, chưa gọi món), Box 3 ngồi 2g52, Box 6 ngồi 3g20, Box 7 đặt 14:00 đang trễ, Box 4 + 5 đặt 16:30. PIN thử: Chủ 1111, Quản lý 2222.
- Bài thử đặt `window.__lelaNoPrint = true` (không mở hộp in); nội dung in ghi vào `window.__lelaPrints`.
- Duyệt PIN trên máy chủ trả `{__error}` thay vì ném lỗi (để giữ bộ đếm sai PIN); `supabase.js` tự đổi thành lỗi.
- Chrome ẩn không cho cửa sổ hẹp dưới 500px → thử khung điện thoại qua iframe (`test/phone.html`, `kiem_tra/chup.sh`).
- `jsc` không có `URLSearchParams`. Hàm thuần dùng chung jsc + trình duyệt phải tránh nó.
- Lệnh shell có `rm`/`rsync --delete` lẫn trong heredoc dài đôi khi bị chặn an toàn → tách lệnh, sửa tệp bằng công cụ Edit.
