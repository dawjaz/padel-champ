"""stdin: JSON {font, text, size, tracking}; stdout: JSON {glyphs:[{ch,d,x,w,bb}], advance, bbox}. y down, baseline at 0."""
import sys, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

req = json.load(sys.stdin)
out_all = []
fonts = {}
for r in req:
    path = r['font']
    if path not in fonts:
        data = open(path, 'rb').read()
        fonts[path] = (hb.Font(hb.Face(data)), TTFont(path))
    hbf, tt = fonts[path]
    upem = tt['head'].unitsPerEm
    k = r['size'] / upem
    buf = hb.Buffer(); buf.add_str(r['text']); buf.guess_segment_properties()
    hb.shape(hbf, buf, {'kern': True, 'liga': False})
    gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
    x = 0.0; glyphs = []
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        sp = SVGPathPen(gs, lambda v: f'{v:.2f}')
        gx = x + pos.x_offset * k
        tp = TransformPen(sp, (k, 0, 0, -k, gx, -pos.y_offset * k))
        gs[name].draw(tp)
        bp = BoundsPen(gs); gs[name].draw(bp)
        b = bp.bounds or (0, 0, 0, 0)
        bb = {'x1': gx + b[0] * k, 'x2': gx + b[2] * k, 'y1': -b[3] * k, 'y2': -b[1] * k}
        ch = r['text'][info.cluster] if info.cluster < len(r['text']) else ''
        glyphs.append({'ch': ch, 'd': sp.getCommands(), 'x': gx, 'w': pos.x_advance * k, 'bb': bb})
        x += pos.x_advance * k
        if i < n - 1: x += r.get('tracking', 0) * r['size']
    ink = [g for g in glyphs if g['d']]
    bbox = {'x1': min(g['bb']['x1'] for g in ink), 'x2': max(g['bb']['x2'] for g in ink), 'y1': min(g['bb']['y1'] for g in ink), 'y2': max(g['bb']['y2'] for g in ink)}
    bbox['w'] = bbox['x2'] - bbox['x1']; bbox['h'] = bbox['y2'] - bbox['y1']
    out_all.append({'glyphs': glyphs, 'advance': x, 'bbox': bbox})
json.dump(out_all, sys.stdout)
