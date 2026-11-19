#!/bin/bash
# Chạy MỌI bài thử: hàm thuần (jsc) + giao diện (Chrome). Mã thoát 0 = tất cả đạt.
D="$(cd "$(dirname "$0")" && pwd)"; rc=0; tong=0; hong=0
"$D/chay_jsc.sh" > "$D/.tam/jsc.log" 2>&1 || { rc=1; echo "✗ hàm thuần — xem kiem_tra/.tam/jsc.log"; }
grep '^== ' "$D/.tam/jsc.log"
while read -r flow role phone; do
  [ -z "$flow" ] && continue; tong=$((tong+1))
  if "$D/chay_chrome.sh" "$flow" "$role" "${phone:--}" > "$D/.tam/$flow-$role${phone:+-phone}.log" 2>&1; then echo "✓ $flow $role $phone"
  else rc=1; hong=$((hong+1)); echo "✗ $flow $role $phone — xem kiem_tra/.tam/$flow-$role${phone:+-phone}.log"; fi
done < "$D/trinh_duyet/danh_sach.txt"
echo "== giao diện: $((tong-hong))/$tong đạt"
exit $rc
