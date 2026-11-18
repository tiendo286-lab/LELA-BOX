# Thiết kế: Web đặt box theo giờ — Lela Box

Ngày: 19/11/2026 · Người quyết định: anh Tiến (chủ quán, không phải lập trình viên)

## 1. Vì sao làm

Lela Box cho thuê **box theo giờ**. Khách chủ yếu nhắn hỏi qua **TikTok** (ngoài ra Facebook, Zalo). Hiện chưa có chỗ chung để ghi lịch đặt, nên dễ **đặt chồng giờ** cùng một box và dễ quên khách đã đặt.

Mục tiêu dài hạn của anh Tiến có hai phần:
1. **Trả lời tin nhắn nhanh, không sót** (gom TikTok / Facebook / Zalo về một chỗ).
2. **Ghi lại khách đặt box**, không chồng giờ.

Bản này chỉ làm **phần 2**. Phần 1 tạm dùng phần mềm có sẵn (Pancake: đối tác chính thức TikTok ở Việt Nam, nối được TikTok ngay) hoặc làm sau, khi xin được quyền tin nhắn từ TikTok (xem mục 4).

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu (bản đầu):**
- Nhân viên mở trên điện thoại, xem ngay box nào trống giờ nào trong ngày.
- Tạo phiếu đặt box trong dưới 30 giây khi đang chat với khách.
- **Không thể** lưu hai phiếu còn hiệu lực trùng giờ trên cùng một box — chặn ở cả web lẫn máy chủ.
- Tìm khách cũ theo số điện thoại hoặc tên TikTok, thấy các lần đặt trước.

**Không làm trong bản đầu:**
- Tiền (giá, cọc, thanh toán) — anh chọn "chưa cần tiền"; tiền vẫn tính ở quầy.
- Khách tự đặt online — chỉ nhân viên tạo phiếu.
- Gom tin nhắn, nối TikTok / Facebook / Zalo.
- Nối với web Milano hiện có (anh chọn web riêng hoàn toàn).
- Nhắc lịch tự động cho khách.

**Thất bại nếu (dù chạy được):**
- Vẫn lọt được hai phiếu chồng giờ (ví dụ hai nhân viên bấm cùng lúc).
- Trên điện thoại phải kéo ngang, chữ nhỏ, bấm nhầm ô — nhân viên quay về ghi sổ tay.
- Tạo phiếu mất nhiều bước hơn ghi sổ tay.

## 3. Ràng buộc

- Người dùng: Chủ và nhân viên quầy Lela Box; chủ yếu dùng **điện thoại (390px)**.
- Tiếng Việt, ngôn ngữ đơn giản, giờ Việt Nam (UTC+7).
- Web riêng: **kho mã mới + máy chủ Supabase mới**. Hai tài khoản này anh Tiến tự tạo (chưa có) → **đêm 19/11 chỉ làm bản chạy thử trên máy**, không đụng máy chủ thật / web thật / web Milano. Sáng anh duyệt rồi mới đưa lên.
- Nếu kho mã để công khai (như Milano): không đưa lên khoá bí mật, dữ liệu thật, tên nhân viên thật.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| **1. Pancake cho tin nhắn + tự làm web đặt box** ✅ *anh chọn đi trước* | Nhân viên chat trong Pancake, mở web Lela để xem lịch / tạo phiếu | TikTok dùng được ngay; web đặt box nhỏ, làm nhanh | Mở 2 chỗ; phí Pancake hằng tháng |
| 2. Tự làm hết (hộp thư + đặt box một màn hình) | Web tự nối TikTok/FB/Zalo | Một màn hình, không phí tháng | Phải xin TikTok duyệt Business Messaging API (đang chạy thử, không rõ thời gian), Meta duyệt, Zalo OA; khối lượng tính bằng tháng |
| Đặt box trong web Milano | Thêm mục vào web đang chạy | Dùng lại đăng nhập, nhân viên, sao lưu | Anh chọn không — muốn web riêng |

Hướng đi: làm web đặt box (bản này) → song song anh nộp đơn TikTok → khi được duyệt thì gắn hộp thư vào web này, phần đặt box giữ nguyên.

## 5. Phần anh Tiến đã quyết

- Web **riêng hoàn toàn**.
- **Chỉ nhân viên** tạo phiếu.
- **Chưa ghi tiền.**
- Đêm nay: **làm + chạy thử trên máy, sáng anh duyệt**; không đưa lên thật.

## 6. Thiết kế (đề xuất của Claude — anh sửa được)

