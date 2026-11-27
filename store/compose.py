# Builds the store screenshots and the Google Play feature graphic from raw game captures.
# Raw captures (720 x 1280, the game's canvas) go in store/raw/; run: python3 store/compose.py
# Fonts: Anton and Baloo 2 TTFs (OFL), paths below; the brand images come from public/assets/brand/.
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / 'raw'
BRAND = ROOT.parent / 'public' / 'assets' / 'brand'
ANTON = '/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf'
BALOO = '/home/claude/brand/ttf/baloo-2-latin-800-normal.ttf'

NAVY = (10, 15, 46)
NAVY2 = (20, 32, 90)
GOLD = (255, 194, 31)
ORANGE = (255, 90, 31)

# (raw file, caption, sub-caption, footer mask colour or None)
SHOTS = [
    ('prod_start.png', 'TACTICAL PADEL', 'Shot by shot, point by point', True),
    ('q_menu.png', 'CALL EVERY SHOT', 'Bandeja, víbora, smashes and specials', False),
    ('m_aim_4.png', 'FIND THE GAP', 'Tap the spot where the ball lands', False),
    ('r_special_3.png', 'UNLEASH SPECIALS', 'Sky Rocket, Venom, Corner Lock, Freeze', False),
    ('r_ring.png', 'TIME IT RIGHT', 'A clean hit is safer and stronger', False),
    ('r_special_7.png', 'WIN THE BIG POINTS', 'The crowd rises with you', False),
    ('s_CharacterScene.png', 'BUILD YOUR PLAYER', 'Level up, train and gear up', False),
    ('prod_title.png', 'YOUR PADEL CAREER', 'From the Club Cup to the Season Finals', True),
]

SIZES = {
    'play': (1080, 1920),  # Google Play phone, 9:16
    'ios-6.9': (1320, 2868),  # App Store iPhone 6.9"
}


def background(w: int, h: int) -> Image.Image:
    bg = Image.new('RGB', (w, h), NAVY)
    d = ImageDraw.Draw(bg)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(NAVY[i] + (NAVY2[i] - NAVY[i]) * t) for i in range(3)))
    # brand speed stripes across the caption area
    stripes = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    for k, (col, off, wd) in enumerate([(ORANGE + (150,), 0.22, 0.012), (GOLD + (120,), 0.245, 0.006)]):
        y0 = int(h * off)
        sd.polygon([(0, y0 + int(w * 0.18)), (w, y0 - int(w * 0.1)), (w, y0 - int(w * 0.1) + int(h * wd)), (0, y0 + int(w * 0.18) + int(h * wd))], fill=col)
    bg.paste(stripes, (0, 0), stripes)
    return bg


def italic_text(text: str, font: ImageFont.FreeTypeFont, fill, shear: float = 0.2, stroke=0, stroke_fill=None) -> Image.Image:
    l, t, r, b = font.getbbox(text, stroke_width=stroke)
    w, h = r - l + int(abs(shear) * (b - t)) + 8, b - t + 8
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((-l + 4 + int(shear * (b - t)), -t + 4), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im.transform(im.size, Image.AFFINE, (1, shear, -shear * h * 0.0, 0, 1, 0), resample=Image.BICUBIC)


def fit_font(path: str, text: str, max_w: int, size: int) -> ImageFont.FreeTypeFont:
    while size > 10:
        f = ImageFont.truetype(path, size)
        l, _, r, _ = f.getbbox(text)
        if r - l <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(path, size)


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=radius, fill=255)
    out = im.convert('RGBA')
    out.putalpha(mask)
    return out


def load_capture(name: str, mask_footer: bool) -> Image.Image:
    im = Image.open(RAW / name).convert('RGB')
    if mask_footer:
        # the build label at the very bottom ("v0.161 (dev)") is covered with the colour next to it
        d = ImageDraw.Draw(im)
        col = im.getpixel((6, 1272))
        d.rectangle([0, 1250, im.width, im.height], fill=col)
    return im


def compose(name: str, title: str, sub: str, mask: bool, size: tuple[int, int]) -> Image.Image:
    w, h = size
    bg = background(w, h)
    band = int(h * 0.2)
    # caption
    tf = fit_font(ANTON, title, int(w * 0.86), int(w * 0.115))
    ti = italic_text(title, tf, (255, 255, 255), 0.18, stroke=max(2, w // 270), stroke_fill=(10, 15, 46))
    bg.paste(ti, ((w - ti.width) // 2, int(band * 0.2)), ti)
    sf = fit_font(BALOO, sub, int(w * 0.86), int(w * 0.052))
    si = italic_text(sub, sf, GOLD, 0.0)
    bg.paste(si, ((w - si.width) // 2, int(band * 0.2) + ti.height + int(h * 0.006)), si)
    # the game screen
    top = band + int(h * 0.01)
    sh = h - top - int(h * 0.03)
    sw = int(sh * 720 / 1280)
    if sw > w * 0.9:
        sw = int(w * 0.9)
        sh = int(sw * 1280 / 720)
    shot = load_capture(name, mask).resize((sw, sh), Image.LANCZOS)
    radius = int(sw * 0.05)
    bezel = int(sw * 0.018)
    x0 = (w - sw) // 2
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x0 - bezel + 10, top - bezel + 18, x0 + sw + bezel + 10, top + sh + bezel + 18], radius=radius + bezel, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    bg.paste(shadow, (0, 0), shadow)
    ImageDraw.Draw(bg).rounded_rectangle([x0 - bezel, top - bezel, x0 + sw + bezel, top + sh + bezel], radius=radius + bezel, fill=(5, 8, 26), outline=GOLD, width=max(2, bezel // 3))
    r = rounded(shot, radius)
    bg.paste(r, (x0, top), r)
    return bg


def feature_graphic() -> Image.Image:
    w, h = 1024, 500
    bg = Image.open(BRAND / 'start_bg.jpg').convert('RGB')
    s = max(w / bg.width, h / bg.height)
    bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
    bg = bg.crop(((bg.width - w) // 2, (bg.height - h) // 2, (bg.width - w) // 2 + w, (bg.height - h) // 2 + h))
    shade = Image.new('RGBA', (w, h), (10, 15, 46, 70))
    bg.paste(shade, (0, 0), shade)
    logo = Image.open(BRAND / 'logo_all.png').convert('RGBA')
    lw = 470
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    bbox = logo.getbbox()
    logo = logo.crop(bbox)
    bg.paste(logo, (44, (h - logo.height) // 2 - 10), logo)
    # a slice of the match on the right, tilted like a phone
    shot = load_capture('r_special_7.png', False).crop((0, 0, 720, 1000))
    sw = 300
    shot = shot.resize((sw, int(shot.height * sw / 720)), Image.LANCZOS)
    card = Image.new('RGBA', (sw + 16, shot.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius=26, fill=(5, 8, 26), outline=GOLD, width=3)
    r = rounded(shot, 20)
    card.paste(r, (8, 8), r)
    card = card.rotate(-8, resample=Image.BICUBIC, expand=True)
    bg.paste(card, (w - card.width - 40, 26), card)
    return bg


if __name__ == '__main__':
    for key, size in SIZES.items():
        out = ROOT / 'screenshots' / key
        out.mkdir(parents=True, exist_ok=True)
        for i, (name, title, sub, mask) in enumerate(SHOTS, 1):
            compose(name, title, sub, mask, size).save(out / f'{i:02d}-{title.lower().replace(" ", "-")}.png', optimize=True)
    g = ROOT / 'graphics'
    g.mkdir(exist_ok=True)
    feature_graphic().save(g / 'feature-graphic-1024x500.png', optimize=True)
    print('done')
