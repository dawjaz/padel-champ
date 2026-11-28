import asyncio, sys, re, glob, os, shutil
sys.path.insert(0, '/home/claude/store_shots')
from common import DEMO_JS
from playwright.async_api import async_playwright
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 70
NAME = sys.argv[2] if len(sys.argv) > 2 else 'match'
STATE = open('/home/claude/store_shots/autoplay.py').read().split('STATE = """')[1].split('"""')[0]
PREF = ['Por Tres', 'Bandeja', 'Vibora', 'Víbora', 'Bajada', 'Volley', 'Flat', 'Lob', 'Chiquita', 'Hard glass', 'Spin glass', 'T-serve']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width':360,'height':640}, device_scale_factor=2, record_video_dir='/home/claude/clips/raw', record_video_size={'width':720,'height':1280})
        pg = await ctx.new_page()
        await pg.goto('http://127.0.0.1:5199/')
        await pg.wait_for_function('window.__game && window.__game.scene.isActive("SplashScene")', timeout=30000)
        await pg.evaluate(DEMO_JS)
        await pg.evaluate("([k,d])=>{const g=window.__game; g.scene.getScenes(true).forEach(s=>s.scene.stop()); g.scene.start(k, d||undefined);}", ['MatchScene', {'practice': None, 'career': None}])
        t0 = asyncio.get_event_loop().time()
        shots = 0
        while asyncio.get_event_loop().time() - t0 < SECS:
            await pg.wait_for_timeout(250)
            st = await pg.evaluate(STATE)
            if st is None: continue
            texts = [x['t'] for x in st['t']]
            if st['ring'] is not None and st['ring'] > 0:
                await pg.wait_for_timeout(max(0, st['ring'] - 60)); await pg.mouse.click(180, 300); continue
            if 'HEADS' in texts:
                h = [x for x in st['t'] if x['t'] == 'HEADS'][0]; await pg.mouse.click(h['x'], h['y']); continue
            if texts:
                cand = [x for x in st['t'] if any(x['t'].startswith(pf) for pf in PREF)]
                cand = sorted(cand, key=lambda x: 0 if x['t'].startswith(('Por Tres', 'Volley', 'Bandeja', 'Vibora', 'Víbora', 'Bajada')) else 1)
                if cand:
                    c = cand[0]; await pg.mouse.click(c['x'], c['y']); shots += 1
                    await pg.wait_for_timeout(450)
                    st3 = await pg.evaluate(STATE)
                    dirs = [x for x in (st3['t'] if st3 else []) if x['t'].startswith(('CROSS', 'PARALLEL', 'MIDDLE', 'LEFT CORNER'))]
                    if dirs: await pg.mouse.click(dirs[0]['x'], dirs[0]['y'])
                    else: await pg.mouse.click(150, 150)
                    continue
                if any(w in ' '.join(texts) for w in ('CONTINUE', 'NEXT')):
                    x = st['t'][0]; await pg.mouse.click(x['x'], x['y'])
        print('shots', shots)
        await ctx.close(); await b.close()
        vids = sorted(glob.glob('/home/claude/clips/raw/*.webm'), key=os.path.getmtime)
        shutil.move(vids[-1], f'/home/claude/clips/{NAME}.webm')
asyncio.run(main())
