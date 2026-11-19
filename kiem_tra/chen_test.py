"""Chèn bộ bắt lỗi + bộ điều khiển bài thử vào index.html của bản thử."""
import sys

p = sys.argv[1]
s = open(p, encoding='utf-8').read()
tag = '<script type="module" src="js/app.js"></script>'
if 'test/driver.js' not in s:
    s = s.replace(tag, '<script src="test/catch.js"></script>\n' + tag + '\n<script type="module" src="test/driver.js"></script>', 1)
open(p, 'w', encoding='utf-8').write(s)
