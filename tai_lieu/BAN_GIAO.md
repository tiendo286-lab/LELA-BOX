# Bàn giao — web quản lý box Lela

Cập nhật: 19/11/2026 (phiên đầu tiên).

## Tình trạng

- **Bản chạy thử trên máy đã xong và đạt toàn bộ bài thử.** Dữ liệu nằm trong trình duyệt, chưa có máy chủ thật, chưa đưa lên mạng.
- Nhánh `dat-box` trong kho Git riêng ở `~/Lela Box`. Kho chưa có bản trên GitHub.
- Tệp máy chủ `supabase/01_khoi_tao.sql` đã viết nhưng **chưa chạy lần nào**, vì máy không có Postgres. Lần đầu phải chạy thử kèm `supabase/kiem_tra_01.sql` (tự hoàn tác) trước khi chạy thật.

## Đã kiểm

- Hàm thuần: `kiem_tra/chay_jsc.sh` gồm giờ, đồng hồ, quy tắc, bảng box / nhắc việc, lưu chạy thử, báo cáo, bản máy chủ. Tất cả đạt.
- Giao diện: `kiem_tra/chay_het.sh` chạy 11 bài trên Chrome ẩn (Nhân viên / Chủ, máy tính / khung điện thoại 390px). Tất cả đạt, không tràn ngang, không có chữ lạ.
- Tệp `chay_thu.command`: mở được trang (mã 200), có in địa chỉ để mở trên điện thoại.

## Quyết định anh Tiến đã chốt

Xem bảng ở mục 5 của bản thiết kế (`docs/superpowers/specs/2026-11-19-dat-box-design.md`). Một số điểm chính:
- 12 box, tối đa 3 người mỗi box.
- Mỗi lần đặt giữ box 3 giờ.
- Miễn phí 3 giờ tính từ lúc khách vào. Được thêm 10 phút, quá thì làm tròn lên từng giờ: 3g10 → 0, 3g11 → 1, 4g01 → 2.
- Khách đến trễ 15 phút thì nhắc.
- Ghi cả khách vãng lai.
- Nhóm đặt 1–3 box trên một phiếu, mỗi box vào / về riêng.

## Việc còn mở

1. Anh Tiến bấm thử, góp ý.
2. Giờ mở / đóng cửa thật. Đang để mẫu 08:00–23:00, Chủ sửa được trong Cài đặt.
3. Đưa lên dùng thật (các bước ở dưới).
4. Gom tin nhắn TikTok / Facebook / Zalo: chưa làm. Hướng đi: dùng Pancake trước, hoặc nộp đơn xin TikTok cho dùng tin nhắn (Business Messaging API), sau này gắn vào web này.

## Đưa lên dùng thật (khi anh đồng ý)

1. **Tạo dự án Supabase mới** (supabase.com › New project, vùng Singapore). Ghi lại *Project URL* và *anon public key*. Hai giá trị này được phép để trong web. **Không** dùng khoá `service_role`.
2. **Chạy SQL:** gửi `01_khoi_tao.sql` + `kiem_tra_01.sql` cùng một lần, xem dòng `REPORT>>` đúng như mong đợi. Sau đó mới gửi riêng `01_khoi_tao.sql` để chạy thật.
3. **Tạo Chủ đầu tiên:** vào Authentication › Users › *Add user*, nhập email và mật khẩu của Chủ. Sau đó chạy:
   `insert into staff (email, name, role) values ('<email chủ>', 'Chủ', 'chu');`
   Các nhân viên khác: tạo tài khoản ở Authentication, rồi Chủ thêm email của họ trong web, mục Cài đặt › Nhân viên.
4. **Sửa `docs/js/config.js`:** `store: 'supabase'`, điền `supabaseUrl` và `anonKey`.
5. **Tạo kho GitHub mới** rồi đẩy lên. Bật GitHub Pages, chọn thư mục `docs/` trên nhánh `main`.
6. Thử lại trên web thật: hai máy cùng đặt một giờ thì một máy phải bị chặn.

## Ghi chú cho phiên AI sau

- Kiểm tra trước khi đẩy: `kiem_tra/chay_het.sh` phải đạt hết. Bài giao diện mới thì thêm vào `kiem_tra/trinh_duyet/danh_sach.txt`.
- Giờ giả lập trong bài thử: `?now=2026-11-19T14:32`. Dữ liệu mẫu tạo quanh giờ này: Box 2 ngồi 2g10, Box 3 ngồi 2g52, Box 6 ngồi 3g20, Box 7 đặt 14:00 đang trễ, Box 4 + 5 đặt 16:30.
- Chrome ẩn không cho cửa sổ hẹp dưới 500px. Muốn chụp hoặc thử khung điện thoại thì đi qua iframe (`test/phone.html`, `kiem_tra/chup.sh`).
- `jsc` không có `URLSearchParams`. Hàm thuần dùng cho cả `jsc` lẫn trình duyệt thì phải tránh nó.
