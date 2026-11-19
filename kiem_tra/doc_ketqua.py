"""In kết quả bài thử; mã thoát 0 = đạt."""
import json, sys

r = json.load(open(sys.argv[1], encoding='utf-8'))
for n in r.get('notes', []):
    print('  ·', n)
for e in r.get('errs', []):
    print('  ✗', e)
print('ĐẠT' if not r.get('errs') else 'HỎNG (%d lỗi)' % len(r['errs']))
sys.exit(0 if not r.get('errs') else 1)