### 6.1 Công nghệ *(Claude chọn)*
Cùng kiểu với web Milano để anh và các phiên AI quen tay: web tĩnh (HTML + JavaScript thuần, định tuyến `#/...`), chạy GitHub Pages; máy chủ Supabase (Postgres + đăng nhập). Bảng bật RLS, web chỉ gọi hàm `app_*`.

Vì đêm nay chưa có Supabase: lớp dữ liệu có **hai bản cắm**:
- `local`: lưu trong trình duyệt, kèm dữ liệu mẫu (để chạy thử đêm nay và để sáng anh bấm thử).
- `supabase`: gọi hàm `app_*`. Viết sẵn tệp SQL; sáng anh tạo dự án Supabase thì chạy tệp đó và đổi một dòng cấu hình.
Cả hai bản cắm dùng chung một bộ quy tắc chống trùng giờ ở web; máy chủ có thêm chốt chặn riêng (6.4).

### 6.2 Vai trò
- **Chủ**: mọi quyền + cài đặt (box, giờ mở cửa) + quản lý tài khoản nhân viên.
- **Nhân viên**: xem lịch, tạo / sửa / đổi trạng thái / huỷ phiếu, tìm khách.

### 6.3 Màn hình
```
┌ Lela Box ─────────── [Thứ 5, 19/11 ◀ ▶] ┐
│ [Lịch] [Tìm khách] [Cài đặt*]            │
├──────────────────────────────────────────┤
│        Box 1     Box 2     Box 3         │
│ 08:00  ░░░░░░    ░░░░░░    ░░░░░░        │
│ 09:00  ▓ Lan     ░░░░░░    ░░░░░░        │
│ 09:30  ▓ 2 ng    ░░░░░░    ▓ @minh.tt    │
│ 10:00  ░░░░░░    ░░░░░░    ▓             │
│ ...                       (*chỉ Chủ)     │
│                    [ + Đặt box ]         │
└──────────────────────────────────────────┘
```
- **Lịch ngày**: lưới giờ × box, bước 30 phút. Ô trống bấm → mở phiếu mới đã điền sẵn box + giờ. Ô đã đặt bấm → xem / sửa phiếu. Trên điện thoại nếu nhiều box quá chiều ngang thì **xem từng box một** (chọn box ở trên) hoặc danh sách theo giờ — **không kéo ngang trang**.
- **Phiếu đặt box**: tên khách*, số điện thoại, tên TikTok / kênh liên hệ (TikTok / Facebook / Zalo / Gọi / Đến trực tiếp), box*, ngày*, giờ bắt đầu* – giờ kết thúc*, số người, ghi chú. Khi đang gõ đã báo ngay nếu trùng ("Trùng với phiếu của Lan, Box 1, 09:00–11:00").
- **Trạng thái phiếu**: Đã đặt → Đã đến → Xong; hoặc Huỷ / Không đến. Phiếu Huỷ / Không đến **không giữ giờ** nữa. Trên lịch tô màu theo trạng thái.
- **Tìm khách**: gõ số điện thoại hoặc tên TikTok / tên → danh sách khách → các lần đặt (gần nhất trước), số lần không đến.
- **Cài đặt (Chủ)**: danh sách box (tên, sức chứa, đang dùng / ngừng, thứ tự), giờ mở – đóng cửa, thời gian dọn giữa 2 lượt (mặc định 0 phút). Box ngừng dùng ẩn khỏi lịch nhưng phiếu cũ vẫn còn.
- **Nhật ký** trong mỗi phiếu: ai tạo / sửa / đổi trạng thái, lúc nào.

### 6.4 Quy tắc chống trùng
- Hai phiếu **còn hiệu lực** (Đã đặt / Đã đến / Xong) trên **cùng box** trùng nhau nếu `bắt_đầu_A < kết_thúc_B + dọn` và `bắt_đầu_B < kết_thúc_A + dọn`. Kết thúc 10:00 và bắt đầu 10:00 **không** trùng (khi dọn = 0).
- Kết thúc phải sau bắt đầu; giờ phải nằm trong giờ mở cửa; tối thiểu 30 phút; theo bước 30 phút. Không cho đặt qua đêm (bản đầu).
- Máy chủ: ràng buộc loại trừ của Postgres (`EXCLUDE USING gist (box_id WITH =, tsrange(...) WITH &&) WHERE (trạng thái còn hiệu lực)`) → hai người bấm cùng lúc thì một người bị từ chối, web báo "Vừa có người đặt giờ này, tải lại lịch". Thời gian dọn được tính vào khoảng giữ chỗ.
- Bản cắm `local`: kiểm tra cùng quy tắc trước khi lưu.

