# Checks the character limits of the store texts in listing-*.md (run: python3 store/check.py)
import re, sys, pathlib
LIMITS = {'App name': 30, 'Short description': 80, 'Full description': 4000, 'Name': 30, 'Subtitle': 30, 'Promotional text': 170, 'Keywords': 100}
ok = True
for f in sorted(pathlib.Path(__file__).parent.glob('listing-*.md')):
    text = f.read_text(encoding='utf-8')
    for m in re.finditer(r'^\*\*(.+?)\*\*[^\n]*\n(.*?)(?=\n\*\*|\n---|\Z)', text, re.S | re.M):
        key = m.group(1).strip()
        if key not in LIMITS:
            continue
        body = m.group(2).strip()
        n = len(body)
        flag = 'OK' if n <= LIMITS[key] else 'TOO LONG'
        if n > LIMITS[key]:
            ok = False
        print(f'{f.name:16} {key:18} {n:5} / {LIMITS[key]:4}  {flag}')
sys.exit(0 if ok else 1)
