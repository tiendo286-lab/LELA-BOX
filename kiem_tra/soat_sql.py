# Soát cú pháp SQL + thân hàm plpgsql bằng bộ đọc của Postgres (pglast). Dùng: soat_sql.py tệp.sql ...
import sys, re
import pglast
from pglast import parser
bad = 0
for path in sys.argv[1:]:
    src = open(path, encoding='utf-8').read()
    try:
        stmts = parser.split(src)
    except Exception as e:
        print(f'{path}: LỖI TÁCH CÂU: {e}'); bad += 1; continue
    nf = nd = 0
    for st in stmts:
        try:
            parser.parse_sql(st)
        except Exception as e:
            bad += 1; print(f'{path}: LỖI CÚ PHÁP: {e}\n   ở: {st[:160]!r}'); continue
        low = st.lstrip().lower()
        if low.startswith('create') and ' function ' in low[:80] and re.search(r'language\s+plpgsql', low):
            nf += 1
            try: pglast.parse_plpgsql(st)
            except Exception as e: bad += 1; print(f'{path}: LỖI PLPGSQL: {e}\n   ở: {st[:120]!r}')
        elif low.startswith('do'):
            nd += 1
            m = re.search(r'\$(\w*)\$(.*)\$\1\$', st, re.S)
            body = m.group(2) if m else ''
            fake = f'create function __do() returns void language plpgsql as $__x$ {body} $__x$'
            try: pglast.parse_plpgsql(fake)
            except Exception as e: bad += 1; print(f'{path}: LỖI KHỐI DO: {e}\n   ở: {body[:120]!r}')
    print(f'{path}: {len(stmts)} câu, {nf} hàm plpgsql, {nd} khối DO')
print('== KẾT QUẢ:', 'ĐẠT' if not bad else f'{bad} LỖI')
sys.exit(1 if bad else 0)
