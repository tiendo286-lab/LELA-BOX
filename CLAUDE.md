# Hướng dẫn cho AI — web quản lý box Lela

- Chủ: anh Tiến, chủ quán ở Hải Phòng, **không phải lập trình viên**. Trả lời **tiếng Việt đơn giản**, nói rõ đã làm gì, đã kiểm gì, anh cần làm gì.
- Hỏi thật chi tiết trước khi làm tính năng mới; dùng cách tiết kiệm (tự làm, duyệt 1 lần cuối).
- Thiết kế đã chốt + kế hoạch: `tai_lieu/superpowers/specs/`, `tai_lieu/superpowers/plans/` (**không** để trong `docs/` — `docs/` là web công khai). Bàn giao giữa các phiên: `tai_lieu/BAN_GIAO.md`.
- Kiến trúc: web tĩnh trong `docs/` (JS thuần, ES modules, `#/...`, mẫu `html\`\`` trong `docs/js/ui.js` tự thoát ký tự). Logic thuần: `time.js`, `rules.js`, `board.js`, `report.js`, `money.js` (tiền), `stock.js` (kho), `menu_import.js`, mẫu in `print.js`. Dữ liệu qua `docs/js/store/` (bản `local` chạy thử — phần bán hàng ở `local_ban.js`; bản `supabase` khi có máy chủ — chọn ở `docs/js/config.js`). Hàm mới ở bản local phải có hàm cùng tên ở `supabase.js` + `supabase/NN_*.sql`.
- Kiểm tra: `kiem_tra/chay_jsc.sh` (hàm thuần, chạy bằng jsc có sẵn trên Mac); `kiem_tra/chay_chrome.sh <flow> <role> [phone]` (giao diện, Chrome headless). Giờ giả lập bằng `?now=2026-11-19T14:32`.
- Kho mã có thể để công khai: **không** đưa khoá bí mật, mật khẩu, dữ liệu thật, tên nhân viên thật.
- Commit tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp dòng `Co-Authored-By: Claude ...`.
- Vai trò: `chu`, `ql` (Quản lý), `nv`. Việc cần duyệt (huỷ món đã gửi, giảm tay, thu 0đ, huỷ hoá đơn): nhân viên cần PIN của QL/Chủ.
- Tệp SQL mới: thêm `supabase/NN_*.sql` + bài thử tự hoàn tác `kiem_tra_NN.sql`; soát cú pháp bằng `kiem_tra/soat_sql.py` (pglast).
