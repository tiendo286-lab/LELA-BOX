# Thiết kế: Web quản lý box — Lela Box

Ngày: 19/11/2026 (bản 2, sau buổi hỏi chi tiết) · Người quyết định: anh Tiến (chủ quán, không phải lập trình viên)

## 1. Vì sao làm

Lela Box có **12 box giống nhau, mỗi box tối đa 3 người**. Box **miễn phí 3 giờ đầu** khi khách gọi đồ hoặc dùng combo; quá 3 giờ **tính thêm theo giờ (làm tròn lên từng giờ)**. Khách chủ yếu nhắn hỏi qua **TikTok** (ngoài ra Facebook, Zalo) rồi đặt trước; cũng có nhiều khách vãng lai.

Hiện chưa có chỗ chung để biết **box nào đang có khách, ngồi bao lâu rồi, box nào sắp có khách đặt** → dễ đặt chồng, dễ quên tính giờ thêm, khó trả lời khách nhanh "giờ đó còn box không".

Mục tiêu dài hạn của anh Tiến: (1) trả lời tin nhắn nhanh, không sót; (2) ghi lại khách đặt box. Bản này làm **phần 2** (mở rộng thành quản lý box). Phần 1 tạm dùng Pancake (đối tác chính thức TikTok ở Việt Nam) hoặc làm sau khi xin được quyền tin nhắn TikTok.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu (bản đầu):**
- Nhìn một màn hình biết ngay tình trạng 12 box **lúc này**.
- Khách nhắn hỏi "15:00 mai còn box không?" → trả lời trong vài giây; tạo phiếu đặt dưới 30 giây.
- Cho khách vào / ra box bằng 1–2 lần bấm; web tự đếm giờ, báo quá 3 giờ và số giờ tính thêm khi khách về.
- **Không thể** lưu hai lượt chồng giờ trên cùng box (chặn ở web và máy chủ).
- Nhắc nhân viên (trên web + chuông) các việc cần làm đúng lúc.
- Chủ xem số lượt khách / ngày, giờ cao điểm, giờ ngồi thêm.

**Không làm trong bản đầu:** tiền (giá, cọc, thu tiền — tiền vẫn tính ở quầy); khách tự đặt online; gom tin nhắn / nối TikTok-Facebook-Zalo; nối web Milano; thông báo đẩy về điện thoại khi đã tắt web; nhắc khách qua tin nhắn.

**Thất bại nếu (dù chạy được):**
- Lọt hai lượt chồng giờ cùng box (kể cả hai máy bấm cùng lúc).
- Bảng box báo "Trống" trong khi box đang có khách (vì quên ghi khách vãng lai hoặc quên bấm "Khách về") mà không có gì nhắc.
- Trên điện thoại phải kéo ngang / chữ nhỏ / bấm nhầm → nhân viên bỏ, quay về nhớ đầu.
- Đếm sai giờ ngồi thêm → thu sai tiền khách.

## 3. Ràng buộc

- Người dùng: Chủ + nhân viên (một ca vài người). Dùng **cả máy chung ở quầy (màn hình to)** và **điện thoại riêng** (khi đang chat TikTok). Mỗi người một tài khoản; máy quầy cũng đăng nhập theo người.
- **Ai cũng được tạo / sửa / huỷ**, mọi thao tác ghi **nhật ký** (ai, lúc nào, làm gì).
- Đóng cửa **trước nửa đêm** (giờ mở / đóng do Chủ cài). Không có thời gian dọn giữa hai lượt.
- Đặt trước **tối đa 7 ngày**, **không cọc**. Bắt buộc **tên + số điện thoại**.
- Tiếng Việt đơn giản; giờ Việt Nam (UTC+7); khung điện thoại 390px không tràn ngang.
- Web riêng hoàn toàn: **kho mã mới + Supabase mới** (anh Tiến tạo sau). Trước khi có: bản chạy thử trên máy với dữ liệu lưu trong trình duyệt; sáng anh duyệt rồi mới đưa lên. Không đưa khoá bí mật / dữ liệu thật / tên nhân viên thật lên kho mã.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| **1. Pancake cho tin nhắn + tự làm web quản lý box** ✅ *anh chọn* | Nhân viên chat trong Pancake, mở web Lela để xem box / đặt chỗ | TikTok dùng ngay; web box làm nhanh | Mở 2 chỗ; phí Pancake |
| 2. Tự làm hết (hộp thư + box một màn hình) | Web tự nối TikTok/FB/Zalo | Một màn hình, không phí tháng | Phải xin TikTok duyệt API (đang chạy thử, không rõ thời gian), Meta, Zalo OA; nhiều tháng |
| Thêm vào web Milano | Mục mới trong web đang chạy | Dùng lại đăng nhập, nhân viên | Anh chọn không — muốn web riêng |

