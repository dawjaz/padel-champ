"""tile.py out.png WxH #bg  img@x,y[,w] ...  (w = resize to width)"""
import sys
from PIL import Image
out, size, bg = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = map(int, size.split('x'))
m = Image.new('RGBA', (W, H), bg)
for spec in sys.argv[4:]:
    path, pos = spec.split('@')
    parts = [int(v) for v in pos.split(',')]
    im = Image.open(path).convert('RGBA')
    if len(parts) > 2:
        w = parts[2]; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    m.alpha_composite(im, (parts[0], parts[1]))
m.convert('RGB').save(out)
