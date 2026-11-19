#!/bin/bash
# Chạy một bài thử giao diện trên Chrome headless với dữ liệu chạy thử (không đụng gì thật).
# Dùng: kiem_tra/chay_chrome.sh <flow> <role chu|nv> [phone|-] [now=2026-11-19T14:32]
# Bản thử dựng vào kiem_tra/.tam/<tên> (ghi đè mỗi lần, Git bỏ qua).
set -u
D="$(cd "$(dirname "$0")" && pwd)"
FLOW="$1"; ROLE="${2:-nv}"; PHONE="${3:-}"; NOW="${4:-2026-11-19T14:32}"
[ "$PHONE" = "-" ] && PHONE=""
W="$D/.tam/$FLOW-$ROLE${PHONE:+-phone}"
mkdir -p "$W"
rsync -a --delete --exclude test --exclude ketqua.json "$D/../docs/" "$W/"
mkdir -p "$W/test"; rsync -a --delete "$D/trinh_duyet/" "$W/test/"
python3 "$D/chen_test.py" "$W/index.html"
PORT=$((8800 + RANDOM % 900)); OUT="$W/ketqua.json"; : > "$OUT"
python3 "$D/may_chu.py" "$W" "$PORT" "$OUT" & SRV=$!
PAGE=index.html; [ -n "$PHONE" ] && PAGE=test/phone.html
URL="http://127.0.0.1:$PORT/$PAGE?auto=1&reset=1&role=$ROLE&script=$FLOW&now=$NOW#/bang"
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/lela_chrome.XXXXXX")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run \
  --no-default-browser-check --mute-audio --user-data-dir="$PROFILE" --window-size=1280,900 "$URL" >/dev/null 2>&1 & CHR=$!
for i in $(seq 1 120); do [ -s "$OUT" ] && break; sleep 0.5; done
kill $CHR $SRV 2>/dev/null; wait $CHR $SRV 2>/dev/null
echo "== $FLOW role=$ROLE ${PHONE:+(điện thoại 390px)}"
if [ ! -s "$OUT" ]; then echo "KHÔNG CÓ KẾT QUẢ (quá 60 giây)"; exit 2; fi
python3 "$D/doc_ketqua.py" "$OUT"