### 6.5 Dữ liệu (máy chủ)
- `boxes` (id, tên, sức chứa, đang_dùng, thứ_tự)
- `settings` (giờ mở, giờ đóng, phút dọn)
- `customers` (id, tên, sđt, tên_tiktok, ghi_chú) — gộp theo sđt nếu có
- `bookings` (id, box_id, customer_id, bắt_đầu, kết_thúc, số_người, kênh, trạng_thái, ghi_chú, người_tạo, lúc_tạo)
- `booking_log` (booking_id, ai, lúc, việc, dữ_liệu_cũ/mới)
- `staff` (gắn tài khoản đăng nhập Supabase, vai trò Chủ / Nhân viên)
Hàm web gọi: `app_lich_ngay`, `app_phieu_luu`, `app_phieu_trang_thai`, `app_khach_tim`, `app_cai_dat_luu`, `app_box_luu`.

### 6.6 Kiểm tra (đêm nay)
- Bài thử logic chống trùng (các ca biên: chạm mép, dọn > 0, phiếu huỷ, sửa phiếu không tự trùng với chính nó, ngoài giờ mở cửa).
- Bài thử trình duyệt chạy với bản cắm `local`: tạo / sửa / huỷ / đổi trạng thái / tìm khách / cài đặt; vai Chủ và Nhân viên; khung 390px không tràn ngang.
- Tệp SQL: kiểm tra cú pháp bằng đọc soát (máy không có Postgres); sáng chạy thử thật trong khối tự hoàn tác trước khi chạy thật.

### 6.7 Quyết định sau vòng đọc thử *(Claude chọn, đánh dấu để anh xem)*
- **Giờ đóng cửa qua nửa đêm (đang hỏi anh Tiến):** làm sẵn để chạy được cả hai trường hợp. Một "ngày làm việc" tính từ giờ mở đến giờ đóng. Nếu giờ đóng ≤ giờ mở (ví dụ mở 08:00, đóng 01:00) thì giờ đóng thuộc sáng hôm sau. Phiếu thuộc ngày làm việc đó. Ở web, giờ tính bằng **số phút kể từ 00:00 của ngày làm việc** (có thể > 1440). Ở máy chủ, lưu mốc thời gian đầy đủ. Như vậy "không đặt qua đêm" nghĩa là không vượt qua giờ đóng cửa.
- **Nhận diện khách:** khách trùng nếu cùng số điện thoại (bỏ dấu cách / dấu chấm) hoặc cùng tên TikTok (bỏ `@`, không phân biệt hoa thường). Ô "tên khách" trong phiếu gợi ý khách cũ ngay khi gõ, theo tên / sđt / TikTok. Chọn khách cũ thì phiếu gắn với khách đó. Sửa tên / sđt / TikTok trong phiếu là sửa thông tin khách (mọi phiếu của khách đó thấy tên mới). Gõ sđt hoặc TikTok trùng khách khác thì web hỏi "Đây là khách X?", không tự gộp.
- **Đăng nhập:** mỗi người một tài khoản riêng, để nhật ký có ý nghĩa. Bản đầu: Chủ tạo tài khoản trong trang quản trị Supabase, rồi vào **Cài đặt › Nhân viên** gán vai trò theo email. Chưa làm chức năng tạo tài khoản ngay trong web. Ở bản chạy thử trên máy, màn hình đăng nhập chỉ cần chọn "Chủ (thử)" / "Nhân viên A (thử)" / "Nhân viên B (thử)".
- **Cách anh bấm thử sáng mai:** bấm đúp tệp `chay_thu.command` → máy chủ nhỏ chạy trên Mac, tự mở trình duyệt. Tệp in ra địa chỉ để mở trên **điện thoại cùng Wi-Fi**. Dữ liệu chạy thử nằm riêng trong từng trình duyệt, nên việc "hai máy đặt cùng lúc bị chặn" chỉ thử được khi đã có máy chủ thật.

## 7. Để lại cho người làm
- Tên hàm, cấu trúc thư mục, màu sắc / giao diện cụ thể (theo phong cách gọn, chữ to, dễ bấm trên điện thoại).
- Dữ liệu mẫu (3 box, khách giả, không dùng tên thật).

## 8. Việc anh Tiến làm vào buổi sáng
1. Xem bản chạy thử, bấm thử, góp ý.
2. Tạo dự án Supabase mới + kho GitHub mới (em hướng dẫn từng bước).
3. Cho biết số box thật, giờ mở cửa thật.
4. Đổi tài khoản TikTok của Lela sang **Doanh nghiệp**, nộp đơn xin Business Messaging API (song song), hoặc dùng thử Pancake.
