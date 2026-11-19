# Lela Box — web quản lý box

Web cho nhân viên Lela Box:
- **Bảng box**: 12 box lúc này. Box nào trống, box nào đang có khách và đã ngồi bao lâu, box nào sắp hết 3 giờ miễn phí hoặc đã quá giờ, box nào sắp có khách đặt.
- **Khách vào / về**: bấm vào ô box. Khi khách về, web tự tính giờ ngồi thêm: được 10 phút cho phép, quá thì làm tròn lên từng giờ.
- **Lịch**: đặt trước tối đa 7 ngày, mỗi phiếu 1–3 box. Web không cho đặt trùng giờ.
- **Nhắc việc + chuông**: khách đặt trễ 15 phút, sắp hoặc đã hết 3 giờ, box còn khách mà sắp tới lượt người đặt, quên bấm "Khách về".
- **Khách**: tìm theo SĐT / tên / TikTok, xem các lần đến.
- **Gọi món & thanh toán** (thay KiotViet): bấm box › Gọi món › Gửi pha chế (in phiếu). Khách về: Thanh toán & khách về — web cộng giờ ngồi thêm, áp 1 khuyến mãi lợi nhất / voucher, chia tiền mặt + chuyển khoản, tách bill, in hoá đơn.
- **Giảm tay, huỷ món đã gửi, huỷ hoá đơn**: nhân viên cần Quản lý / Chủ gõ PIN; mọi lần duyệt có trong Báo cáo.
- **Kho**: nhập hàng, hàng bán nguyên tự trừ khi bán, kiểm kê (nhân viên đếm không thấy số máy; Quản lý / Chủ thấy chênh lệch).
- **Báo cáo** (Chủ, Quản lý): doanh thu theo ngày, bán theo món, giảm–huỷ, lượt khách, giờ cao điểm, giờ ngồi thêm.

## Bấm thử ngay (chưa cần máy chủ)

1. Bấm đúp tệp **`chay_thu.command`**. Lần đầu, nếu Mac hỏi thì chọn *Mở*.
2. Trình duyệt tự mở web. Chọn "Chủ (thử)", "Quản lý (thử)" hoặc "Nhân viên A (thử)" để vào. PIN thử: Chủ **1111**, Quản lý **2222**.
3. Muốn thử trên điện thoại: mở địa chỉ `http://…:8800` mà cửa sổ đen ghi ra. Điện thoại phải dùng cùng Wi-Fi với máy Mac.
4. Dữ liệu là **khách giả**, lưu riêng trong từng trình duyệt. Muốn làm lại từ đầu thì thêm `?reset=1` vào cuối địa chỉ.

Lưu ý: chuông chỉ kêu sau khi anh đã chạm vào trang một lần (trình duyệt bắt buộc như vậy).

## Máy in bill ở quầy

Web in qua trình duyệt Chrome. Để bấm "In" là ra giấy ngay (không hiện hộp hỏi):
1. Cắm máy in bill vào máy tính quầy, cài driver của hãng, đặt nó làm **máy in mặc định**.
2. Tạo biểu tượng Chrome riêng cho quầy:
   - **Windows**: chuột phải biểu tượng Chrome › Properties › ô *Target*, thêm vào cuối ` --kiosk-printing` (có dấu cách phía trước), rồi mở web từ biểu tượng này.
   - **Mac**: mở Terminal, gõ `open -na "Google Chrome" --args --kiosk-printing` rồi mở web trong cửa sổ Chrome vừa bật.
3. Vào **Cài đặt › Bán hàng và hoá đơn**, chọn đúng khổ giấy (80mm hoặc 58mm), bấm **In thử hoá đơn**.

## Đưa lên dùng thật

Xem `tai_lieu/BAN_GIAO.md`, mục "Đưa lên dùng thật".

## Dành cho người sửa mã

- Thiết kế + kế hoạch: `tai_lieu/superpowers/specs/`, `tai_lieu/superpowers/plans/` (không để trong `docs/` vì `docs/` là web công khai).
- Soát cú pháp SQL (cần pglast: `python3 -m venv v && v/bin/pip install pglast`): `v/bin/python kiem_tra/soat_sql.py supabase/*.sql`.
- Kiểm tra toàn bộ: `kiem_tra/chay_het.sh`. Gồm hàm thuần chạy bằng `jsc` có sẵn trên Mac, và giao diện chạy bằng Chrome ẩn, thử cả khung điện thoại 390px.
- Chụp màn hình: `kiem_tra/chup.sh "#/bang" anh.png 390 844 chu`.
