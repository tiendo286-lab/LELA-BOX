# Lela Box — web quản lý box

Web cho nhân viên Lela Box:
- **Bảng box**: 12 box lúc này. Box nào trống, box nào đang có khách và đã ngồi bao lâu, box nào sắp hết 3 giờ miễn phí hoặc đã quá giờ, box nào sắp có khách đặt.
- **Khách vào / về**: bấm vào ô box. Khi khách về, web tự tính giờ ngồi thêm: được 10 phút cho phép, quá thì làm tròn lên từng giờ.
- **Lịch**: đặt trước tối đa 7 ngày, mỗi phiếu 1–3 box. Web không cho đặt trùng giờ.
- **Nhắc việc + chuông**: khách đặt trễ 15 phút, sắp hoặc đã hết 3 giờ, box còn khách mà sắp tới lượt người đặt, quên bấm "Khách về".
- **Khách**: tìm theo SĐT / tên / TikTok, xem các lần đến.
- **Báo cáo** (chỉ Chủ): lượt khách mỗi ngày, giờ cao điểm, giờ ngồi thêm.

## Bấm thử ngay (chưa cần máy chủ)

1. Bấm đúp tệp **`chay_thu.command`**. Lần đầu, nếu Mac hỏi thì chọn *Mở*.
2. Trình duyệt tự mở web. Chọn "Chủ (thử)" hoặc "Nhân viên A (thử)" để vào.
3. Muốn thử trên điện thoại: mở địa chỉ `http://…:8800` mà cửa sổ đen ghi ra. Điện thoại phải dùng cùng Wi-Fi với máy Mac.
4. Dữ liệu là **khách giả**, lưu riêng trong từng trình duyệt. Muốn làm lại từ đầu thì thêm `?reset=1` vào cuối địa chỉ.

Lưu ý: chuông chỉ kêu sau khi anh đã chạm vào trang một lần (trình duyệt bắt buộc như vậy).

## Đưa lên dùng thật

Xem `tai_lieu/BAN_GIAO.md`, mục "Đưa lên dùng thật".

## Dành cho người sửa mã

- Thiết kế: `docs/superpowers/specs/2026-11-19-dat-box-design.md`. Kế hoạch: `docs/superpowers/plans/`.
- Kiểm tra toàn bộ: `kiem_tra/chay_het.sh`. Gồm hàm thuần chạy bằng `jsc` có sẵn trên Mac, và giao diện chạy bằng Chrome ẩn, thử cả khung điện thoại 390px.
- Chụp màn hình: `kiem_tra/chup.sh "#/bang" anh.png 390 844 chu`.