Hướng đi: làm web quản lý box → song song nộp đơn TikTok → khi được duyệt thì gắn hộp thư vào web này.

## 5. Anh Tiến đã quyết (19/11)

| Việc | Quyết định |
|---|---|
| Nơi làm | Web riêng hoàn toàn |
| Ai tạo phiếu | Chỉ nhân viên (khách không tự đặt) |
| Tiền | Chưa ghi tiền; chỉ **đếm giờ ngồi thêm** |
| Box | 12 box giống nhau, tối đa 3 người/box; khách hay xin **box quen** → chọn được box cụ thể |
| Giờ mở cửa | Đóng trước nửa đêm |
| Giữ box khi đặt | **Mặc định 3 giờ**, nhân viên sửa được |
| Dọn giữa 2 lượt | Không cần |
| 3 giờ miễn phí tính từ | **Lúc khách thực sự vào box** |
| Giờ thêm | **Cho 10 phút sau 3 giờ đầu**, quá thì làm tròn lên từng giờ tính từ mốc 3 giờ |
| Đến muộn | Giữ **15 phút**, quá thì nhắc |
| Khách vãng lai | **Có ghi** lúc vào box |
| Nhóm đông | **Một phiếu giữ được 2–3 box** cùng giờ |
| Box sắp có khách đặt mà khách vãng lai muốn vào | **Báo rõ, vẫn cho vào** (nhân viên quyết) |
| Thiết bị | Cả máy quầy lẫn điện thoại |
| Quyền | Ai cũng tạo / sửa / huỷ được, có nhật ký |
| Thông tin bắt buộc | Tên + SĐT |
| Đặt trước | Tối đa 7 ngày, không cọc |
| Màn hình chính | **Bảng 12 box lúc này** |
| Nhắc việc | Đến muộn 15 phút; sắp / đã hết 3 giờ; box còn khách mà sắp tới lượt đặt |
| Cách nhắc | Hiện trên web + kêu chuông (khi web đang mở) |
| Báo cáo | Lượt khách / ngày; giờ cao điểm; giờ ngồi thêm |
| Chạy đêm 19/11 | Chỉ chạy thử trên máy, sáng anh duyệt |

## 6. Thiết kế

### 6.1 Đường đi của một lượt khách

```
 Khách nhắn TikTok ──► Nhân viên mở tab "Lịch" ──► chọn giờ → thấy box trống
                                                     │
                                                     ▼
                                   Phiếu ĐẶT TRƯỚC (tên + SĐT, 1–3 box, giữ 3 giờ)
                                                     │
            ┌───────────── đến giờ ─────────────────┤
            ▼                                        ▼
   Quá 15 phút chưa đến → NHẮC         Khách đến → bấm "Khách vào"
     ├─ gọi khách / đợi thêm            (bắt đầu đếm 3 giờ miễn phí)
     └─ bấm "Không đến" → nhả box                     │
                                                      ▼
 Khách vãng lai ──► bấm ô box trống ──► "Khách vào"  ĐANG NGỒI
                     (không bắt buộc tên)             │  2g45 → NHẮC "sắp hết 3 giờ"
                                                      │  3g00 → ô đỏ "quá giờ"
                                                      │  box có lượt đặt sau 15' → NHẮC
                                                      ▼
                                          bấm "Khách về" → web hiện
                                          "Ngồi 4g20 → tính thêm 2 giờ"
                                                      ▼
                                                 Box TRỐNG
```

### 6.2 Trạng thái một lượt (một lượt = một khách/nhóm trên một box)

| Trạng thái | Nghĩa | Giữ box? |
|---|---|---|
| `dat` Đã đặt | Phiếu đặt trước, chưa đến | Có (giờ hẹn → giờ hẹn + thời lượng giữ) |
| `ngoi` Đang ngồi | Đã bấm "Khách vào" | Có (giờ vào → nay, và tối thiểu tới giờ vào + 3 giờ khi kiểm trùng) |
| `ve` Đã về | Đã bấm "Khách về" | Không (lưu giờ vào / ra, giờ thêm) |
| `huy` Huỷ | | Không |
| `vang` Không đến | | Không |

Một **phiếu** đặt trước của nhóm gồm 1–3 **lượt** (mỗi box một lượt), chung khách, chung giờ. Huỷ phiếu = huỷ mọi lượt chưa vào. Mỗi lượt vào / về riêng được (nhóm về lệch giờ).

### 6.3 Màn hình *(Claude đề xuất)*

