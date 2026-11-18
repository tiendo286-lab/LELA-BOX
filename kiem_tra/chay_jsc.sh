#!/bin/bash
# Chạy mọi bài kiểm tra hàm thuần (kiem_tra/*_test.mjs) bằng JavaScriptCore có sẵn trên Mac.
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
cd "$(dirname "$0")"; rc=0
for f in ${1:-*_test.mjs}; do
  echo "--- $f"; out="$("$JSC" -m "$f" 2>&1)"; echo "$out"
  if echo "$out" | grep -q '^FAIL\|Exception\|Error'; then rc=1; fi
  echo "$out" | grep -q '^== ' || rc=1
done
exit $rc
