"""Deterministic recorder: steps the Phaser game by a fixed 1/30 s and saves each canvas frame, so the video is smooth
whatever the speed of this machine. Usage: fr.py NAME GAME_SECONDS MODE(mix|specials|glass)"""
import asyncio, sys, os, json, base64, time, shutil
sys.path.insert(0, '/home/claude/store_shots')
from common import DEMO_JS
from playwright.async_api import async_playwright
NAME, SECS, MODE = sys.argv[1], float(sys.argv[2]), sys.argv[3]
LEAD = float(sys.argv[4]) if len(sys.argv) > 4 else 50
OUT = f'/home/claude/clips/frames_{NAME}'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
DT = 1000 / 30
STATE = open('/home/claude/store_shots/autoplay.py').read().split('STATE = """')[1].split('"""')[0]
STEP = """async ([n, grab]) => {
  const g = window.__game; const out = [];
  for (let i = 0; i < n; i++) {
    window.__t += %f; g.step(window.__t, %f);
    if (grab && i === n - 1 || grab === 2) out.push(g.canvas.toDataURL('image/jpeg', 0.92));
  }
  return out;
}""" % (DT, DT)
PREF = ['Por Tres', 'Bandeja', 'Vibora', 'Víbora', 'Bajada', 'Volley', 'Flat', 'Lob', 'Chiquita', 'Hard glass', 'Spin glass', 'T-serve']
frame = 0
log = []   # (frame, kind)
async def main():
    global frame
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 360, 'height': 640}, device_scale_factor=1)
        await pg.goto('http://127.0.0.1:5199/')
        await pg.wait_for_function('window.__game && window.__game.scene.isActive("SplashScene")', timeout=30000)
        await pg.evaluate(DEMO_JS)
        await pg.evaluate("([k,d])=>{const g=window.__game; g.scene.getScenes(true).forEach(s=>s.scene.stop()); g.scene.start(k, d||undefined);}", ['MatchScene', {'practice': None, 'career': None}])
        await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const g=window.__game; g.loop.sleep(); window.__t = performance.now(); const real = performance.now.bind(performance); performance.now = () => window.__t;}")
        async def advance(n):
            """Step n frames, saving every frame."""
            global frame
            for _ in range(n):
                urls = await pg.evaluate(STEP, [1, 2])
                open(f'{OUT}/{frame:05d}.jpg', 'wb').write(base64.b64decode(urls[-1].split(',')[1])); frame += 1
        async def click(x, y, kind):
            await pg.mouse.click(x, y); log.append((frame, kind))
        total = int(SECS * 30)
        while frame < total:
            await advance(3)
            st = await pg.evaluate(STATE)
            if st is None: continue
            texts = [x['t'] for x in st['t']]
            ov = st['all'][:3]
            if ov: log.append((frame, 'text:' + ' | '.join(ov)[:80]))
            if st['ring'] is not None and st['ring'] > 0:
                await advance(max(0, int((st['ring'] - LEAD) / DT)))
                log.append((frame, 'ringclick'))
                await click(180, 300, 'ring'); continue
            recv = [x for x in st['t'] if x['t'].startswith(('AFTER BOUNCE', 'WAIT FOR THE GLASS'))]
            if recv:
                await click(recv[frame // 8 % len(recv)]['x'], recv[frame // 8 % len(recv)]['y'], 'receive'); continue
            if 'HEADS' in texts:
                h = [x for x in st['t'] if x['t'] == 'HEADS'][0]; await click(h['x'], h['y'], 'toss'); continue
            if texts:
                cand = [x for x in st['t'] if any(x['t'].startswith(pf) for pf in PREF)]
                sp = [x for x in st['t'] if 'SPECIAL' in x['t']]
                if MODE == 'specials' and sp: cand = sp
                elif MODE == 'glass': cand = sorted(cand, key=lambda x: 0 if x['t'].startswith(('Por Tres', 'Hard glass', 'Spin glass', 'Bajada', 'Lob')) else 1)
                else: cand = sorted(cand, key=lambda x: 0 if x['t'].startswith(('Por Tres', 'Volley', 'Bandeja', 'Vibora', 'Víbora', 'Bajada')) else 1)
                if cand:
                    c = cand[0]; await click(c['x'], c['y'], 'shot:' + c['t'][:20]); await advance(4)
                    st3 = await pg.evaluate(STATE)
                    dirs = [x for x in (st3['t'] if st3 else []) if x['t'].startswith(('CROSS', 'PARALLEL', 'MIDDLE', 'LEFT CORNER'))]
                    if dirs: await click(dirs[0]['x'], dirs[0]['y'], 'aim')
                    else: await click(150, 150, 'aim')
                    continue
                if any(w in ' '.join(texts) for w in ('CONTINUE', 'NEXT')):
                    await click(st['t'][0]['x'], st['t'][0]['y'], 'continue')
        json.dump(log, open(f'/home/claude/clips/{NAME}_log.json', 'w'))
        print('frames', frame); await b.close()
asyncio.run(main())