**a) Bảng box (màn hình chính)**
```
┌ Lela Box ──────────── 14:32 · Nv A ┐
│ [Bảng box] [Lịch] [Khách] [Báo cáo*]│
├─────────────────────────────────────┤
│ 🔔 Box 7: Lan (0912…) trễ 17 phút    │  ← dải nhắc, bấm để xử lý
│ 🔔 Box 3 hết 3 giờ lúc 14:40         │
├─────────────────────────────────────┤
│ Trống 5 · Đang ngồi 6 · Sắp đặt 1   │
│ ┌──────┐┌──────┐┌──────┐┌──────┐    │
│ │ 1    ││ 2    ││ 3  ⚠ ││ 4    │    │
│ │Trống ││2g10  ││2g52  ││Trống │    │
│ │      ││3 ng  ││      ││đặt   │    │
│ │      ││      ││      ││16:00 │    │
│ └──────┘└──────┘└──────┘└──────┘    │
│  … 12 ô (điện thoại: 3 cột; máy     │
│  quầy: 4–6 cột)                     │
└─────────────────────────────────────┘
```
- Màu: Trống (trắng) · Đang ngồi (xanh, ghi thời gian đã ngồi) · Sắp hết 3 giờ (vàng) · Quá giờ (đỏ, ghi "+1 giờ") · Ô trống nhưng có lượt đặt trong 3 giờ tới ghi "đặt 16:00".
- Bấm ô **trống** → "Khách vào ngay" (vãng lai; tên / SĐT không bắt buộc; số người) — nếu box có lượt đặt trong vòng 3 giờ tới thì báo "Box 4 có khách đặt 16:00 — chỉ ngồi được 1g28" + gợi ý box trống đủ 3 giờ; vẫn cho vào. Hoặc "Đặt trước box này".
- Bấm ô **có lượt đặt sắp đến** → "Khách vào" (gắn đúng phiếu), "Không đến", "Gọi" (tel:).
- Bấm ô **đang ngồi** → "Khách về" (hiện giờ ngồi + giờ thêm, bấm xác nhận), "Đổi box", "Sửa".
- Bảng tự cập nhật mỗi 30 giây (và ngay sau mỗi thao tác).

**b) Lịch (đặt trước)**
- Chọn ngày (hôm nay → +6 ngày), chọn giờ bắt đầu (bước 30 phút) + thời lượng (mặc định 3 giờ) → web liệt kê **box trống suốt khoảng đó** (ô bấm chọn, chọn được 1–3 box; nhập số người → gợi ý số box = ⌈người/3⌉).
- Bên dưới: lưới giờ × 12 box của ngày đó để nhìn tổng thể (máy quầy); trên điện thoại là danh sách các lượt theo giờ (không kéo ngang).
- Phiếu đặt: tên*, SĐT*, TikTok (không bắt buộc), kênh (TikTok / Facebook / Zalo / Gọi / Trực tiếp), ngày, giờ, thời lượng, box(es), số người, ghi chú. Không gợi ý khách quen khi gõ SĐT (anh Tiến bỏ 19/11); SĐT trùng khách cũ thì phiếu tự gắn vào khách đó, tên mới ghi đè nếu nhân viên sửa.

**c) Khách**: tìm theo SĐT / tên / TikTok → thẻ khách (số lần đến, lần không đến, box hay ngồi, các lượt gần nhất), nút "Đặt cho khách này".

**d) Báo cáo (Chủ)**: chọn ngày / khoảng ngày → (1) số lượt khách / ngày (đặt trước vs vãng lai, số không đến); (2) giờ cao điểm: bảng thứ × giờ, tô đậm theo số box đang dùng trung bình; (3) giờ ngồi thêm: tổng theo ngày + danh sách từng lượt có giờ thêm (box, giờ vào, giờ ra, số giờ thêm, nhân viên bấm "Khách về").

**e) Cài đặt (Chủ)**: giờ mở / đóng; thời lượng giữ mặc định (3 giờ); giờ miễn phí (3 giờ); phút giữ khi đến muộn (15); số người tối đa / box (3); danh sách box (tên, đang dùng / tạm ngừng); nhân viên (tên, email, vai trò).

### 6.4 Quy tắc

- **Chống trùng**: hai lượt cùng box chồng nhau nếu khoảng giữ box giao nhau (`a.từ < b.đến && b.từ < a.đến`; chạm mép không trùng). Khoảng giữ: `dat` = [hẹn, hẹn + thời lượng]; `ngoi` = [giờ vào, max(nay, giờ vào + thời lượng của phiếu hoặc 3 giờ)].
  - Tạo / sửa **phiếu đặt trước**: chồng với lượt `dat` hoặc `ngoi` → **chặn**, báo rõ lượt nào.
  - **Khách vào** (vãng lai hoặc vào sớm): nếu box đang có người `ngoi` → **chặn**; nếu chỉ vướng lượt `dat` sắp tới → **báo, vẫn cho** (theo quyết định của anh).
