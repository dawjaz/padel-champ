"""B: RETRO 8-BIT. Everything is drawn on a pixel grid and exported as crisp SVG rects (plus a PNG preview)."""
import math, random
from PIL import Image, ImageDraw, ImageFont

FONT = 'ttf/press-start-2p-latin-400-normal.ttf'
INK = (20, 10, 42)


def glyph_mask(text, scale):
    """The text in Press Start 2P at its native 8 px, scaled by an integer factor: a set of (x, y) cells."""
    f = ImageFont.truetype(FONT, 8)
    w = int(f.getlength(text)) + 2
    im = Image.new('1', (w, 10), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    d.text((0, 0), text, font=f, fill=1)
    bb = im.getbbox()
    im = im.crop(bb)
    cells = set()
    for y in range(im.height):
        for x in range(im.width):
            if im.getpixel((x, y)):
                for dy in range(scale):
                    for dx in range(scale):
                        cells.add((x * scale + dx, y * scale + dy))
    return cells, im.width * scale, im.height * scale


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.px[y][x] = c

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def svg(self, cell):
        out = []
        for y in range(self.h):
            x = 0
            while x < self.w:
                c = self.px[y][x]
                if c is None:
                    x += 1
                    continue
                x2 = x
                while x2 + 1 < self.w and self.px[y][x2 + 1] == c:
                    x2 += 1
                out.append(f'<rect x="{x * cell}" y="{y * cell}" width="{(x2 - x + 1) * cell}" height="{cell}" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
                x = x2 + 1
        W, H = self.w * cell, self.h * cell
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges">{"".join(out)}</svg>'

    def png(self, path, cell):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c:
                    im.putpixel((x, y), c + (255,))
        im.resize((self.w * cell, self.h * cell), Image.NEAREST).save(path)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


SKY = [(16, 8, 46), (34, 12, 78), (70, 16, 110), (128, 24, 128), (196, 40, 120)]
SUN = [(255, 236, 120), (255, 200, 70), (255, 150, 60), (255, 96, 90), (240, 60, 130)]
FLOOR = (24, 6, 50)
GRIDC = (255, 60, 170)
LIME, LIME_D, LIME_L = (210, 240, 60), (140, 170, 20), (245, 255, 160)


def backdrop(g, horizon, sun_c, sun_r, seed=3, stars=40, grid_lines=True):
    rnd = random.Random(seed)
    # Banded sky (dithered between bands).
    for y in range(horizon):
        t = y / max(1, horizon - 1) * (len(SKY) - 1)
        i = min(int(t), len(SKY) - 2)
        f = t - i
        for x in range(g.w):
            c = SKY[i + 1] if ((x + y) % 2 == 0 and f > 0.5) or f > 0.82 else SKY[i]
            g.set(x, y, c)
    for _ in range(stars):
        x, y = rnd.randrange(g.w), rnd.randrange(max(1, horizon - 8))
        g.set(x, y, (255, 255, 255) if rnd.random() < 0.4 else (170, 150, 255))
    # Striped synthwave sun, clipped at the horizon.
    cx, cy = sun_c
    top = cy - sun_r
    vis = horizon - top
    for y in range(top, horizon):
        rel = (y - top) / max(1, vis)
        band = min(len(SUN) - 1, int(rel * len(SUN)))
        if rel > 0.42:
            k = y - top - int(vis * 0.42)
            gap = 1 + k // 5
            if k % 4 < min(gap, 3) and k % 4 != 3:
                continue
        for x in range(cx - sun_r, cx + sun_r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= sun_r ** 2 + sun_r * 0.5:
                g.set(x, y, SUN[band])
    # Floor with a perspective grid.
    for y in range(horizon, g.h):
        for x in range(g.w):
            g.set(x, y, FLOOR)
    for x in range(g.w):
        g.set(x, horizon, GRIDC)
    if grid_lines:
        vx = cx
        span = (g.h - horizon) * 1.9
        for k in range(-6, 7):
            bx = vx + k * span / 3
            if abs(bx - vx) > span * 1.01:
                continue
            line(g, vx + (bx - vx) * 0.12, horizon + 2, bx, g.h - 1, GRIDC)
        y, step = horizon + 2.0, 1.5
        while y < g.h:
            for x in range(g.w):
                g.set(x, int(y), GRIDC)
            step *= 1.8
            y += step


def line(g, x0, y0, x1, y1, c):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n
        g.set(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), c)


def title_text(g, text, scale, ox, oy, depth=3):
    cells, w, h = glyph_mask(text, scale)
    bands = [(255, 250, 190), (255, 226, 80), (255, 186, 40), (255, 128, 30), (240, 70, 30)]
    ext_c = [(150, 40, 10), (110, 24, 8), (70, 12, 10)]
    occupied = set()
    # extrusion (down-right), darkest last
    for d in range(depth, 0, -1):
        for (x, y) in cells:
            g.set(ox + x + d, oy + y + d, ext_c[min(d - 1, len(ext_c) - 1)])
            occupied.add((x + d, y + d))
    occupied |= cells
    # outline around everything
    for (x, y) in list(occupied):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in occupied:
                    g.set(ox + x + dx, oy + y + dy, INK)
    for (x, y) in cells:
        t = y / max(1, h - 1)
        c = bands[min(len(bands) - 1, int(t * len(bands)))]
        if (x, y - 1) not in cells or (x - 1, y) not in cells:
            c = lerp(c, (255, 255, 255), 0.55) if t < 0.5 else c
        g.set(ox + x, oy + y, c)
    return w, h


def small_text(g, text, ox, oy, color, shadow=INK, scale=1):
    cells, w, h = glyph_mask(text, scale)
    for (x, y) in cells:
        g.set(ox + x + scale, oy + y + scale, shadow)
    for (x, y) in cells:
        g.set(ox + x, oy + y, color)
    return w, h


def pixel_ball(g, cx, cy, r, trail=True, tdx=-1, tdy=1):
    if trail:
        sx_, sy_ = (1 if tdx > 0 else -1), (1 if tdy > 0 else -1)
        px, py = -sy_, sx_  # perpendicular to a 45 degree diagonal
        k0 = int(r / 1.41) + 1
        for off, ln, c in ((-1, 4, (150, 200, 30)), (0, 7, (205, 245, 60)), (1, 4, (150, 200, 30))):
            for i in range(ln):
                k = k0 + i + (1 if off else 0)
                g.set(cx + sx_ * k + px * off * 2, cy + sy_ * k + py * off * 2, c)
    for y in range(-r - 1, r + 2):
        for x in range(-r - 1, r + 2):
            d2 = x * x + y * y
            if d2 <= r * r + r * 0.8:
                c = LIME
                if x + y > r * 0.7:
                    c = LIME_D
                if x + y < -r * 0.9:
                    c = LIME_L
                g.set(cx + x, cy + y, c)
            elif d2 <= (r + 1) ** 2 + (r + 1) * 0.8:
                g.set(cx + x, cy + y, INK)
    # the seam: two curves
    for y in range(-r + 1, r):
        s = r * 0.62 - (r * 0.45) * (1 - (y / r) ** 2)
        for sx in (-1, 1):
            x = round(sx * s)
            if x * x + y * y < r * r:
                g.set(cx + x, cy + y, (255, 255, 255))


def racket(g, hx, hy, a_len, a_wid, ang_deg, handle_len):
    """A padel racket: outline, silver frame, orange face with holes, neck and a striped grip. ang = direction to the tip."""
    ang = math.radians(ang_deg)
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    FACE_L, FACE, FACE_D, FRAME, HOLE = (110, 175, 255), (40, 120, 255), (22, 70, 190), (236, 242, 255), (12, 30, 90)
    head = {}
    for y in range(g.h):
        for x in range(g.w):
            dx, dy = x + 0.5 - hx, y + 0.5 - hy
            u, v = dx * ux + dy * uy, dx * vx + dy * vy
            wid = a_wid * (0.9 + 0.14 * (u / a_len))
            e = (u / a_len) ** 2 + (v / wid) ** 2
            if e <= 1.0:
                head[(x, y)] = (u, v, e)
    # handle cells first (so the head covers the joint)
    hc = {}
    for t10 in range(0, (handle_len + 2) * 10):
        t = t10 / 10
        px, py = hx - ux * (a_len - 1 + t), hy - uy * (a_len - 1 + t)
        for w10 in range(-14, 15):
            w = w10 / 10
            q = (round(px + vx * w), round(py + vy * w))
            if q not in hc or abs(w) < hc[q][1]:
                hc[q] = (t, abs(w))
    for q, (t, w) in hc.items():
        if q in head:
            continue
        if t < 3:
            c = FRAME
        elif t > handle_len:
            c = (40, 40, 80)
        else:
            c = (245, 245, 255) if int(t / 1.5) % 2 == 0 else (60, 90, 200)
        g.set(q[0], q[1], c)
    for (x, y) in list(hc):
        if (x, y) in head:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in hc and n not in head:
                g.set(n[0], n[1], INK)
    for (x, y), (u, v, e) in head.items():
        nb = [(x + dx, y + dy) in head for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if not all(nb):
            g.set(x, y, FRAME)
            continue
        light = (-u * 0.5 - v * 0.8) / a_len
        c = FACE_L if light > 0.45 else FACE if light > -0.35 else FACE_D
        if (x + y) % 2 == 0 and x % 2 == 1 and e < 0.6:
            c = HOLE
        g.set(x, y, c)
    for (x, y) in list(head):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in head and n not in hc:
                g.set(n[0], n[1], INK)


def plate(g, x0, y0, w, h, fill=(24, 6, 50), border=(255, 60, 170)):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = y in (y0, y0 + h - 1) or x in (x0, x0 + w - 1)
            g.set(x, y, border if edge else fill)


def logo():
    g = Grid(170, 82)
    backdrop(g, horizon=60, sun_c=(85, 60), sun_r=30, seed=7, stars=70)
    w1, h1 = glyph_mask('POR', 2)[1:]
    title_text(g, 'POR', 2, (g.w - w1) // 2 - 1, 6, depth=2)
    w2, h2 = glyph_mask('TRES', 4)[1:]
    title_text(g, 'TRES', 4, (g.w - w2) // 2 - 2, 26, depth=3)
    wt, ht = glyph_mask('PADEL CAREER', 1)[1:]
    plate(g, (g.w - wt) // 2 - 4, 64, wt + 9, ht + 7)
    small_text(g, 'PADEL CAREER', (g.w - wt) // 2, 67, (92, 242, 255))
    pixel_ball(g, 143, 12, 4, tdx=-1, tdy=1)
    return g


def icon():
    g = Grid(48, 48)
    backdrop(g, horizon=41, sun_c=(24, 35), sun_r=17, seed=11, stars=14)
    racket(g, hx=27.0, hy=21.0, a_len=12, a_wid=9.8, ang_deg=-48, handle_len=8)
    pixel_ball(g, 14, 12, 4, tdx=-0.7, tdy=-0.7)
    return g


if __name__ == '__main__':
    L = logo()
    open('out/B_logo.svg', 'w').write(L.svg(10))
    L.png('out/B_logo.png', 6)
    I = icon()
    open('out/B_icon.svg', 'w').write(I.svg(1024 / 48))
    I.png('out/B_icon.png', 11)
    print('ok')
