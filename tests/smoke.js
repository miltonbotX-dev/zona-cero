#!/usr/bin/env node
/**
 * Pruebas estáticas y de lógica para Zona Cero (edición modular).
 * No abre navegador ni usa Playwright: arma stubs de DOM/canvas y carga
 * los scripts clásicos en el mismo orden que index.html.
 *
 * Uso: node tests/smoke.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "index.html");

let failed = 0;
let passed = 0;
const errors = [];

function ok(cond, name, extra) {
  if (cond) {
    passed += 1;
    console.log("  OK  " + name);
  } else {
    failed += 1;
    const msg = "FALLÓ " + name + (extra ? " — " + extra : "");
    errors.push(msg);
    console.log("  FAIL  " + msg);
  }
}

function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-3); }

// ---------------------------------------------------------------------------
// 1) Revisión estática del HTML
// ---------------------------------------------------------------------------
console.log("1. Revisión estática");
ok(fs.existsSync(htmlPath), "existe index.html");
const html = fs.readFileSync(htmlPath, "utf8");
ok(html.indexOf("<canvas") >= 0, "incluye un canvas");
ok(html.indexOf('lang="es"') >= 0, "marcado en español");
ok(/Jugar/.test(html), "botón o texto Jugar");
ok(/WASD/.test(html), "menciona controles WASD");
ok(/joystick/i.test(html), "menciona joystick");
ok(/<title>ZCero<\/title>/.test(html), "título ZCero (nombre del juego)");
ok(!/https?:\/\//i.test(html), "index.html sin URLs de red");
ok(!/cdn|unpkg|jsdelivr|googleapis|cloudflare/i.test(html), "sin CDN");
ok(!/WebSocket|firebase|socket\.io/i.test(html), "sin red / multijugador");
ok(!/adsbygoogle|doubleclick|adsense/i.test(html), "sin anuncios reales");
ok(/id="end-screen"[^>]*\bhidden\b/.test(html), "end-screen nace con atributo hidden");
ok(/<div id="boot-screen"[^>]*class="overlay active boot"/.test(html) && !/<div id="boot-screen"[^>]*\bhidden\b/.test(html), "boot-screen (logo y carga) es lo primero que se ve");
ok(/<div id="title-screen"[^>]*\bhidden\b/.test(html), "title-screen nace oculto (ahora se entra por la carga al lobby)");
ok(html.indexOf('id="boot-screen"') < html.indexOf('id="title-screen"'), "la entrada va antes del menú en el HTML");
ok(/id="boot-logo"[^>]*src="assets\/logo\.svg/.test(html), "la entrada muestra el logo de Zona Cero");
ok(/id="boot-fill"/.test(html) && /id="boot-pct"/.test(html) && /id="boot-status"/.test(html), "barra, porcentaje y estado de carga");
ok(/rel="icon"[^>]*href="assets\/logo\.svg/.test(html) && !/href="data:,"/.test(html), "favicon propio (logo), ya no el vacío data:,");
ok(fs.existsSync(path.join(root, "assets", "logo.svg")) && fs.existsSync(path.join(root, "assets", "logo-192.png")), "existen assets/logo.svg y logo-192.png");
ok(!/neón|neon/i.test(fs.readFileSync(path.join(root, "assets", "logo.svg"), "utf8")) && !/#5ce4ff|#6aefff|#2bb7d6/i.test(fs.readFileSync(path.join(root, "assets", "logo.svg"), "utf8")), "logo en paleta tierra, sin cian");
ok(/id="lobby-gear-name"/.test(html), "el lobby muestra el arma en mano junto al personaje");
ok(/href="css\/style\.css(\?v=[\w.]+)?"/.test(html), "enlaza css/style.css");
ok(/\?v=1\.6\.0/.test(html) && !/\?v=1\.[0-5]\.0/.test(html), "index.html marca los archivos con la versión 1.6.0 (sin caché viejo)");
// v1.6) Videos de entrada, marca en un solo lugar e íconos
ok(/<video id="boot-video-creator"[^>]*src="assets\/creadorAmilthon\.mp4/.test(html) && /<video id="boot-video-intro"[^>]*src="assets\/intro\.mp4/.test(html), "la entrada tiene el video del creador y el de intro");
ok(html.indexOf('id="boot-video-creator"') < html.indexOf('id="boot-video-intro"'), "primero el creador, luego la intro");
ok((html.match(/<video [^>]*\bmuted\b[^>]*\bplaysinline\b/g) || []).length === 2, "los dos videos arrancan sin sonido y dentro de la página (muted + playsinline)");
ok(fs.existsSync(path.join(root, "assets", "creadorAmilthon.mp4")) && fs.existsSync(path.join(root, "assets", "intro.mp4")), "existen assets/creadorAmilthon.mp4 e intro.mp4");
ok(/id="boot-skip"[^>]*aria-label="Saltar/.test(html) && /id="boot-sound"/.test(html), "botón Saltar y botón de sonido en los videos");
ok(/id="boot-credit"[\s\S]{0,200}data-brand="creator">Amilthon</.test(html), "firma «Amilthon» sobre el video del creador");
ok(/©Amilthon company/.test(html) && /Battle royale/.test(html) && /Último superviviente/.test(html) && /Fin de la partida/.test(html), "se mantienen los textos del usuario");
ok((html.match(/data-brand="name"/g) || []).length >= 3, "el nombre del juego se marca con data-brand (fácil de cambiar)");
(function () {
  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
  const noIcon = buttons.filter(function (b) { return b.indexOf('class="ico') < 0 && b.indexOf("lobby-gear") < 0 && b.indexOf("lobby-map-card") < 0; });
  ok(buttons.length >= 20 && noIcon.length === 0, "todos los botones del HTML llevan ícono SVG", noIcon.join(" | ").slice(0, 300));
  const noLabel = buttons.filter(function (b) { const tag = b.match(/<button\b[^>]*>/)[0]; return !/aria-label="[^"]+"/.test(tag) || !/title="[^"]+"/.test(tag); });
  ok(noLabel.length === 0, "cada botón con ícono tiene aria-label y title", noLabel.map(function (b) { return b.slice(0, 80); }).join(" | "));
  const uses = (html.match(/href="#i-([\w-]+)"/g) || []).map(function (u) { return u.slice(9, -1); });
  const missing = uses.filter(function (u) { return html.indexOf('<symbol id="i-' + u + '"') < 0; });
  ok(uses.length > 0 && missing.length === 0, "cada ícono usado está dibujado en index.html", missing.join(", "));
})();
ok(!/[⚙←♪]/.test(html), "sin ⚙, ← ni ♪ (el engranaje ya no puede salir como emoji)");
ok(!/font-awesome|material-icons|icon-font|fonts\.g/i.test(html), "sin fuentes de íconos externas");

const cssPath = path.join(root, "css", "style.css");
ok(fs.existsSync(cssPath), "existe css/style.css");
const css = fs.readFileSync(cssPath, "utf8");
ok(/\[\s*hidden\s*\]\s*\{[^}]*display\s*:\s*none\s*!important/i.test(css),
  "regla CSS [hidden]{display:none!important} para que display:flex no lo pise");
ok(/\.overlay\s*\{[^}]*display\s*:\s*flex/i.test(css),
  ".overlay declara display:flex (conflicto que [hidden] debe ganar)");

const scriptSrcs = [];
// El ?v=... solo evita que el celular use una copia vieja en caché
html.replace(/<script\s+src="([^"?]+)(?:\?v=[\w.]+)?"><\/script>/g, function (_, src) { scriptSrcs.push(src); return ""; });
const expected = [
  "js/zc.js", "js/config.js", "js/weapons.js", "js/maps.js", "js/entities.js",
  "js/physics.js", "js/combat.js", "js/zone.js", "js/bots.js", "js/player.js",
  "js/drop.js", "js/input.js", "js/audio.js", "js/appearance.js", "js/render.js", "js/ui.js", "js/lobby.js", "js/boot.js", "js/game.js"
];
ok(scriptSrcs.length === expected.length, "carga " + expected.length + " scripts locales", String(scriptSrcs.length));
ok(scriptSrcs.every(function (s, i) { return s === expected[i]; }),
  "orden de scripts coincide con la arquitectura", scriptSrcs.join(" -> "));
ok(scriptSrcs.every(function (s) { return s.indexOf("http") < 0 && s.indexOf("//") < 0; }),
  "ningún script apunta a la red");

const jsParts = [];
expected.forEach(function (rel) {
  const fp = path.join(root, rel);
  ok(fs.existsSync(fp), "existe " + rel);
  const code = fs.readFileSync(fp, "utf8");
  ok(/Contrato:/.test(code) || rel === "js/zc.js", "documenta contrato o es el núcleo (" + rel + ")");
  try {
    new vm.Script(code, { filename: rel });
    ok(true, "sintaxis válida " + rel);
  } catch (e) {
    ok(false, "sintaxis válida " + rel, e.message);
  }
  jsParts.push("//# " + rel + "\n" + code);
});
const js = jsParts.join("\n;\n");

// ---------------------------------------------------------------------------
// 2) Stubs de DOM / canvas
// ---------------------------------------------------------------------------
console.log("2. Carga del motor con stubs");

function makeEl(id) {
  return {
    id: id || "",
    style: { width: "", height: "", transform: "", cursor: "" },
    hidden: false,
    textContent: "",
    innerHTML: "",
    width: 1280,
    height: 720,
    clientWidth: 1280,
    clientHeight: 720,
    parentElement: null,
    classList: {
      _s: new Set(),
      add: function (c) { this._s.add(c); },
      remove: function (c) { this._s.delete(c); },
      toggle: function (c, f) {
        if (f === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); }
        else if (f) this._s.add(c); else this._s.delete(c);
      },
      contains: function (c) { return this._s.has(c); }
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    setPointerCapture: function () {},
    releasePointerCapture: function () {},
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0 };
    },
    getContext: function () { return makeCtx(); },
    setAttribute: function () {},
    getAttribute: function () { return null; },
    value: "",
    scrollIntoView: function () {},
    querySelector: function () { return makeEl("child"); },
    querySelectorAll: function () { return []; }
  };
}

function makeCtx() {
  const grad = { addColorStop: function () {} };
  const ctx = {
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, font: "", textAlign: "left",
    globalAlpha: 1, shadowColor: "", shadowBlur: 0, lineCap: "butt",
    setTransform: function () {}, clearRect: function () {}, save: function () {}, restore: function () {},
    translate: function () {}, rotate: function () {}, scale: function () {},
    fillRect: function () {}, strokeRect: function () {}, fillText: function () {}, strokeText: function () {},
    beginPath: function () {}, closePath: function () {}, moveTo: function () {}, lineTo: function () {},
    arc: function () {}, arcTo: function () {}, ellipse: function () {},
    fill: function () {}, stroke: function () {}, clip: function () {},
    setLineDash: function () {}, measureText: function (s) { return { width: String(s || "").length * 7 }; },
    createLinearGradient: function () { return grad; },
    createRadialGradient: function () { return grad; },
    rect: function () {},
    quadraticCurveTo: function () {},
    bezierCurveTo: function () {}
  };
  return ctx;
}

const elements = {};
function getEl(id) {
  if (!elements[id]) elements[id] = makeEl(id);
  return elements[id];
}
const canvas = getEl("game");
const app = getEl("app");
canvas.parentElement = app;
// Estado inicial: resultado hidden, menú visible (como antes de la v1.5; las pruebas
// de lógica lo usan así). La sección «Entrada» prueba la secuencia nueva.
getEl("end-screen").hidden = true;
getEl("title-screen").hidden = false;
getEl("title-screen").classList.add("active");
getEl("boot-screen").hidden = true;
getEl("lobby-screen").hidden = true;
getEl("layout-bar").hidden = true;

const documentStub = {
  readyState: "complete",
  body: getEl("body"),
  documentElement: getEl("html"),
  getElementById: getEl,
  createElement: function (tag) { return makeEl(tag); },
  addEventListener: function () {},
  removeEventListener: function () {},
  querySelector: function (sel) {
    if (sel && sel.charAt(0) === "#") return getEl(sel.slice(1));
    return makeEl("q");
  },
  querySelectorAll: function () { return []; }
};

const rafCalls = [];
const sandbox = {
  window: null,
  document: documentStub,
  globalThis: null,
  console: console,
  Math: Math,
  Date: Date,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (cb) { rafCalls.push(cb); return rafCalls.length; },
  cancelAnimationFrame: function () {},
  addEventListener: function () {},
  removeEventListener: function () {},
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  AudioContext: undefined,
  matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
  navigator: { userAgent: "zc-smoke" },
  __ZC_TEST__: true,
  Element: function () {},
  HTMLElement: function () {},
  Node: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;

try {
  vm.runInNewContext(js, sandbox, { filename: "zona-cero-modular.js" });
  ok(!!sandbox.ZonaCero, "ZonaCero queda expuesto");
  ok(!!sandbox.ZC && sandbox.ZC === sandbox.ZonaCero, "ZC y ZonaCero son el mismo namespace");
  ok(Array.isArray(sandbox.ZC.SCRIPT_ORDER) && sandbox.ZC.SCRIPT_ORDER.join() === expected.join(),
    "ZC.SCRIPT_ORDER documenta el mismo orden que index.html");
} catch (e) {
  ok(false, "evalúa el motor modular", e && e.stack ? e.stack : e);
  finish();
}

const ZC = sandbox.ZonaCero;
try {
  ZC.mount({ autoLoop: false });
  ok(true, "mount({ autoLoop: false }) no lanza");
} catch (e) {
  ok(false, "mount({ autoLoop: false }) no lanza", e && e.stack);
  finish();
}
ok(rafCalls.length === 0, "no arranca requestAnimationFrame en modo test");
// Las pruebas de lógica de la v1-v1.3 corren sin la caída inicial; la sección
// «Despliegue» de más abajo la prueba con su duración real.
const DROP_DEFAULT = ZC.cfg.dropTime;
ZC.cfg.dropTime = 0;

// ---------------------------------------------------------------------------
// 3) Utilidades puras
// ---------------------------------------------------------------------------
console.log("3. Utilidades");
const U = ZC.utils;
ok(U.clamp(5, 0, 3) === 3 && U.clamp(-1, 0, 3) === 0 && U.clamp(1, 0, 3) === 1, "clamp");
ok(approx(U.lerp(0, 10, 0.25), 2.5), "lerp");
ok(U.aabb(0, 0, 10, 10, 5, 5, 10, 10), "aabb solapa");
ok(!U.aabb(0, 0, 10, 10, 20, 20, 4, 4), "aabb no solapa");
ok(U.segmentHitsAABB(0, 5, 20, 5, 8, 0, 4, 10), "segmento cruza caja");
ok(!U.segmentHitsAABB(0, 0, 5, 0, 50, 50, 10, 10), "segmento no cruza caja lejana");
ok(approx(U.norm(3, 4).l, 5), "norm longitud");

// ---------------------------------------------------------------------------
// 4) Partida, física, armas, cobertura, zona, victoria
// ---------------------------------------------------------------------------
console.log("4. Lógica de partida");
try {
  ZC.startMatch();
  ok(true, "startMatch no lanza");
} catch (e) {
  ok(false, "startMatch no lanza", e && e.stack);
  finish();
}

let st = ZC.getState();
ok(st.mode === "playing", "estado playing", st.mode);
ok(st.actors.length === 8, "1 jugador + 7 bots", String(st.actors.length));
ok(st.alive === 8, "8 vivos al empezar", String(st.alive));
ok(!!st.player && st.player.hp === 100 && !st.player.dead, "jugador con 100 de vida");
ok(st.loot > 0, "hay loot inicial", String(st.loot));
ok(st.player.weapon === "rifle", "empieza con fusil");
ok(st.zone.r > 1000, "zona inicial amplia");

function freezeBots() {
  ZC.__test.actors.forEach(function (a) {
    if (!a.isPlayer) {
      a.ai = null;
      a.vx = 0;
    }
  });
}

const player = ZC.__test.player;
freezeBots();
const groundY = ZC.cfg.groundY;

// Física: colocar en suelo abierto (x=600 no debería estar dentro de una caja)
player.x = 600;
player.y = groundY;
player.vx = 0; player.vy = 0;
ZC.update(1 / 60);
ok(player.grounded, "queda plantado en el suelo");
ok(Math.abs(player.y - groundY) < 1, "pies a la altura del suelo", String(player.y));

const y0 = player.y;
const jumped = ZC.__test.tryJump();
ok(jumped && player.vy < 0, "salto impulsa hacia arriba", "vy=" + player.vy);
ZC.update(1 / 60);
ok(player.y < y0, "tras un frame está más alto", player.y + " vs " + y0);

// Doble salto: en el aire, sin coyote
player.grounded = false;
player.coyote = 0;
player.jumpsLeft = 1;
player.vy = 80;
const djump = ZC.__test.tryJump();
ok(djump && player.vy < 0 && player.jumpsLeft === 0, "doble salto consume el extra");
const triple = ZC.__test.tryJump();
ok(!triple, "no hay triple salto");

// Disparo
player.x = 200; player.y = groundY;
player.gun.current = "rifle";
player.gun.rifle.mag = 24;
player.gun.cooldown = 0;
player.gun.reloading = 0;
ZC.__test.setAim(1, 0);
const b0 = ZC.getState().bullets;
const fired = ZC.__test.fire();
ok(fired, "dispara el fusil");
ok(ZC.getState().bullets === b0 + 1, "aparece un proyectil");
ok(player.gun.rifle.mag === 23, "consume una bala del cargador");
const blocked = ZC.__test.fire();
ok(!blocked, "respeta el cooldown");

// Recarga
player.gun.rifle.mag = 4;
player.gun.rifle.reserve = 30;
player.gun.cooldown = 0;
player.gun.reloading = 0;
ok(ZC.__test.startReload(), "inicia recarga");
ok(player.gun.reloading > 0, "temporizador de recarga activo");
for (let i = 0; i < 80; i++) ZC.update(0.02);
ok(player.gun.rifle.mag === 24, "recarga completa el cargador", String(player.gun.rifle.mag));
ok(player.gun.rifle.reserve === 10, "resta la reserva", String(player.gun.rifle.reserve));

// Loot de vida
player.hp = 50;
ZC.__test.pick(player, { type: "health" });
ok(player.hp === 88, "botiquín suma 38 (tope 100)", String(player.hp));
ZC.__test.pick(player, { type: "health" });
ok(player.hp === 100, "la vida no supera 100", String(player.hp));
const reserveBefore = player.gun.rifle.reserve;
ZC.__test.pick(player, { type: "ammo" });
ok(player.gun.rifle.reserve > reserveBefore, "munición incrementa reserva");

// Cobertura: caja conocida en x=310, y=groundY-40
const crateX = 310, crateY = groundY - 40;
// Un bot detrás de la caja
let dummy = null;
ZC.__test.actors.forEach(function (a) { if (!a.isPlayer && !dummy) dummy = a; });
const dummyHp = dummy.hp;
dummy.x = 430; dummy.y = groundY; dummy.dead = false;
player.x = 250; player.y = groundY;
player.gun.current = "rifle";
player.gun.rifle.mag = 24;
player.gun.cooldown = 0;
player.gun.reloading = 0;
ZC.__test.setAim(1, 0);
ZC.__test.fire();
// Avanza las balas lo suficiente para chocar (~60 px a 1000 px/s = 0.06s, damos margen)
for (let i = 0; i < 20; i++) ZC.update(1 / 60);
ok(dummy.hp === dummyHp, "la caja bloquea la bala (el bot detrás no recibe daño)", dummy.hp + " vs " + dummyHp);

// Disparo con línea limpia (tramo de suelo 580-760, sin cajas) y bot quieto
dummy.ai = null;
dummy.x = 740; dummy.y = groundY; dummy.hp = 100; dummy.dead = false; dummy.vx = 0;
player.x = 580; player.y = groundY;
player.gun.cooldown = 0; player.gun.reloading = 0; player.gun.rifle.mag = 24;
ZC.__test.setAim(1, 0);
ZC.__test.fire();
for (let i = 0; i < 20; i++) ZC.update(1 / 60);
ok(dummy.hp < 100, "una bala sin cobertura hace daño", String(dummy.hp));
dummy.ai = { think: 9, target: null, state: "wander", inaccuracy: 0.1, aggress: 0.5, nextJump: 0 };

// Zona: forzar un círculo lejos del jugador
const hpBefore = player.hp;
ZC.__test.forceZone(0, 0, 40, 20);
ok(!U.inZone(player.x, player.y - 16), "el jugador queda fuera de la zona forzada");
for (let i = 0; i < 40; i++) ZC.update(0.05);
ok(player.hp < hpBefore, "la zona daña fuera del círculo", player.hp + " vs " + hpBefore);

// Victoria: eliminar al resto
ZC.startMatch();
const hero = ZC.__test.player;
ZC.__test.actors.forEach(function (a) {
  if (!a.isPlayer) ZC.__test.applyDamage(a, 500, hero, "shot");
});
st = ZC.getState();
ok(st.mode === "over", "la partida termina al quedar uno", st.mode);
ok(st.winner === "Tú", "el jugador es el último superviviente", String(st.winner));
ok(st.alive === 1, "un vivo", String(st.alive));
ok(st.player.kills >= 7, "registra las eliminaciones", String(st.player.kills));

// Derrota / otro ganador: matar al jugador y dejar un bot
ZC.startMatch();
const victim = ZC.__test.player;
const bots = ZC.__test.actors.filter(function (a) { return !a.isPlayer; });
ZC.__test.applyDamage(victim, 500, bots[0], "shot");
bots.forEach(function (b, i) {
  if (i > 0) ZC.__test.applyDamage(b, 500, bots[0], "shot");
});
st = ZC.getState();
ok(st.mode === "over", "termina también si gana un bot");
ok(st.winner === bots[0].name, "el bot restante gana", String(st.winner));
ok(st.player.dead, "el jugador figura eliminado");

// Reinicio
ZC.startMatch();
st = ZC.getState();
ok(st.mode === "playing" && st.alive === 8 && st.player.hp === 100 && !st.player.dead,
  "reiniciar restaura una partida limpia");
ok(st.playerKills === undefined || ZC.getState().player.kills === 0, "kills del jugador a cero");

// Simulación corta sin excepciones y dentro del mundo
let threw = null;
try {
  for (let i = 0; i < 180; i++) ZC.update(1 / 60);
} catch (e) {
  threw = e;
}
ok(!threw, "180 frames de simulación sin excepción", threw && threw.stack);
st = ZC.getState();
const inside = ZC.__test.actors.every(function (a) {
  return a.x >= 0 && a.x <= ZC.cfg.worldW && a.y >= 0 && a.y <= ZC.cfg.worldH + 40;
});
ok(inside, "nadie se sale del mundo en la simulación corta");
ok(typeof ZC.draw === "function", "draw está expuesto");
try { ZC.draw(); ok(true, "draw() no lanza con el stub de canvas"); }
catch (e) { ok(false, "draw() no lanza con el stub de canvas", e && e.message); }

// ---------------------------------------------------------------------------
// 5) Visibilidad de overlays al iniciar / terminar / reiniciar
// Replica la cascada real: [hidden]{display:none!important} gana a .overlay{display:flex}
// ---------------------------------------------------------------------------
console.log("5. Visibilidad de overlays");

function overlayShown(el) {
  // Con la regla corregida, hidden es la fuente de verdad visual.
  return !el.hidden;
}

const titleEl = documentStub.getElementById("title-screen");
const endEl = documentStub.getElementById("end-screen");

ZC.goMenu();
ok(overlayShown(titleEl), "menú: pantalla inicial visible");
ok(!overlayShown(endEl), "menú: resultado oculto");
ok(titleEl.classList.contains("active"), "menú: título recibe clics");
ok(!endEl.classList.contains("active"), "menú: resultado no recibe clics");

ZC.startMatch();
ok(!overlayShown(titleEl), "Jugar: oculta la pantalla inicial");
ok(!overlayShown(endEl), "Jugar: el resultado no queda superpuesto");
ok(!titleEl.classList.contains("active"), "Jugar: título no intercepta el juego");
ok(!endEl.classList.contains("active"), "Jugar: resultado no intercepta el juego");

const closer = ZC.__test.player;
ZC.__test.actors.forEach(function (a) {
  if (!a.isPlayer) ZC.__test.applyDamage(a, 500, closer, "shot");
});
ok(overlayShown(endEl), "fin de partida: resultado visible");
ok(!overlayShown(titleEl), "fin de partida: título sigue oculto");
ok(endEl.classList.contains("active"), "fin de partida: resultado interactivo");

ZC.startMatch();
ok(!overlayShown(endEl), "Jugar de nuevo: oculta el resultado");
ok(!overlayShown(titleEl), "Jugar de nuevo: no reabre el menú");
ok(!endEl.classList.contains("active"), "Jugar de nuevo: resultado ya no intercepta clics");
ok(ZC.getState().mode === "playing", "Jugar de nuevo deja la partida en playing");

ZC.goMenu();
ok(overlayShown(titleEl) && !overlayShown(endEl), "Menú: título visible y resultado oculto");

// ---------------------------------------------------------------------------
// 6) Lobby, aspectos y mapas añadidos en esta edición
// ---------------------------------------------------------------------------
console.log("6. Lobby, aspectos y mapas");
const lobbyEl = documentStub.getElementById("lobby-screen");
ok(!!ZC.Appearance && typeof ZC.Appearance.draw === "function", "ZC.Appearance.draw está expuesto");
ok(ZC.Appearance.get("operativo") && ZC.Appearance.get("sombra") && ZC.Appearance.get("pesado"),
  "tres aspectos registrados");
ok(ZC.Maps.list().indexOf("arena-industrial") >= 0 &&
  ZC.Maps.list().indexOf("muelle") >= 0 &&
  ZC.Maps.list().indexOf("azoteas") >= 0, "tres mapas registrados", String(ZC.Maps.list()));
ok(typeof ZC.openLobby === "function" && typeof ZC.startFromLobby === "function", "API del lobby expuesta");

ZC.goMenu();
ZC.openLobby();
ok(ZC.lobbyOpen, "openLobby deja lobbyOpen");
ok(overlayShown(lobbyEl), "lobby visible");
ok(!overlayShown(titleEl) && !overlayShown(endEl), "lobby oculta título y resultado");
ok(ZC.profile && ZC.profile.look === "operativo", "perfil por defecto: operativo");

ZC.profile.name = "Amil";
ZC.profile.look = "sombra";
ZC.profile.mapId = "muelle";
ZC.profile.primary = "shotgun";
ZC.profile.carried = ["shotgun", "rifle"];
documentStub.getElementById("lobby-name").value = "Amil";
ZC.saveProfile();
try { ZC.drawLobbyPreview(); ok(true, "drawLobbyPreview no lanza"); }
catch (e) { ok(false, "drawLobbyPreview no lanza", e && e.message); }

ZC.startFromLobby();
ok(!ZC.lobbyOpen && !overlayShown(lobbyEl), "startFromLobby cierra el lobby");
ok(ZC.getState().mode === "playing", "startFromLobby deja la partida en playing");
ok(ZC.map && ZC.map.id === "muelle", "la partida usa el mapa del perfil", ZC.map && ZC.map.id);
ok(ZC.player && ZC.player.name === "Amil" && ZC.player.look === "sombra",
  "el jugador aplica nombre y aspecto del perfil", ZC.player && (ZC.player.name + " / " + ZC.player.look));
ok(ZC.player.gun.current === "shotgun", "despliega con el arma primaria del perfil", ZC.player.gun.current);
try { ZC.draw(); ok(true, "draw() con aspecto sombra no lanza"); }
catch (e) { ok(false, "draw() con aspecto sombra no lanza", e && e.message); }

// ---------------------------------------------------------------------------
// 7) Estilo tierra/militar (v1.3): fondos con imagen y sin neón
// ---------------------------------------------------------------------------
console.log("7. Fondos con imagen y paleta sin neón");
const NEON = /#5ce4ff|#6aefff|#2bb7d6|#7af0ff|#9be7ff|#7dffb0|#c084fc|rgba\(\s*92\s*,\s*2[0-9]{2}\s*,\s*255/i;
ok(!NEON.test(css), "css/style.css ya no usa el cian/lila neón");
ok(!/text-shadow\s*:[^;]*rgba\(\s*92/i.test(css), "sin text-shadow cian en el CSS");
ok(!/--cyan/.test(css), "la variable --cyan desaparece del CSS");
ok(/--bg:\s*#17130e/i.test(css), "fondo base cálido (--bg #17130e)");
["render.js", "appearance.js", "lobby.js", "config.js", "weapons.js", "combat.js"].forEach(function (f) {
  const code = fs.readFileSync(path.join(root, "js", f), "utf8");
  ok(!NEON.test(code), "js/" + f + " sin colores neón");
});
const renderSrc = fs.readFileSync(path.join(root, "js", "render.js"), "utf8");
ok(!/shadowBlur\s*=\s*[1-9]/.test(renderSrc), "render.js no usa brillos (shadowBlur)");
ok(!/ZC\.stars\.forEach/.test(renderSrc), "render.js ya no pinta estrellas encima del fondo");
const appearanceSrc = fs.readFileSync(path.join(root, "js", "appearance.js"), "utf8");
ok(!/shadowBlur\s*=\s*[1-9]/.test(appearanceSrc), "visores sin glow en appearance.js");

ZC.Maps.list().forEach(function (id) {
  const def = ZC.Maps.all[id];
  ok(typeof def.backgroundImage === "string" && /^assets\/maps\/[a-z0-9-]+\.(webp|jpe?g|png)$/.test(def.backgroundImage),
    "mapa " + id + " declara backgroundImage relativo", def.backgroundImage);
  const file = def.backgroundImage ? path.join(root, def.backgroundImage) : "";
  ok(file && fs.existsSync(file) && fs.statSync(file).size > 10000 && fs.statSync(file).size < 400000,
    "la imagen de " + id + " existe y pesa poco (<400 KB)", file);
  ok(Array.isArray(def.bgFallback) && def.bgFallback.length === 3, "mapa " + id + " trae color tierra de respaldo");
});
ok(typeof ZC.Maps.preload === "function" && typeof ZC.Maps.imageFor === "function", "API de precarga de fondos");
ok(ZC.Maps.imageFor(ZC.map) === null, "sin Image (stub) imageFor devuelve null y se usa el respaldo");

// Simula imágenes ya cargadas: el fondo se dibuja primero, antes que plataformas y cajas.
(function () {
  const calls = [];
  const fakeImg = { complete: true, naturalWidth: 1636, naturalHeight: 920 };
  ZC.Maps.list().forEach(function (id) { ZC.Maps.images[ZC.Maps.all[id].backgroundImage] = fakeImg; });
  const realCtx = ZC.ctx;
  const spy = Object.assign({}, makeCtx());
  spy.drawImage = function (img, x, y, w, h) { calls.push({ op: "img", x: x, y: y, w: w, h: h }); };
  spy.fillRect = function () { calls.push({ op: "rect" }); };
  ZC.ctx = spy;
  ZC.Maps.list().forEach(function (id) {
    calls.length = 0;
    ZC.Maps.use(id);
    try {
      ZC.drawBackdrop();
      const nBack = calls.length;
      ZC.drawWorld();
      const imgIdx = calls.findIndex(function (c) { return c.op === "img"; });
      ok(imgIdx >= 0 && imgIdx < nBack, "drawBackdrop dibuja la imagen de " + id + " antes del mundo");
      const r = calls[imgIdx];
      ok(r && r.h >= ZC.CFG.worldH - 1 && r.w >= ZC.viewW - 1, "la imagen de " + id + " cubre el alto del mundo y el ancho de la vista",
        r && (r.w + "x" + r.h));
      ok(r && approx(r.y + r.h, ZC.CFG.worldH, 1), "la imagen de " + id + " queda apoyada abajo del mundo");
    } catch (e) { ok(false, "drawBackdrop con imagen (" + id + ") no lanza", e && e.message); }
  });
  // Parallax: en ambos extremos de la cámara la imagen sigue cubriendo la vista
  ZC.Maps.use("arena-industrial");
  [0, ZC.CFG.worldW - ZC.viewW].forEach(function (cx) {
    ZC.cam.x = cx;
    const r = ZC.backdropRect(fakeImg);
    ok(r.x <= cx + 0.5 && r.x + r.w >= cx + ZC.viewW - 0.5, "parallax cubre la vista con cámara en x=" + cx,
      r.x + ".." + (r.x + r.w));
  });
  ZC.ctx = realCtx;
  ZC.Maps.images = {};
})();

ZC.profile = { name: "Tú", look: "operativo", mapId: "arena-industrial", primary: "rifle", carried: ["rifle", "shotgun"], hp: 100, bots: 7, controlScale: 1, layout: null };
ZC.saveProfile();
ZC.Maps.use("arena-industrial");
ZC.startMatch();

// ---------------------------------------------------------------------------
// v1.4) HUD de celular horizontal y cámara
// ---------------------------------------------------------------------------
console.log("v1.4 HUD en horizontal y cámara");
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
const savedView = { w: ZC.viewW, h: ZC.viewH };
[[844, 390], [740, 360], [667, 375], [915, 412], [1280, 720]].forEach(function (vp) {
  ZC.viewW = vp[0]; ZC.viewH = vp[1];
  const L = ZC.hudLayout();
  const tag = vp[0] + "x" + vp[1];
  ok(L.compact === (vp[1] < 500), "modo compacto correcto en " + tag);
  const panels = { timer: L.timer, minimap: L.minimap, top3: L.top3, vitals: L.vitals,
    feed: { x: L.feed.x, y: L.feed.y, w: L.feed.w, h: L.feed.row * L.feed.rows } };
  const names = Object.keys(panels);
  let clash = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (rectsOverlap(panels[names[i]], panels[names[j]])) clash.push(names[i] + "/" + names[j]);
  }
  ok(clash.length === 0, "paneles del HUD sin solaparse en " + tag, clash.join(", "));
  ok(names.every(function (n) { const r = panels[n]; return r.x >= 0 && r.y >= 0 && r.x + r.w <= vp[0] && r.y + r.h <= vp[1]; }),
    "todos los paneles caben en " + tag);
  ok(L.top3.y >= L.minimap.y + L.minimap.h, "TOP 3 va debajo del minimapa en " + tag);
  ok(L.vitals.y + L.vitals.h > vp[1] * 0.8, "vida y munición abajo en " + tag);
  // Hueco libre para los joysticks: la vida no entra en la franja del joystick izquierdo
  const joyW = L.compact ? 116 : 132;
  ok(L.vitals.x >= L.feed.x + joyW, "la vida no cae encima del joystick izquierdo en " + tag, L.vitals.x + "");
  ok(L.vitals.x + L.vitals.w <= vp[0] - 10 - (L.compact ? 266 : 310), "la vida no cae sobre los botones de la derecha en " + tag,
    (L.vitals.x + L.vitals.w) + "");
  ok(L.warnY < L.vitals.y && L.warnY > L.timer.y + L.timer.h, "aviso de zona entre el cronómetro y la vida en " + tag);
});
// Cámara: en 844x390 los pies del jugador quedan por encima de los joysticks
ZC.viewW = 844; ZC.viewH = 390;
ZC.Maps.use("arena-industrial");
ZC.cfg.dropTime = 0;
ZC.startMatch();
ZC.__test.player.x = 1300; ZC.__test.player.y = ZC.cfg.groundY;
ZC.__test.player.aimX = 1; ZC.__test.player.aimY = 0;
for (let i = 0; i < 240; i++) ZC.updateCamera(1 / 60);
const feetScreen = ZC.cfg.groundY - ZC.cam.y;
ok(feetScreen < 390 - 116 - 10, "en 844x390 los pies en el suelo quedan sobre los joysticks", feetScreen.toFixed(1));
ok(feetScreen > 390 * 0.45, "y no tan arriba que se pierda el suelo", feetScreen.toFixed(1));
ok(ZC.camMaxY() > ZC.cfg.worldH - 390, "la cámara puede bajar más allá del borde del mundo en pantallas bajas");
ZC.viewW = 1280; ZC.viewH = 720;
for (let i = 0; i < 240; i++) ZC.updateCamera(1 / 60);
const feetDesk = ZC.cfg.groundY - ZC.cam.y;
ok(feetDesk < 720 * 0.7, "en 1280x720 el suelo tampoco queda pegado abajo", feetDesk.toFixed(1));
(function () {
  const spy = Object.assign({}, makeCtx());
  let groundH = 0;
  spy.fillRect = function (x, y, w, h) { if (y === ZC.cfg.groundY && h > groundH) groundH = h; };
  const real = ZC.ctx; ZC.ctx = spy;
  ZC.viewW = 844; ZC.viewH = 390; ZC.cam.y = ZC.camMaxY();
  ZC.drawWorld();
  ZC.ctx = real;
  ok(ZC.cfg.groundY + groundH >= ZC.cam.y + 390, "la tierra se pinta hasta el borde inferior de la vista", String(groundH));
})();
ZC.viewW = savedView.w; ZC.viewH = savedView.h;

// ---------------------------------------------------------------------------
// v1.4) Despliegue: caída con cuenta regresiva
// ---------------------------------------------------------------------------
// v1.6) Entrada: video del creador -> video de intro -> carga -> lobby
// ---------------------------------------------------------------------------
console.log("v1.6 Entrada (videos, carga, lobby)");
ok(ZC.version === "1.6.0", "ZC.version es 1.6.0", ZC.version);
ok(ZC.BRAND && ZC.BRAND.name === "ZCero" && ZC.BRAND.creator === "Amilthon", "el nombre vive en ZC.BRAND", JSON.stringify(ZC.BRAND));
ok(typeof ZC.applyBrand === "function" && typeof ZC.icon === "function" && /href="#i-play"/.test(ZC.icon("play")), "ZC.applyBrand y ZC.icon existen");
ok(ZC.Boot && typeof ZC.Boot.step === "function" && typeof ZC.Boot.skip === "function" && typeof ZC.Boot.skipFilm === "function", "ZC.Boot existe con step/skip/skipFilm");
ok(ZC.Boot.phase === "idle", "en modo test la entrada no arranca sola");
ok(ZC.Boot.FILMS.map(function (f) { return f.phase; }).join(",") === "creator,intro", "orden de videos: creador y luego intro");
(function () {
  // Imágenes falsas que cargan cuando el test quiere
  const fakes = [];
  function fakeImg() {
    const im = { complete: false, naturalWidth: 0, _l: {},
      addEventListener: function (t, cb) { this._l[t] = cb; },
      getAttribute: function () { return "assets/logo.svg?v=1.6.0"; } };
    im.finish = function (fail) { im.complete = true; im.naturalWidth = fail ? 0 : 100; (im._l[fail ? "error" : "load"] || function () {})(); };
    fakes.push(im);
    return im;
  }
  // Video falso: avanza solo cuando el test llama a .run(seg). blocked = el navegador no deja reproducir.
  function fakeVideo(id, dur, blocked) {
    const v = makeEl(id);
    Object.assign(v, { currentTime: 0, duration: dur, ended: false, error: null, paused: true, muted: true, preload: "metadata", plays: 0,
      play: function () {
        v.plays++;
        if (v.blockedNow) return { then: function (a, b) { if (b) b(new Error("NotAllowedError")); } };
        v.paused = false;
        return { then: function (a) { if (a) a(); } };
      },
      pause: function () { v.paused = true; } });
    v.blockedNow = !!blocked;
    v.run = function (sec) { if (!v.paused) { v.currentTime = Math.min(v.duration, v.currentTime + sec); if (v.currentTime >= v.duration) v.ended = true; } };
    elements[id] = v;
    return v;
  }
  const savedImgs = ZC.Maps.images;
  ZC.Maps.images = {};
  ZC.Maps.list().forEach(function (id) { ZC.Maps.images[ZC.Maps.all[id].backgroundImage] = fakeImg(); });
  const logo = fakeImg();
  const savedLogo = elements["boot-logo"];
  elements["boot-logo"] = logo;
  ZC.lobbyOpen = false;
  getEl("lobby-screen").hidden = true;
  const T = { minLoad: 0.9, readyHold: 0.8, maxWait: 9, videoStart: 6, videoStall: 3.5, videoMax: 16, creditAt: 3.2 };
  let creator = fakeVideo("boot-video-creator", 10, false);
  let intro = fakeVideo("boot-video-intro", 6, false);
  ZC.Boot.start({ manual: true, timing: T });
  ok(ZC.Boot.phase === "creator" && !getEl("boot-screen").hidden, "al abrir: primero el video del creador");
  ok(!creator.paused && creator.muted && creator.plays === 1, "el video del creador arranca solo y sin sonido");
  ok(!creator.hidden && intro.hidden, "solo se ve el video del creador");
  ok(intro.preload === "auto", "mientras tanto la intro ya se va bajando");
  ok(ZC.Boot.items.length === ZC.Maps.list().length + 1, "la carga espera los fondos de cada mapa y el logo", String(ZC.Boot.items.length));
  ok(getEl("app").classList.contains("booting"), "#app.booting durante la entrada (el aviso de girar espera)");
  function run(sec, v) { for (let t = 0; t < sec - 1e-9; t += 0.05) { if (v) v.run(0.05); ZC.Boot.step(0.05); } }
  run(1.0, creator);
  ok(!getEl("boot-credit").hidden && !getEl("boot-credit").classList.contains("on"), "la firma espera un momento antes de aparecer");
  run(2.6, creator);
  ok(getEl("boot-credit").classList.contains("on"), "luego aparece la firma «Amilthon» (suave, por CSS)");
  ok(ZC.Boot.phase === "creator", "el video del creador sigue mientras se reproduce");
  ZC.Boot.tap();
  ok(ZC.Boot.phase === "creator" && ZC.Boot.sound && !creator.muted, "el primer toque activa el sonido y no salta el video");
  run(7, creator);
  ok(ZC.Boot.phase === "intro", "al terminar el creador pasa a la intro", ZC.Boot.phase);
  ok(creator.paused && creator.hidden && !intro.paused && !intro.hidden, "se pausa y oculta el creador; arranca la intro");
  ok(!intro.muted, "tras el toque la intro ya suena");
  ok(getEl("boot-credit").hidden, "la firma solo va en el video del creador");
  run(1.0, intro);
  ok(ZC.Boot.skipFilm() === "loading", "«Saltar» pasa de la intro a la carga");
  ok(intro.paused && intro.hidden, "la intro se detiene al saltarla");
  ok(ZC.Boot.skipped.length === 0, "nada se saltó por error", ZC.Boot.skipped.join(","));
  fakes.forEach(function (f) { f.complete = false; f.naturalWidth = 0; });
  for (let i = 0; i < 40; i++) ZC.Boot.step(0.05);
  ok(ZC.Boot.phase === "loading" && ZC.Boot.shown === 0, "sin nada cargado la barra no avanza (no miente)", ZC.Boot.shown);
  fakes[0].finish(); fakes[1].finish();
  for (let i = 0; i < 6; i++) ZC.Boot.step(0.05);
  const partial = ZC.Boot.shown;
  ok(partial > 0 && partial <= 0.5 + 1e-9, "con la mitad cargada la barra no pasa del 50 %", partial);
  ok(getEl("boot-pct").textContent === Math.floor(partial * 100) + "%", "el porcentaje en pantalla coincide con la barra", getEl("boot-pct").textContent);
  ok(ZC.Boot.tap() === "loading", "tocar durante la carga no salta nada");
  fakes.slice(2).forEach(function (f, i) { f.finish(i === 0); }); // un fondo falla: cuenta como terminado (usa su degradado)
  ZC.Boot.step(0.05);
  ok(ZC.Boot.phase === "ready" && ZC.Boot.shown === 1, "con todo cargado llega a 100 % y queda lista");
  ok(!getEl("boot-tap").hidden, "aparece «Toca para entrar»");
  ok(!ZC.lobbyOpen, "todavía no entra al lobby");
  ZC.Boot.step(0.9);
  ok(ZC.Boot.phase === "done" && getEl("boot-screen").hidden, "pasa sola tras un momento y se oculta la carga");
  ok(ZC.lobbyOpen && !getEl("lobby-screen").hidden, "termina en el lobby");
  ok(!getEl("app").classList.contains("booting"), "quita #app.booting al terminar");
  ok(getEl("title-screen").hidden, "el menú viejo no se interpone");
  if (ZC.closeLobby) ZC.closeLobby();

  // Videos que fallan: nunca se cuelga
  ZC.Boot.phase = "idle";
  creator = fakeVideo("boot-video-creator", 10, true);   // el navegador no deja reproducir
  intro = fakeVideo("boot-video-intro", 6, false);
  ZC.Boot.start({ manual: true, timing: T });
  ok(ZC.Boot.phase === "creator" && ZC.Boot.film.blocked, "si el navegador bloquea el video, lo detecta");
  ok(!getEl("boot-hint").hidden, "y muestra un botón de play para tocar");
  run(T.videoStart + 0.1, creator);
  ok(ZC.Boot.phase === "intro" && /creator:blocked/.test(ZC.Boot.skipped.join(",")), "si nadie toca, se salta solo tras unos segundos", ZC.Boot.skipped.join(","));
  run(2, intro);
  intro.pause(); // se traba a mitad (red lenta)
  run(T.videoStall + 0.1, intro);
  ok(ZC.Boot.phase === "loading" && /intro:stall/.test(ZC.Boot.skipped.join(",")), "un video trabado se salta y sigue la carga", ZC.Boot.skipped.join(","));
  // Error de carga y video que no existe
  ZC.Boot.phase = "idle";
  creator = fakeVideo("boot-video-creator", 10, false);
  creator.error = { code: 4 };
  delete elements["boot-video-intro"];
  ZC.Boot.start({ manual: true, timing: T });
  ZC.Boot.step(0.05); ZC.Boot.step(0.05);
  ok(ZC.Boot.phase === "loading" && /intro:missing/.test(ZC.Boot.skipped.join(",")), "si un video da error o falta, se pasa directo a lo siguiente", ZC.Boot.phase + " " + ZC.Boot.skipped.join(","));
  // Tope de espera de la carga
  fakes.forEach(function (f) { f.complete = false; f.naturalWidth = 0; });
  ZC.Boot.collect();
  for (let i = 0; i < 200 && ZC.Boot.phase === "loading"; i++) ZC.Boot.step(0.1);
  ok(ZC.Boot.phase === "ready" && ZC.Boot.timedOut && ZC.Boot.shown < 1, "si algo no carga, no se cuelga: entra tras maxWait sin fingir 100 %", ZC.Boot.phase + " " + ZC.Boot.shown);
  ok(/siguen cargando/.test(getEl("boot-status").textContent), "y lo dice en el estado", getEl("boot-status").textContent);
  ok(ZC.Boot.tap() === "done" && ZC.lobbyOpen, "con la carga lista, un toque entra al lobby");
  if (ZC.closeLobby) ZC.closeLobby();
  // Juego en silencio (M): el toque no enciende el sonido de los videos
  ZC.Boot.phase = "idle";
  creator = fakeVideo("boot-video-creator", 10, false);
  intro = fakeVideo("boot-video-intro", 6, false);
  ZC.muted = true;
  ZC.Boot.start({ manual: true, timing: T });
  ZC.Boot.tap();
  ok(!ZC.Boot.sound && creator.muted, "con el juego en silencio los videos siguen sin sonido");
  ZC.muted = false;
  ZC.Boot.skipFilm(); ZC.Boot.skipFilm();
  ok(ZC.Boot.phase === "loading", "dos «Saltar» llevan a la carga");
  ZC.Boot.phase = "idle";
  ZC.__test.skipBoot();
  ok(ZC.Boot.phase === "done" && ZC.lobbyOpen, "skipBoot entra directo al lobby");
  if (ZC.closeLobby) ZC.closeLobby();
  ZC.Maps.images = savedImgs;
  delete elements["boot-video-creator"]; delete elements["boot-video-intro"];
  if (savedLogo) elements["boot-logo"] = savedLogo; else delete elements["boot-logo"];
  getEl("title-screen").hidden = false;
})();

// ---------------------------------------------------------------------------
// v1.5) Las balas salen del cañón, no de la cintura
// ---------------------------------------------------------------------------
console.log("v1.5 Origen del disparo (boca del arma)");
// Contexto espía que sigue la matriz de transformación para saber en qué punto
// del mundo se dibuja el fogonazo (arc pequeño amarillo) y la boca del cañón.
function trackingCtx() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const arcs = [];
  const fills = [];
  const base = makeCtx();
  function mul(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }
  function pt(x, y) { return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; }
  return Object.assign(base, {
    arcs: arcs, fills: fills,
    save: function () { stack.push(m.slice()); },
    restore: function () { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
    setTransform: function (a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    translate: function (x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale: function (x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate: function (r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, [c, s, -s, c, 0, 0]); },
    arc: function (x, y, r) { arcs.push({ p: pt(x, y), r: r, color: this.fillStyle }); },
    fillRect: function (x, y, w, h) { fills.push({ a: pt(x, y), b: pt(x + w, y + h), color: this.fillStyle }); }
  });
}
(function () {
  ZC.cfg.dropTime = 0;
  ZC.startMatch();
  const P = ZC.__test.player;
  const gy = ZC.cfg.groundY;
  const aims = [[1, 0], [-1, 0], [0.8, -0.6], [-0.7, 0.7], [0.6, 0.8], [-0.5, -0.86]];
  const looks = ZC.Appearance.list().map(function (l) { return l.id; });
  const actors = [P, ZC.__test.actors.filter(function (a) { return !a.isPlayer; })[0]];
  let checked = 0, worst = 0, worstMsg = "";
  looks.forEach(function (look) {
    ZC.profile.look = look; P.look = look;
    Object.keys(ZC.WEAPONS).forEach(function (wid) {
      actors.forEach(function (A) {
        aims.forEach(function (aim) {
          A.x = 600; A.y = gy; A.dead = false; A.hurt = 0;
          A.gun.current = wid; A.gun.cooldown = 0; A.gun.reloading = 0; A.gun[wid].mag = 5;
          A.aimX = aim[0]; A.aimY = aim[1];
          const m = ZC.__test.muzzle(A);
          // Dibuja el actor con fogonazo y busca la boca del arma en el dibujo
          A.flash = 0.05;
          const spy = trackingCtx();
          const real = ZC.ctx; ZC.ctx = spy;
          spy.translate(A.x, A.y);
          ZC.Appearance.draw(A);
          ZC.ctx = real;
          A.flash = 0;
          const flash = spy.arcs.filter(function (a) { return a.color === "#fff6c0"; })[0];
          const d = flash ? Math.hypot(flash.p.x - m.x, flash.p.y - m.y) : 999;
          checked++;
          if (d > worst) { worst = d; worstMsg = look + "/" + wid + "/" + (A.isPlayer ? "jugador" : "bot") + "/" + aim.join(","); }
        });
      });
    });
  });
  ok(checked === looks.length * Object.keys(ZC.WEAPONS).length * 2 * aims.length && worst < 2.5,
    "el fogonazo dibujado y el punto de salida de la bala coinciden (todas las armas, aspectos, jugador y bots, 6 direcciones)",
    "peor " + worst.toFixed(2) + " px en " + worstMsg);

  // Altura: a la altura del pecho/hombro, no de la cintura (cinturón en y-32, cadera y-30)
  P.x = 600; P.y = gy; P.aimX = 1; P.aimY = 0; P.gun.current = "rifle";
  const mR = ZC.__test.muzzle(P);
  ok(gy - mR.y >= 35, "apuntando recto, la bala sale a la altura del pecho (>= 35 px sobre los pies)", String(gy - mR.y));
  ok(mR.x - P.x >= 38, "y por delante del cuerpo, en la punta del fusil", String(mR.x - P.x));
  P.aimX = -1;
  const mL = ZC.__test.muzzle(P);
  ok(P.x - mL.x >= 38 && Math.abs(mL.y - mR.y) < 0.01, "mirando a la izquierda sale por la izquierda a la misma altura", (P.x - mL.x) + "");

  // El disparo real: bala, estela y fogonazo arrancan en la boca del arma
  ZC.bullets.length = 0; ZC.particles.length = 0;
  P.aimX = 1; P.aimY = 0; P.gun.current = "rifle"; P.gun.cooldown = 0; P.gun.reloading = 0; P.gun.rifle.mag = 5;
  const expect = ZC.__test.muzzle(P);
  ZC.__test.fire();
  const b = ZC.bullets[0];
  ok(b && Math.hypot(b.x - expect.x, b.y - expect.y) < 0.01 && b.px === b.x && b.py === b.y,
    "la bala (y su estela) nace en la boca del cañón", b ? (b.x + "," + b.y) : "sin bala");
  ok(b && (P.y - b.y) > 32, "la bala no nace en la cadera", b ? String(P.y - b.y) : "");
  const nearMuzzle = ZC.particles.filter(function (q) { return Math.hypot(q.x - expect.x, q.y - expect.y) < 6; }).length;
  ok(nearMuzzle >= 3, "las chispas del fogonazo salen del cañón", String(nearMuzzle));
  ok(b && Math.abs(Math.atan2(b.vy, b.vx) - 0) <= ZC.WEAPONS.rifle.spread + 1e-6, "y vuela en la dirección del disparo");
  // Escopeta hacia arriba-izquierda: todos los perdigones salen del mismo cañón
  ZC.bullets.length = 0;
  P.gun.current = "shotgun"; P.gun.cooldown = 0; P.gun.shotgun.mag = 3; P.aimX = -0.7; P.aimY = -0.7;
  const exS = ZC.__test.muzzle(P);
  ZC.__test.fire();
  ok(ZC.bullets.length === ZC.WEAPONS.shotgun.pellets && ZC.bullets.every(function (q) { return Math.hypot(q.x - exS.x, q.y - exS.y) < 0.01 && q.vx < 0 && q.vy < 0; }),
    "escopeta: los perdigones salen del cañón hacia donde apunta", String(ZC.bullets.length));
  // Bot
  const bot = actors[1];
  ZC.bullets.length = 0;
  bot.x = 900; bot.y = gy; bot.dead = false; bot.aimX = -1; bot.aimY = 0; bot.gun.current = "rifle"; bot.gun.cooldown = 0; bot.gun.reloading = 0; bot.gun.rifle.mag = 5;
  const exB = ZC.__test.muzzle(bot);
  ZC.fireWeapon(bot);
  ok(ZC.bullets.length === 1 && Math.hypot(ZC.bullets[0].x - exB.x, ZC.bullets[0].y - exB.y) < 0.01 && ZC.bullets[0].x < bot.x - 30 && bot.y - ZC.bullets[0].y > 32,
    "los bots también disparan desde el cañón");
  // Las balas le dan al cuerpo dibujado (no solo a las piernas) y una caja en medio sigue cubriendo
  ok(ZC.cfg.hurtH >= 60, "la caja de impacto cubre del pie al casco", String(ZC.cfg.hurtH));
  ok(gy - mR.y < 40, "un disparo recto desde el suelo pasa por debajo del borde de una caja de 40 px (la cobertura sigue)", String(gy - mR.y));
  // A quemarropa: rival pegado al cañón recibe el disparo
  ZC.bullets.length = 0;
  const foe = actors[1];
  foe.x = P.x + 22; foe.y = gy; foe.hp = 100; foe.dead = false; foe.ai = null; foe.vx = 0;
  P.gun.current = "rifle"; P.gun.cooldown = 0; P.gun.reloading = 0; P.gun.rifle.mag = 5; P.aimX = 1; P.aimY = 0;
  ZC.__test.fire();
  ZC.updateBullets(1 / 60);
  ok(foe.hp < 100, "a quemarropa (rival pegado al cañón) la bala sí le da", String(foe.hp));
})();
(function () {
  // Vista previa del lobby: arma en la mano y disparo de muestra desde el cañón
  const pose = ZC.lobbyPreviewPose(ZC.LOBBY_SHOT_EVERY - 0.3);
  ok(pose.gun && pose.gun.current === ZC.profile.primary && pose.flash > 0 && pose.vx === 0,
    "el lobby muestra al personaje quieto, con su arma y un disparo de muestra");
  const prevT = ZC.lobbyPreviewT;
  ZC.lobbyPreviewT = ZC.LOBBY_SHOT_EVERY - 0.25;
  ZC.lobbyLastMuzzle = null;
  ZC.drawLobbyPreview();
  ok(ZC.lobbyLastMuzzle && ZC.lobbyLastMuzzle.x > 480 * 0.36 + 100, "la estela de muestra del lobby sale de la boca del arma", JSON.stringify(ZC.lobbyLastMuzzle));
  ZC.lobbyPreviewT = prevT;
})();
(function () {
  // v1.6: tocar la pantalla en el lobby no deja los joysticks dibujados detrás de la sala
  const ui = getEl("touch-ui");
  ui.classList.remove("show");
  ZC.openLobby();
  ZC.enableTouch();
  ok(!ui.classList.contains("show"), "en el lobby los controles táctiles quedan ocultos");
  ZC.closeLobby();
  ok(ui.classList.contains("show"), "al salir del lobby aparecen (el toque ya los activó)");
  ZC.touch.enabled = false; ui.classList.remove("show");
})();
// Sin emojis en la interfaz
const emojiRe = /[\u{1F000}-\u{1FAFF}\u{FE0F}\u{2705}\u{274C}\u{2728}]/u;
const uiFiles = ["index.html", "css/style.css"].concat(expected);
const withEmoji = uiFiles.filter(function (f) { return emojiRe.test(fs.readFileSync(path.join(root, f), "utf8")); });
ok(withEmoji.length === 0, "sin emojis en HTML, CSS ni JS", withEmoji.join(", "));
ok(/id="btn-full"/.test(html) && /id="safe-probe"/.test(html), "botón de pantalla completa y sonda de márgenes seguros");
ok(/@media \(max-height: 500px\)/.test(css) && /#app\.in-match #btn-mute/.test(css), "CSS de celular horizontal y silencio movido en partida");

function finish() {
  console.log("");
  console.log("Resultado: " + passed + " ok, " + failed + " fallos");
  if (failed) {
    errors.forEach(function (e) { console.log(" - " + e); });
    process.exit(1);
  }
  process.exit(0);
}

finish();
