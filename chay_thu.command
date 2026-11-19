#!/bin/bash
# Bấm đúp tệp này để mở bản chạy thử web Lela Box trên máy Mac (và điện thoại cùng Wi-Fi).
# Dữ liệu chạy thử lưu trong từng trình duyệt; không đụng máy chủ thật.
cd "$(dirname "$0")/docs" || exit 1
PORT=8800
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
echo ""
echo "  Web Lela Box (bản chạy thử) đang chạy."
echo "  • Trên máy này:      http://127.0.0.1:$PORT"
[ -n "$IP" ] && echo "  • Trên điện thoại:   http://$IP:$PORT   (điện thoại phải cùng Wi-Fi)"
echo "  • Muốn làm lại từ đầu với dữ liệu mẫu: thêm ?reset=1 vào cuối địa chỉ."
echo ""
echo "  Đóng cửa sổ này (hoặc bấm Ctrl+C) để tắt."
echo ""
(sleep 1; open "http://127.0.0.1:$PORT") &
exec python3 -m http.server "$PORT" --bind 0.0.0.0