- Đặt trước: trong giờ mở cửa; không quá 7 ngày; giờ bắt đầu theo bước 30 phút; không trong quá khứ.
- **Giờ thêm** khi khách về (anh Tiến chốt 19/11): `phút_ngồi = ra − vào`; `giờ_thêm = phút_ngồi ≤ 190 ? 0 : ceil((phút_ngồi − 180) / 60)`. Ví dụ: 3g10 → 0; 3g11 → 1 giờ; 4g00 → 1 giờ; 4g01 → 2 giờ; 5g01 → 3 giờ. (10 phút cho phép chỉ áp dụng sau 3 giờ đầu.) Ô box chuyển đỏ "quá giờ" khi quá 3g10.
- **Nhắc** (tính trên máy đang mở web, chuông một lần mỗi nhắc mới, bấm "Đã xem" để tắt; nhắc còn hiện tới khi xử lý xong):
  - Lượt `dat` quá giờ hẹn 15 phút mà chưa vào.
  - Lượt `ngoi` còn 15 phút hết 3 giờ; và khi đã quá 3 giờ.
  - Box có lượt `ngoi` mà lượt `dat` kế tiếp của box đó còn ≤ 15 phút.
- **Khách về lúc quên bấm**: lượt `ngoi` qua giờ đóng cửa → nhắc "Box 5 chưa bấm Khách về"; Chủ / nhân viên sửa được giờ ra (ghi nhật ký).
- **Khách**: nhận diện theo SĐT (bỏ dấu cách, chấm; `+84` → `0`); không tự gộp, chỉ gợi ý.

### 6.5 Công nghệ *(Claude chọn)*
Giống web Milano: web tĩnh HTML + JS thuần (ES modules, định tuyến `#/...`, `html\`\`` tự thoát), GitHub Pages; Supabase (Postgres + đăng nhập), bảng bật RLS, web chỉ gọi hàm `app_*`; chặn trùng ở máy chủ bằng ràng buộc loại trừ (`EXCLUDE USING gist`) trên khoảng giữ box của lượt `dat`, và kiểm tra trong hàm cho lượt `ngoi`. Lớp dữ liệu hai bản cắm: `local` (trình duyệt, chạy thử) và `supabase`. Tệp `chay_thu.command` để anh bấm thử trên Mac / điện thoại cùng Wi-Fi.

### 6.6 Kiểm tra
- Hàm thuần (chạy bằng `jsc`): chống trùng, khoảng giữ box, giờ thêm (3g00 / 3g01 / 4g00 / 4g01), nhắc việc theo giờ giả lập, chuẩn hoá SĐT, gợi ý số box.
- Trình duyệt (Chrome headless, giờ giả lập): bảng box các trạng thái; khách vãng lai vào / về; đặt phiếu nhóm 2 box; trùng bị chặn; vướng lượt đặt → báo nhưng cho vào; nhắc + "Đã xem"; báo cáo; vai Chủ / Nhân viên; máy tính và khung 390px không tràn ngang.
- SQL: đọc soát (máy không có Postgres); khi có Supabase chạy thử trong khối tự hoàn tác trước.

### 6.7 Anh Tiến duyệt các đề xuất (19/11)
- Nhóm đặt chung phiếu, mỗi box vào / về riêng: **đồng ý**.
- Gợi ý khách quen khi gõ SĐT: **bỏ**. Giữ tab **Khách**.
- Giờ thêm: **cho 10 phút sau 3 giờ đầu** (xem 6.4).
- Đổi box, nhắc quên bấm "Khách về", tự cập nhật 30 giây, bảng giờ cao điểm thứ × giờ: anh không phản đối → giữ.

## 7. Để lại cho người làm
Tên hàm, cấu trúc thư mục, màu cụ thể, âm chuông (tạo bằng Web Audio, không cần tệp), dữ liệu mẫu (12 box, khách giả).

## 8. Việc anh Tiến làm sau khi duyệt bản chạy thử
1. Bấm thử, góp ý.
2. Tạo dự án Supabase mới + kho GitHub mới (có hướng dẫn từng bước).
3. Cho biết giờ mở / đóng thật.
4. Đổi TikTok Lela sang tài khoản Doanh nghiệp; dùng thử Pancake hoặc nộp đơn TikTok Business Messaging API.
