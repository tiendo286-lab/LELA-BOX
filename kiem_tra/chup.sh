#!/bin/bash
# Chụp màn hình một trang của bản chạy thử. Dùng: kiem_tra/chup.sh <#/đường> <tệp.png> [rộng=390] [cao=844] [role=nv]
D="$(cd "$(dirname "$0")" && pwd)"
ROUTE="$1"; OUTPNG="$2"; WI="${3:-390}"; HE="${4:-844}"; ROLE="${5:-nv}"
W="$D/.tam/chup"; mkdir -p "$W"
rsync -a --delete "$D/../docs/" "$W/"
# Chrome ẩn không cho cửa sổ < 500px → chụp qua khung iframe đúng bề rộng
printf '<!doctype html><meta charset="utf-8"><style>body{margin:0}iframe{border:0;width:%spx;height:%spx;display:block}</style><iframe src="index.html?reset=1&role=%s&now=2026-11-19T14:32%s"></iframe>' "$WI" "$HE" "$ROLE" "$ROUTE" > "$W/khung.html"
PORT=$((8800 + RANDOM % 900))
python3 "$D/may_chu.py" "$W" "$PORT" "$W/ketqua.json" & SRV=$!
sleep 0.5
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/lela_chup.XXXXXX")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --hide-scrollbars \
  --user-data-dir="$PROFILE" --window-size="$(( WI < 500 ? 500 : WI )),$HE" --virtual-time-budget=4000 --screenshot="$OUTPNG" \
  "http://127.0.0.1:$PORT/khung.html" >/dev/null 2>&1
kill $SRV 2>/dev/null
echo "Đã chụp: $OUTPNG"
