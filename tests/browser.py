#!/usr/bin/env python3
"""Pruebas en navegador real (Chrome headless) para Zona Cero.

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
    page.wait_for_timeout(400)
    ok(page.locator("h1").first.inner_text().strip().upper().startswith("ZONA CERO"), "título visible")
    ok(page.locator("#btn-play").is_visible(), "botón Jugar visible")
    page.screenshot(path=str(SHOTS / "desktop-title.png"))
    style = page.evaluate("""() => {
      const cs = el => getComputedStyle(el);
      const cta = cs(document.getElementById('btn-play'));
      const h1 = cs(document.querySelector('h1'));
      return { ctaBg: cta.backgroundImage + ' ' + cta.backgroundColor, ctaShadow: cta.boxShadow,
               h1Shadow: h1.textShadow, bodyBg: cs(document.body).backgroundColor };
    }""")
    neon = ("92, 228, 255", "106, 239, 255", "43, 183, 214")
    ok(not any(n in json.dumps(style) for n in neon), "botón y título sin cian neón", json.dumps(style))
    ok(style["bodyBg"] == "rgb(23, 19, 14)", "fondo de página tierra oscuro", style["bodyBg"])
    page.wait_for_function("() => window.ZC && ZC.Maps.list().every(id => ZC.Maps.imageFor(ZC.Maps.all[id]))", timeout=8000)
    loaded = page.evaluate("() => ZC.Maps.list().map(id => [id, !!ZC.Maps.imageFor(ZC.Maps.all[id])])")
    ok(all(v for _, v in loaded), "las imágenes de fondo de todos los mapas cargan", json.dumps(loaded))
    page.click("#btn-play")
    page.wait_for_timeout(500)
    st = js_state(page)
    ok(st.get("lobbyOpen") and not st.get("lobbyHidden"), "Jugar abre el lobby", json.dumps(st))
    ok(page.locator("#btn-deploy").is_visible(), "botón Iniciar visible")
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
    page.screenshot(path=str(SHOTS / "desktop-lobby.png"))
    page.click("#btn-deploy")
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("state") == "playing" and st.get("hasPlayer"), "la partida arranca", json.dumps(st))
    ok(st.get("lobbyHidden") and st.get("titleHidden"), "lobby y menú quedan ocultos")
    x0, y0 = st["x"], st["y"]
    # move right and jump
    page.keyboard.down("KeyD")
    page.wait_for_timeout(500)
    page.keyboard.up("KeyD")
    st = js_state(page)
    ok(st["x"] is not None and st["x"] > x0 + 10, "el jugador se mueve a la derecha", f"{x0} -> {st['x']}")
    page.keyboard.down("Space")
    page.wait_for_timeout(120)
    page.keyboard.up("Space")
    st = js_state(page)
    ok(st["y"] is not None and st["y"] < y0 - 5, "el salto eleva al jugador", f"{y0} -> {st['y']}")
    # shoot: aim right and click
    page.mouse.move(1100, 360)
    mag0 = js_state(page)["mag"]
    page.mouse.down()
    page.wait_for_timeout(120)
    page.mouse.up()
    st = js_state(page)
    ok(st["bullets"] >= 1 or (mag0 is not None and st["mag"] is not None and st["mag"] < mag0),
       "el disparo funciona", f"bullets={st['bullets']} mag {mag0}->{st['mag']}")
    page.screenshot(path=str(SHOTS / "desktop-gameplay.png"))
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
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("portraitDisplay") == "flex", "aviso de girar a horizontal en retrato", st.get("portraitDisplay"))
    # force-enable touch UI to measure controls even under the warning
    page.evaluate("() => { if (window.ZC && ZC.enableTouch) ZC.enableTouch(); }")
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
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("portraitDisplay") == "none", "sin aviso de rotación en horizontal", st.get("portraitDisplay"))
    page.locator("#btn-play").tap()
    page.wait_for_timeout(500)
    st = js_state(page)
    ok(st.get("lobbyOpen") and not st.get("lobbyHidden"), "lobby abre en el celular")
    page.screenshot(path=str(SHOTS / "phone-844x390-lobby.png"))
    page.locator("#btn-deploy").tap()
    page.wait_for_timeout(400)
    st = js_state(page)
    ok(st.get("state") == "playing", "la partida arranca en el celular", json.dumps(st))
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
    page.screenshot(path=str(SHOTS / "phone-844x390-gameplay.png"))
    ok(not logs["errors"], "sin errores de consola en horizontal 844x390", "; ".join(logs["errors"][:5]))
    ctx.close()
    browser.close()

print("")
print(f"Resultado: {len(oks)} ok, {len(fails)} fallos")
for f in fails:
    print(" -", f)
sys.exit(1 if fails else 0)
