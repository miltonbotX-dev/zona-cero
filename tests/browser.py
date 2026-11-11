#!/usr/bin/env python3
"""Pruebas en navegador real (Chrome headless) para ZCero (antes Zona Cero).

Uso:
  uv run --with playwright python tests/browser.py [URL] [carpeta_capturas]
Por defecto: http://127.0.0.1:8765/ y screenshots/. Para el sitio publicado:
  uv run --with playwright python tests/browser.py https://miltonbotx-dev.github.io/zona-cero/ screenshots/live
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "screenshots"
if not SHOTS.is_absolute():
    SHOTS = ROOT / SHOTS
SHOTS.mkdir(parents=True, exist_ok=True)
fails = []
oks = []

def ok(cond, name, extra=""):
    if cond:
        oks.append(name)
        print("  OK  " + name)
    else:
        msg = name + ((" — " + extra) if extra else "")
        fails.append(msg)
        print("  FAIL  " + msg)

def collect_console(page):
    logs = {"errors": [], "others": []}
    def on_console(msg):
        entry = f"{msg.type}: {msg.text}"
        if msg.type in ("error", "assert"):
            logs["errors"].append(entry)
        else:
            logs["others"].append(entry)
    def on_page_error(err):
        logs["errors"].append("pageerror: " + str(err))
    page.on("console", on_console)
    page.on("pageerror", on_page_error)
    return logs

def js_state(page):
    return page.evaluate("""() => {
      const ZC = window.ZC;
      if (!ZC) return { missing: true };
      const p = ZC.player;
      return {
        state: ZC.state,
        lobbyOpen: !!ZC.lobbyOpen,
        hasPlayer: !!p,
        x: p ? p.x : null,
        y: p ? p.y : null,
        bullets: (ZC.bullets || []).length,
        mag: p && p.gun && p.gun[p.gun.current] ? p.gun[p.gun.current].mag : null,
        current: p && p.gun ? p.gun.current : null,
        titleHidden: !!(document.getElementById('title-screen') || {}).hidden,
        lobbyHidden: !!(document.getElementById('lobby-screen') || {}).hidden,
        endHidden: !!(document.getElementById('end-screen') || {}).hidden,
        touchShow: document.getElementById('touch-ui') && document.getElementById('touch-ui').classList.contains('show'),
        portraitDisplay: getComputedStyle(document.getElementById('portrait-warn')).display,
        joys: ['joy-left','joy-right','btn-jump','btn-reload','btn-swap'].map(id => {
          const el = document.getElementById(id);
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return { id, w: r.width, h: r.height, x: r.x, y: r.y, display: st.display, visible: r.width > 0 && r.height > 0 };
        })
      };
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        headless=True,
        args=["--no-sandbox", "--disable-gpu", "--use-gl=angle", "--use-angle=swiftshader"],
    )

    # --- Desktop 1280x720: start, move, shoot ---
    print("A. Escritorio 1280x720")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    logs = collect_console(page)
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(300)
    # --- Entrada v1.6: video del creador -> intro -> carga -> lobby ---
    boot0 = page.evaluate("() => ({ phase: ZC.Boot.phase, visible: !document.getElementById('boot-screen').hidden, title: !document.getElementById('title-screen').hidden, lobby: !!ZC.lobbyOpen })")
    ok(boot0["phase"] == "creator" and boot0["visible"] and not boot0["title"] and not boot0["lobby"],
       "al abrir se ve el video del creador (no el menú ni el lobby)", json.dumps(boot0))
    page.wait_for_function("() => document.getElementById('boot-video-creator').currentTime > 0.3", timeout=8000)
    vid = page.evaluate("""() => { const v = document.getElementById('boot-video-creator'); const r = v.getBoundingClientRect();
      return { t: v.currentTime, muted: v.muted, paused: v.paused, w: v.videoWidth, h: v.videoHeight, fit: getComputedStyle(v).objectFit,
               vis: r.width > 0 && !v.hidden, introHidden: document.getElementById('boot-video-intro').hidden }; }""")
    ok(vid["t"] > 0.3 and not vid["paused"] and vid["muted"] and vid["w"] == 1280, "el video del creador se reproduce solo y sin sonido", json.dumps(vid))
    ok(vid["vis"] and vid["introHidden"] and vid["fit"] == "contain", "solo se ve el creador, entero (contain)", json.dumps(vid))
    ok(page.locator("#boot-skip").is_visible() and page.locator("#boot-sound").is_visible(), "botones Saltar y sonido visibles")
    page.wait_for_function("() => document.getElementById('boot-credit').classList.contains('on')", timeout=8000)
    page.wait_for_timeout(1300)
    cred = page.evaluate("""() => { const c = document.querySelector('.boot-credit-name'); const r = c.getBoundingClientRect();
      return { text: c.textContent, op: getComputedStyle(document.getElementById('boot-credit')).opacity, y: r.y, b: r.y + r.height, x: r.x, w: r.width }; }""")
    ok(cred["text"] == "Amilthon" and float(cred["op"]) > 0.9 and cred["b"] <= 720 and cred["y"] > 720 * 0.8,
       "la firma «Amilthon» aparece abajo, bajo el dibujo", json.dumps(cred))
    page.screenshot(path=str(SHOTS / "desktop-boot-creator.png"))
    page.click("#boot-skip")
    page.wait_for_timeout(200)
    ph = page.evaluate("() => ({ phase: ZC.Boot.phase, creatorPaused: document.getElementById('boot-video-creator').paused, sound: ZC.Boot.sound, introMuted: document.getElementById('boot-video-intro').muted })")
    ok(ph["phase"] == "intro" and ph["creatorPaused"], "«Saltar» pasa del creador a la intro", json.dumps(ph))
    ok(ph["sound"] and not ph["introMuted"], "tras tocar, la intro ya suena", json.dumps(ph))
    page.wait_for_function("() => document.getElementById('boot-video-intro').currentTime > 0.3", timeout=8000)
    ok(page.evaluate("() => { const v = document.getElementById('boot-video-intro'); return !v.paused && v.videoWidth === 544 && document.getElementById('boot-credit').hidden; }"), "la intro (cuadrada) se reproduce y sin firma")
    page.screenshot(path=str(SHOTS / "desktop-boot-intro.png"))
    page.click("#boot-skip")
    page.wait_for_timeout(120)
    ok(page.evaluate("() => ZC.Boot.phase") in ("loading", "ready"), "un segundo «Saltar» lleva a la carga")
    ok(page.locator("#boot-logo").is_visible() and page.evaluate("() => document.getElementById('boot-logo').naturalWidth > 0"), "en la carga el logo carga y se ve")
    page.screenshot(path=str(SHOTS / "desktop-boot-loading.png"))
    style = page.evaluate("""() => {
      const cs = el => getComputedStyle(el);
      return { boot: cs(document.getElementById('boot-screen')).backgroundImage + ' ' + cs(document.getElementById('boot-screen')).backgroundColor,
               fill: cs(document.getElementById('boot-fill')).backgroundImage,
               word: cs(document.querySelector('.boot-word')).textShadow,
               bodyBg: cs(document.body).backgroundColor };
    }""")
    neon = ("92, 228, 255", "106, 239, 255", "43, 183, 214")
    ok(not any(n in json.dumps(style) for n in neon), "entrada sin cian neón", json.dumps(style))
    ok(style["bodyBg"] == "rgb(23, 19, 14)", "fondo de página tierra oscuro", style["bodyBg"])
    samples = []
    for _ in range(30):
        smp = page.evaluate("() => ({ phase: ZC.Boot.phase, shown: ZC.Boot.shown, real: ZC.Boot.progress(), pct: document.getElementById('boot-pct').textContent })")
        samples.append(smp)
        if smp["phase"] in ("ready", "done"):
            break
        page.wait_for_timeout(60)
    ok(any(x["phase"] == "loading" for x in samples), "después aparece la pantalla de carga", json.dumps(samples[:3]))
    ok(all(x["shown"] <= x["real"] + 1e-9 for x in samples), "la barra nunca va por delante de lo realmente cargado", json.dumps(samples[:6]))
    ok(page.locator("#boot-pct").is_visible(), "porcentaje de carga visible")
    page.wait_for_function("() => ZC.lobbyOpen", timeout=12000)
    page.wait_for_timeout(300)
    loaded = page.evaluate("() => ZC.Maps.list().map(id => [id, !!ZC.Maps.imageFor(ZC.Maps.all[id])])")
    ok(all(v for _, v in loaded), "al llegar al lobby los fondos de todos los mapas ya cargaron", json.dumps(loaded))
    st = js_state(page)
    ok(st.get("lobbyOpen") and not st.get("lobbyHidden") and st.get("titleHidden"), "la carga termina sola en el lobby", json.dumps(st))
    ok(page.evaluate("() => document.getElementById('boot-screen').hidden && !document.getElementById('app').classList.contains('booting')"), "la pantalla de carga se oculta")
    ok(page.locator("#btn-deploy").is_visible(), "botón Iniciar visible")
    # v1.6: íconos en lugar de texto
    icons = page.evaluate("""() => {
      const q = s => [...document.querySelectorAll(s)];
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const shown = q('#lobby-screen button').filter(vis);
      return {
        total: shown.length,
        withIcon: shown.filter(b => b.querySelector('svg.ico use')).length,
        labelled: shown.filter(b => b.getAttribute('aria-label') && b.getAttribute('title')).length,
        gearText: (document.querySelector('.lobby-top [data-panel=settings]').textContent || '').trim(),
        gearSvgW: document.querySelector('.lobby-top [data-panel=settings] svg').getBoundingClientRect().width,
        dock: q('.lobby-dock button').map(b => b.querySelector('svg.ico') ? b.getAttribute('aria-label') : null),
        startW: document.querySelector('#btn-deploy svg').getBoundingClientRect().width,
        mute: !!document.querySelector('#btn-mute svg.ico-on') && document.getElementById('btn-mute').textContent.trim() === ''
      };
    }""")
    ok(icons["total"] >= 7 and icons["withIcon"] >= icons["total"] - 2 and icons["labelled"] == icons["total"], "botones del lobby con ícono SVG, aria-label y title", json.dumps(icons))
    ok(icons["gearText"] == "" and icons["gearSvgW"] >= 16, "el engranaje de Ajustes es un SVG (no un emoji)", json.dumps(icons))
    ok(icons["dock"] == ["Inventario", "Aspecto", "Ajustes"] and icons["startW"] >= 20 and icons["mute"], "dock con íconos, Iniciar con triángulo y silencio con ícono", json.dumps(icons))
    page.click(".lobby-dock [data-panel=inventory]")
    page.wait_for_timeout(150)
    sheet = page.evaluate("() => ({ open: !document.getElementById('lobby-sheet').hidden, title: document.getElementById('lobby-sheet-title').textContent, on: document.querySelector('.lobby-dock [data-panel=inventory]').classList.contains('on'), minis: [...document.querySelectorAll('#lobby-sheet-body button.mini')].map(b => !!b.querySelector('svg') && !!b.getAttribute('aria-label')) })")
    ok(sheet["open"] and sheet["title"] == "Inventario" and sheet["on"] and sheet["minis"] and all(sheet["minis"]), "Inventario abre su panel, se marca y usa íconos", json.dumps(sheet))
    page.screenshot(path=str(SHOTS / "desktop-lobby-sheet.png"))
    page.click("#btn-sheet-close")
    page.wait_for_timeout(120)
    ok(page.evaluate("() => document.getElementById('lobby-sheet').hidden && !document.querySelector('.lobby-dock .on')"), "la X cierra el panel")
    ok(page.evaluate("() => document.title") == "ZCero", "título de la pestaña desde ZC.BRAND")
    fav = page.evaluate("() => [...document.querySelectorAll('link[rel~=icon]')].map(l => l.getAttribute('href'))")
    ok(any("logo.svg" in f for f in fav), "favicon propio (logo)", json.dumps(fav))
    # El menú de antes (controles) sigue disponible desde la flecha del lobby
    page.click("#btn-lobby-back")
    page.wait_for_timeout(200)
    ok(page.locator("h1").first.inner_text().strip().upper().startswith("ZCERO") and page.locator("#btn-play").is_visible(), "la flecha del lobby lleva al menú con los controles")
    ok(page.evaluate("() => ['btn-play', 'btn-how'].every(id => document.querySelector('#' + id + ' svg.ico'))"), "el menú usa íconos (jugar y controles)")
    page.screenshot(path=str(SHOTS / "desktop-title.png"))
    page.click("#btn-play")
    page.wait_for_timeout(500)
    st = js_state(page)
    ok(st.get("lobbyOpen") and not st.get("lobbyHidden"), "Jugar vuelve a abrir el lobby", json.dumps(st))
    # preview canvas should have some pixels drawn
    preview_drawn = page.evaluate("""() => {
      const c = document.getElementById('lobby-preview');
      if (!c) return false;
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 8) return true; }
      return false;
    }""")
    ok(preview_drawn, "la vista previa del personaje está dibujada")
    gear = page.evaluate("() => document.getElementById('lobby-gear-name').textContent")
    ok(gear.strip() != "", "el arma en mano se nombra junto al personaje", gear)
    page.screenshot(path=str(SHOTS / "desktop-lobby.png"))
    page.click("#btn-deploy")
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("state") == "playing" and st.get("hasPlayer"), "la partida arranca", json.dumps(st))
    ok(st.get("lobbyHidden") and st.get("titleHidden"), "lobby y menú quedan ocultos")
    drop = page.evaluate("() => ZC.getState().drop")
    ok(drop and drop.get("on") and drop.get("count") in (2, 3), "tras Iniciar empieza la caída con cuenta", json.dumps(drop))
    page.screenshot(path=str(SHOTS / "desktop-drop.png"))
    page.wait_for_function("() => !ZC.getState().drop.on", timeout=8000)
    page.wait_for_timeout(500)
    st = js_state(page)
    x0, y0 = st["x"], st["y"]
    # move right and jump
    page.keyboard.down("KeyD")
    page.wait_for_timeout(500)
    page.keyboard.up("KeyD")
    st = js_state(page)
    ok(st["x"] is not None and st["x"] > x0 + 10, "el jugador se mueve a la derecha", f"{x0} -> {st['x']}")
    # medir justo antes de saltar: al caminar pudo bajar de una pasarela
    page.wait_for_function("() => ZC.player && ZC.player.grounded", timeout=3000)
    y0 = js_state(page)["y"]
    page.keyboard.down("Space")
    page.wait_for_timeout(120)
    page.keyboard.up("Space")
    st = js_state(page)
    ok(st["y"] is not None and st["y"] < y0 - 5, "el salto eleva al jugador", f"{y0} -> {st['y']}")
    # shoot: aim right and click
    page.mouse.move(1100, 360)
    page.wait_for_timeout(60)
    page.evaluate("() => { ZC.bullets.length = 0; ZC.player.gun.cooldown = 0; }")
    mag0 = js_state(page)["mag"]
    page.mouse.down()
    page.wait_for_timeout(120)
    page.mouse.up()
    st = js_state(page)
    ok(st["bullets"] >= 1 or (mag0 is not None and st["mag"] is not None and st["mag"] < mag0),
       "el disparo funciona", f"bullets={st['bullets']} mag {mag0}->{st['mag']}")
    page.screenshot(path=str(SHOTS / "desktop-gameplay.png"))
    origin = page.evaluate("""() => {
      const P = ZC.player; ZC.bullets.length = 0; P.gun.cooldown = 0; P.gun.reloading = 0;
      P.gun[P.gun.current].mag = Math.max(1, P.gun[P.gun.current].mag);
      const m = ZC.muzzlePoint(P); ZC.fireWeapon(P); const b = ZC.bullets[0];
      return { bx: b.x, by: b.y, mx: m.x, my: m.y, px: P.x, py: P.y };
    }""")
    ok(abs(origin["bx"] - origin["mx"]) < 0.5 and abs(origin["by"] - origin["my"]) < 0.5 and origin["py"] - origin["by"] > 32,
       "en el navegador la bala sale del cañón, no de la cintura", json.dumps(origin))
    sky = page.evaluate("""() => {
      const c = document.getElementById('game'); const x = c.getContext('2d');
      const d = x.getImageData(Math.floor(c.width * 0.5), Math.floor(c.height * 0.25), 1, 1).data;
      return [d[0], d[1], d[2]];
    }""")
    ok(sky[0] >= sky[2], "el cielo del juego es cálido, no azul nocturno", str(sky))
    ok(not logs["errors"], "sin errores de consola en escritorio", "; ".join(logs["errors"][:5]))
    ctx.close()

    # --- Phone portrait 390x844 ---
    print("B. Celular retrato 390x844")
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    )
    page = ctx.new_page()
    logs = collect_console(page)
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(200)
    st = js_state(page)
    ok(st.get("portraitDisplay") == "none", "en retrato el aviso de girar no tapa la presentación", st.get("portraitDisplay"))
    page.screenshot(path=str(SHOTS / "phone-390x844-boot.png"), full_page=False)
    # Sin tocar nada: los dos videos completos (~16 s) y luego la carga y el lobby
    page.wait_for_function("() => document.getElementById('boot-credit').classList.contains('on')", timeout=10000)
    page.wait_for_timeout(1300)
    pc = page.evaluate("""() => { const v = document.getElementById('boot-video-creator'); const vr = v.getBoundingClientRect();
      const H = Math.min(vr.height, vr.width * v.videoHeight / v.videoWidth); const vb = vr.y + (vr.height + H) / 2;
      const c = document.getElementById('boot-credit').getBoundingClientRect(); return { videoBottom: vb, creditTop: c.y, creditBottom: c.y + c.height }; }""")
    ok(pc["creditTop"] >= pc["videoBottom"] - 2 and pc["creditBottom"] < 844, "en retrato la firma va bajo el video sin taparlo", json.dumps(pc))
    page.screenshot(path=str(SHOTS / "phone-390x844-creator.png"), full_page=False)
    page.wait_for_function("() => ZC.Boot.phase === 'intro'", timeout=14000)
    ok(not page.evaluate("() => ZC.Boot.skipped.length"), "el creador terminó solo y pasó a la intro", page.evaluate("() => ZC.Boot.skipped.join(',')"))
    page.wait_for_function("() => ZC.lobbyOpen", timeout=20000)
    ok(not page.evaluate("() => ZC.Boot.skipped.length"), "la intro terminó sola y entró al lobby", page.evaluate("() => ZC.Boot.skipped.join(',')"))
    page.wait_for_timeout(200)
    st = js_state(page)
    ok(st.get("portraitDisplay") == "flex", "aviso de girar a horizontal en retrato (después de la carga)", st.get("portraitDisplay"))
    # force-enable touch UI to measure controls even under the warning
    page.evaluate("() => { if (window.ZC && ZC.enableTouch) ZC.enableTouch(); }")
    page.wait_for_timeout(100)
    ok(not js_state(page).get("touchShow"), "en el lobby los controles táctiles no se ven detrás de la sala")
    page.evaluate("() => { ZC.closeLobby(); }")
    page.wait_for_timeout(100)
    st = js_state(page)
    ok(st.get("touchShow"), "controles táctiles se activan (clase show)")
    visible_controls = [j for j in st.get("joys") or [] if j["visible"] and j["w"] >= 20 and j["h"] >= 20]
    ok(len(visible_controls) == 5, "los 5 controles táctiles tienen tamaño en 390x844",
       json.dumps(st.get("joys")))
    # they should be on-screen (x/y within 390x844 roughly, allow some overflow)
    onscreen = [j for j in visible_controls if j["x"] < 390 and j["y"] < 844 and j["x"] + j["w"] > 0 and j["y"] + j["h"] > 0]
    ok(len(onscreen) >= 4, "casi todos los controles caen dentro de la pantalla retrato",
       json.dumps(st.get("joys")))
    page.screenshot(path=str(SHOTS / "phone-390x844-portrait.png"), full_page=False)
    ok(not logs["errors"], "sin errores de consola en retrato 390x844", "; ".join(logs["errors"][:5]))
    ctx.close()

    # --- Phone landscape 844x390: actual play orientation ---
    print("C. Celular horizontal 844x390")
    ctx = browser.new_context(
        viewport={"width": 844, "height": 390},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    )
    page = ctx.new_page()
    logs = collect_console(page)
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(500)
    st = js_state(page)
    ok(st.get("portraitDisplay") == "none", "sin aviso de rotación en horizontal", st.get("portraitDisplay"))
    page.wait_for_function("() => document.getElementById('boot-video-creator').currentTime > 0.3", timeout=8000)
    page.wait_for_function("() => document.getElementById('boot-credit').classList.contains('on')", timeout=8000)
    page.wait_for_timeout(1300)
    c = page.evaluate("""() => { const r = document.getElementById('boot-credit').getBoundingClientRect(); const s = document.querySelector('.boot-film-ctrl').getBoundingClientRect();
      return { top: r.y, bottom: r.y + r.height, ctrlTop: s.y, ctrlRight: s.x + s.width, phase: ZC.Boot.phase }; }""")
    ok(c["phase"] == "creator" and c["bottom"] <= 390 and c["top"] > 390 * 0.8 and c["ctrlTop"] >= 0 and c["ctrlRight"] <= 844,
       "en 844x390 la firma queda abajo y los botones dentro de la pantalla", json.dumps(c))
    page.screenshot(path=str(SHOTS / "phone-844x390-boot-creator.png"))
    page.locator("#boot-screen").tap(position={"x": 300, "y": 200})
    page.wait_for_timeout(200)
    t1 = page.evaluate("() => ({ phase: ZC.Boot.phase, sound: ZC.Boot.sound, muted: document.getElementById('boot-video-creator').muted })")
    ok(t1["phase"] == "creator" and t1["sound"] and not t1["muted"], "el primer toque activa el sonido sin saltar el video", json.dumps(t1))
    page.locator("#boot-skip").tap()
    page.wait_for_function("() => document.getElementById('boot-video-intro').currentTime > 0.5", timeout=8000)
    page.screenshot(path=str(SHOTS / "phone-844x390-boot-intro.png"))
    iv = page.evaluate("() => { const r = document.getElementById('boot-video-intro').getBoundingClientRect(); return { phase: ZC.Boot.phase, w: r.width, h: r.height }; }")
    ok(iv["phase"] == "intro", "Saltar en el celular pasa a la intro", json.dumps(iv))
    page.locator("#boot-skip").tap()
    page.wait_for_timeout(150)
    brand = page.evaluate("""() => { const r = document.querySelector('.boot-brand').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    ok(brand["y"] >= 0 and brand["y"] + brand["h"] <= 390 and brand["x"] >= 0 and brand["x"] + brand["w"] <= 844, "el logo cabe en 844x390", json.dumps(brand))
    ph = page.evaluate("() => ZC.Boot.phase")
    ok(ph in ("loading", "ready", "done"), "tras los dos videos llega la carga", ph)
    page.evaluate("() => { if (ZC.Boot.phase === 'ready' || ZC.Boot.phase === 'loading') ZC.Boot.paint(); }")
    page.screenshot(path=str(SHOTS / "phone-844x390-boot-loading.png"))
    bar = page.evaluate("""() => { const a = document.querySelector('.boot-load').getBoundingClientRect(); const b = document.querySelector('.boot-brand').getBoundingClientRect(); return { loadTop: a.y, loadBottom: a.y + a.height, brandBottom: b.y + b.height }; }""")
    ok(bar["loadBottom"] <= 390 and bar["loadTop"] >= bar["brandBottom"] - 4, "barra de carga bajo el logo y dentro de la pantalla", json.dumps(bar))
    page.wait_for_function("() => ZC.Boot.phase === 'ready' || ZC.Boot.phase === 'done'", timeout=12000)
    if page.evaluate("() => ZC.Boot.phase") == "ready":
        ok(page.locator("#boot-tap").is_visible(), "aparece «Toca para entrar»")
        page.screenshot(path=str(SHOTS / "phone-844x390-boot-ready.png"))
        page.locator("#boot-screen").tap()
    page.wait_for_function("() => ZC.lobbyOpen", timeout=4000)
    st = js_state(page)
    ok(st.get("lobbyOpen") and not st.get("lobbyHidden"), "tras la carga entra al lobby en el celular")
    # Esperar a que el personaje del lobby haga su disparo de muestra para la captura
    page.wait_for_function("() => (ZC.lobbyPreviewT % ZC.LOBBY_SHOT_EVERY) > ZC.LOBBY_SHOT_EVERY - 0.3 && (ZC.lobbyPreviewT % ZC.LOBBY_SHOT_EVERY) < ZC.LOBBY_SHOT_EVERY - 0.2", timeout=6000, polling=16)
    page.screenshot(path=str(SHOTS / "phone-844x390-lobby.png"))
    lob = page.evaluate("""() => {
      const r = id => { const e = document.getElementById(id) || document.querySelector(id); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return { gear: r('lobby-gear-name').w > 0 ? r('.lobby-gear') : null, deploy: r('btn-deploy'), map: r('lobby-map-card'), dock: r('.lobby-dock'), stage: r('.lobby-stage') };
    }""")
    def inter(a, b):
        return a["x"] < b["x"] + b["w"] and a["x"] + a["w"] > b["x"] and a["y"] < b["y"] + b["h"] and a["y"] + a["h"] > b["y"]
    ok(lob["gear"] and not inter(lob["gear"], lob["deploy"]) and not inter(lob["gear"], lob["map"]) and not inter(lob["gear"], lob["dock"]),
       "en 844x390 la ficha del arma no pisa Iniciar, el mapa ni los botones", json.dumps(lob))
    ok(not inter(lob["dock"], lob["deploy"]) and not inter(lob["dock"], lob["map"]), "botones del lobby sin solaparse", json.dumps(lob))
    page.locator("#btn-deploy").tap()
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("state") == "playing", "la partida arranca en el celular", json.dumps(st))
    # --- Caída con cuenta regresiva ---
    page.evaluate("() => { if (window.ZC && ZC.enableTouch) ZC.enableTouch(); }")
    page.wait_for_timeout(500)
    d1 = page.evaluate("() => Object.assign({}, ZC.getState().drop, { y: ZC.player.y, landed: !!ZC.player.landed, bullets: ZC.bullets.length })")
    ok(d1.get("on") and d1.get("count") in (2, 3), "cuenta regresiva visible en el celular", json.dumps(d1))
    ok(not d1.get("landed"), "a mitad de la cuenta el jugador sigue en el aire", json.dumps(d1))
    page.screenshot(path=str(SHOTS / "phone-844x390-drop.png"))
    # el joystick derecho no dispara en el aire
    box = page.locator("#joy-right").bounding_box()
    cdp0 = ctx.new_cdp_session(page)
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    cdp0.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": cx, "y": cy, "id": 7}]})
    for i in range(1, 5):
        cdp0.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": cx + 9 * i, "y": cy, "id": 7}]})
        page.wait_for_timeout(30)
    page.wait_for_timeout(200)
    nb = page.evaluate("() => ({ b: ZC.bullets.length, on: ZC.getState().drop.on })")
    cdp0.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    ok((not nb["on"]) or nb["b"] == 0, "en la caída no se dispara", json.dumps(nb))
    page.wait_for_function("() => !ZC.getState().drop.on", timeout=8000)
    page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "phone-844x390-landing.png"))
    landed = page.evaluate("() => ({ grounded: !!ZC.player.grounded, landed: !!ZC.player.landed, go: ZC.Drop.state.go, elapsed: ZC.match.elapsed })")
    ok(landed["landed"] and landed["go"] > 0, "al llegar a 0 aterriza y sale A COMBATIR", json.dumps(landed))
    bots_still = page.evaluate("() => ZC.bullets.filter(b => b.owner && !b.owner.isPlayer).length")
    ok(bots_still == 0, "los bots esperan el A COMBATIR antes de disparar", str(bots_still))
    page.wait_for_timeout(900)
    # Para las pruebas de controles: que el jugador no muera por un bot cercano
    page.evaluate("() => { ZC.player.maxHp = 1e6; ZC.player.hp = 1e6; }")
    # --- HUD sin solaparse en 844x390 ---
    hud = page.evaluate("""() => {
      const L = ZC.__test.hudLayout();
      const rects = {};
      ['timer', 'minimap', 'top3', 'vitals'].forEach(k => rects['hud:' + k] = L[k]);
      rects['hud:feed'] = { x: L.feed.x, y: L.feed.y, w: L.feed.w, h: L.feed.row * Math.max(1, Math.min(L.feed.rows, ZC.killfeed.length)) };
      ['joy-left', 'joy-right', 'btn-jump', 'btn-reload', 'btn-swap', 'btn-mute', 'btn-full'].forEach(id => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none') rects[id] = { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const feetY = ZC.player.y - ZC.cam.y;
      const headY = feetY - 76;
      return { rects, feetY, headY, viewW: ZC.viewW, viewH: ZC.viewH, inMatch: document.getElementById('app').classList.contains('in-match') };
    }""")
    rects = hud["rects"]
    names = list(rects.keys())
    clashes = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = rects[names[i]], rects[names[j]]
            if a["x"] < b["x"] + b["w"] and a["x"] + a["w"] > b["x"] and a["y"] < b["y"] + b["h"] and a["y"] + a["h"] > b["y"]:
                clashes.append(names[i] + "/" + names[j])
    ok(not clashes, "HUD y controles sin solaparse en 844x390", ", ".join(clashes) + " " + json.dumps(rects))
    ok(all(r["x"] >= 0 and r["y"] >= 0 and r["x"] + r["w"] <= 844.5 and r["y"] + r["h"] <= 390.5 for r in rects.values()),
       "todo el HUD dentro de la pantalla", json.dumps(rects))
    ok(hud["inMatch"] and "btn-mute" in rects and rects["btn-mute"]["x"] < 100, "el botón de silencio pasa a la izquierda en partida", json.dumps(rects.get("btn-mute")))
    ok(rects.get("joy-left") and hud["feetY"] < rects["joy-left"]["y"], "el jugador queda por encima de los joysticks",
       f"pies {hud['feetY']:.0f} vs joystick {rects.get('joy-left', {}).get('y')}")
    ok(hud["headY"] > rects["hud:timer"]["y"] + rects["hud:timer"]["h"] - 20, "y por debajo del cronómetro", f"cabeza {hud['headY']:.0f}")
    small = [k for k in ("btn-jump", "btn-reload", "btn-swap") if k in rects and rects[k]["w"] < 52]
    ok(not small, "botones de salto, recarga y arma de 52 px o más", ", ".join(small))
    # enable and inspect touch controls
    page.evaluate("() => { if (window.ZC && ZC.enableTouch) ZC.enableTouch(); }")
    page.wait_for_timeout(100)
    st = js_state(page)
    ok(st.get("touchShow"), "joysticks visibles en horizontal")
    joys = {j["id"]: j for j in st.get("joys") or []}
    left, right = joys.get("joy-left"), joys.get("joy-right")
    ok(left and left["visible"] and left["w"] >= 80, "joystick izquierdo renderizado", json.dumps(left))
    ok(right and right["visible"] and right["w"] >= 80, "joystick derecho renderizado", json.dumps(right))
    if left and right:
        ok(left["x"] < right["x"], "joystick izquierdo a la izquierda del derecho")
    # drag left stick to move
    x0 = st["x"]
    box = page.locator("#joy-left").bounding_box()
    cdp = ctx.new_cdp_session(page)
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": cx, "y": cy, "id": 1}]})
    for i in range(1, 6):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": cx + 8 * i, "y": cy, "id": 1}]})
        page.wait_for_timeout(30)
    page.wait_for_timeout(400)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    st2 = js_state(page)
    ok(st2["x"] is not None and x0 is not None and st2["x"] > x0 + 5, "el joystick mueve al jugador", f"{x0} -> {st2['x']}")
    # fire with right stick
    mag0 = st2["mag"]
    box = page.locator("#joy-right").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": cx, "y": cy, "id": 2}]})
    for i in range(1, 5):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": cx + 9 * i, "y": cy, "id": 2}]})
        page.wait_for_timeout(30)
    page.wait_for_timeout(250)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    st3 = js_state(page)
    ok(st3["bullets"] >= 1 or (mag0 is not None and st3["mag"] is not None and st3["mag"] < mag0),
       "el joystick derecho dispara", f"bullets={st3['bullets']} mag {mag0}->{st3['mag']}")
    page.evaluate("() => { ZC.player.maxHp = 100; ZC.player.hp = Math.min(100, ZC.player.hp); }")
    page.wait_for_timeout(100)
    page.screenshot(path=str(SHOTS / "phone-844x390-gameplay.png"))
    # Captura fija del disparo: se detiene el bucle, el jugador dispara y se avanza
    # un poco el tiempo para ver la estela saliendo de la boca del fusil.
    shot = page.evaluate("""() => {
      cancelAnimationFrame(ZC.rafId);
      const P = ZC.player;
      P.dead = false; P.hp = P.maxHp; P.gun.current = 'rifle'; P.gun.cooldown = 0; P.gun.reloading = 0; P.gun.rifle.mag = 20;
      P.aimX = 0.97; P.aimY = -0.24; P.vx = 0;
      ZC.bullets.length = 0; ZC.particles.length = 0;
      const n = ZC.util.norm(P.aimX, P.aimY); P.aimX = n.x; P.aimY = n.y;
      const m = ZC.muzzlePoint(P);
      ZC.fireWeapon(P);
      const b0 = ZC.bullets[0];
      const out = { mx: m.x, my: m.y, bx: b0.x, by: b0.y, px: P.x, py: P.y };
      // ráfaga corta: avanzar solo las balas (los demás quietos) para ver la fila saliendo del cañón
      for (let k = 0; k < 2; k++) {
        ZC.updateBullets(0.045); ZC.updateParticles(0.045);
        P.gun.cooldown = 0; ZC.fireWeapon(P);
      }
      P.flash = 0.06; P.hurt = 0;
      ZC.updateBullets(0.016); ZC.updateParticles(0.016);
      ZC.updateCamera && ZC.updateCamera(0);
      ZC.draw();
      const b = ZC.bullets[0];
      out.trailFromX = b ? b.px : null; out.trailFromY = b ? b.py : null;
      out.screenMx = m.x - ZC.cam.x; out.screenMy = m.y - ZC.cam.y;
      return out;
    }""")
    page.screenshot(path=str(SHOTS / "phone-844x390-gameplay-muzzle.png"))
    ok(abs(shot["bx"] - shot["mx"]) < 0.5 and abs(shot["by"] - shot["my"]) < 0.5 and shot["py"] - shot["by"] > 32,
       "en el celular la bala nace en la boca del fusil (no en la cintura)", json.dumps(shot))
    page.evaluate("() => { ZC.lastT = 0; ZC.rafId = requestAnimationFrame(ZC.loop); }")
    # --- Los 3 mapas en horizontal ---
    for map_id in page.evaluate("() => ZC.Maps.list()"):
        page.evaluate("""(id) => {
          ZC.profile.mapId = id; ZC.saveProfile();
          ZC.startMatch();
        }""", map_id)
        page.wait_for_function("() => !ZC.getState().drop.on", timeout=8000)
        page.wait_for_timeout(1400)
        info = page.evaluate("() => ({ map: ZC.map.id || ZC.profile.mapId, feet: ZC.player.y - ZC.cam.y, joyTop: document.getElementById('joy-left').getBoundingClientRect().y, dead: ZC.player.dead })")
        page.screenshot(path=str(SHOTS / f"phone-844x390-map-{map_id}.png"))
        ok(info["dead"] or info["feet"] < info["joyTop"] + 8, f"mapa {map_id}: jugador visible sobre los controles", json.dumps(info))
    ok(not logs["errors"], "sin errores de consola en horizontal 844x390", "; ".join(logs["errors"][:5]))
    ctx.close()
    browser.close()

print("")
print(f"Resultado: {len(oks)} ok, {len(fails)} fallos")
for f in fails:
    print(" -", f)
sys.exit(1 if fails else 0)
