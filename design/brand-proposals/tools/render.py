"""Render SVG files to PNG with Chrome. Usage: render.py out.png:size:in.svg [...] (size = output width in px; height follows)."""
import sys, pathlib
from playwright.sync_api import sync_playwright

jobs = []
for arg in sys.argv[1:]:
    out, size, src = arg.split(':', 2)
    jobs.append((out, int(size), pathlib.Path(src).resolve()))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(device_scale_factor=1)
    for out, size, src in jobs:
        svg = src.read_text()
        html = f"""<html><body style="margin:0;background:transparent">
        <img id="i" src="data:image/svg+xml;base64,{__import__('base64').b64encode(svg.encode()).decode()}" style="width:{size}px;display:block"></body></html>"""
        pg.set_content(html)
        pg.wait_for_function("document.getElementById('i').complete")
        box = pg.eval_on_selector('#i', 'e=>[e.getBoundingClientRect().width,e.getBoundingClientRect().height]')
        pg.set_viewport_size({'width': int(box[0]), 'height': max(1, int(round(box[1])))})
        pg.locator('#i').screenshot(path=out, omit_background=True)
    b.close()
print('ok', len(jobs))
