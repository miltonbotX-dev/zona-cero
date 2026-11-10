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
ok(/Zona Cero/.test(html), "título Zona Cero");
ok(!/https?:\/\//i.test(html), "index.html sin URLs de red");
ok(!/cdn|unpkg|jsdelivr|googleapis|cloudflare/i.test(html), "sin CDN");
ok(!/WebSocket|firebase|socket\.io/i.test(html), "sin red / multijugador");
ok(!/adsbygoogle|doubleclick|adsense/i.test(html), "sin anuncios reales");
ok(/id="end-screen"[^>]*\bhidden\b/.test(html), "end-screen nace con atributo hidden");
ok(!/<div id="title-screen"[^>]*\bhidden\b/.test(html), "title-screen no nace con hidden");
ok(/href="css\/style\.css(\?v=[\w.]+)?"/.test(html), "enlaza css/style.css");
ok(/\?v=1\.4\.0/.test(html), "index.html marca los archivos con la versión 1.4.0 (sin caché viejo)");

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
  "js/drop.js", "js/input.js", "js/audio.js", "js/appearance.js", "js/render.js", "js/ui.js", "js/lobby.js", "js/game.js"
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
// Estado inicial como en el HTML: resultado hidden, menú visible.
getEl("end-screen").hidden = true;
getEl("title-screen").hidden = false;
getEl("title-screen").classList.add("active");
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
console.log("v1.4 Despliegue");
ok(DROP_DEFAULT === 3, "la caída dura 3 s por defecto (3-2-1)", String(DROP_DEFAULT));
ok(!!ZC.Drop && typeof ZC.Drop.start === "function" && typeof ZC.__test.skipDrop === "function", "API ZC.Drop y __test.skipDrop");
ZC.cfg.dropTime = DROP_DEFAULT;
ZC.Maps.use("arena-industrial");
ZC.startMatch();
let ds = ZC.getState();
ok(ds.mode === "playing" && ds.drop && ds.drop.on, "al iniciar empieza la caída", JSON.stringify(ds.drop));
ok(ds.drop.count === 3, "la cuenta arranca en 3", String(ds.drop.count));
ok(ZC.killfeed[0] && /Despliegue/.test(ZC.killfeed[0].text), "el registro dice Despliegue");
const dp = ZC.__test.player;
ok(dp.y < ZC.cfg.groundY - 150, "el jugador empieza en el aire", String(dp.y));
ok(ZC.__test.actors.every(function (a) { return !a.grounded && a.dropVy > 0; }), "todos caen en paracaídas");
ok(ZC.__test.actors.every(function (a) { return a.chute === 1; }), "todos con el paracaídas abierto");
const zoneTimer0 = ZC.__test.zone.timer, zoneR0 = ZC.__test.zone.r;
ZC.input.fire = true;
ZC.input.analog = true; ZC.input.moveX = 0;
const bx0 = ZC.__test.actors.filter(function (a) { return !a.isPlayer; }).map(function (a) { return a.x; });
const counts = [];
for (let i = 0; i < 60; i++) { ZC.update(1 / 60); if (counts[counts.length - 1] !== ZC.Drop.count()) counts.push(ZC.Drop.count()); }
ok(ZC.bullets.length === 0, "durante la caída no se dispara", String(ZC.bullets.length));
ok(ZC.match.elapsed === 0, "el reloj de partida no corre durante la caída", String(ZC.match.elapsed));
ok(ZC.__test.zone.r === zoneR0 && ZC.__test.zone.timer === zoneTimer0, "la zona espera a que aterricen");
ok(ZC.__test.actors.filter(function (a) { return !a.isPlayer; }).every(function (a, i) { return a.x === bx0[i]; }), "los bots no se mueven en el aire");
ok(dp.y > dp.dropFromY + 10 && !dp.grounded && !dp.landed, "tras 1 s sigue bajando en paracaídas", dp.dropFromY.toFixed(1) + " -> " + dp.y.toFixed(1));
ok(ZC.__test.actors.every(function (a) { return a.dead || !a.landed; }), "nadie aterriza antes de tiempo");
// Guiar la caída
const sx0 = dp.x;
ZC.input.moveX = 1;
for (let i = 0; i < 20; i++) ZC.update(1 / 60);
ok(dp.x > sx0 + 20, "el joystick guía la caída hacia los lados", sx0 + " -> " + dp.x);
ZC.input.moveX = 0;
dp.x = sx0; // vuelve a su vertical para que el aterrizaje sea predecible
ok(ZC.getState().drop.count === 2 || ZC.getState().drop.count === 1, "la cuenta baja", String(ZC.getState().drop.count));
for (let i = 0; i < 120 && ZC.Drop.active(); i++) { ZC.update(1 / 60); const c = ZC.Drop.count(); if (counts[counts.length - 1] !== c) counts.push(c); }
// Justo al terminar la cuenta (antes de que los bots empiecen a saltar)
ok(ZC.__test.actors.every(function (a) { return a.dead || a.grounded; }), "todos tocan tierra justo en el 0",
  JSON.stringify(ZC.__test.actors.filter(function (a) { return !a.dead && !a.grounded; }).map(function (a) { return [a.name, Math.round(a.x), Math.round(a.y)]; })));
ok(Math.abs(ZC.Drop.state.t - DROP_DEFAULT) < 0.05, "la cuenta dura lo previsto", ZC.Drop.state.t.toFixed(3));
ok(counts.join(",") === "3,2,1,0", "secuencia 3-2-1 y fin", counts.join(","));
ds = ZC.getState();
ok(!ds.drop.on, "la caída termina a los 3 s");
ok(ZC.Drop.state.go > 0 || ZC.match.elapsed > 0, "aparece A COMBATIR o ya corre el reloj");
for (let i = 0; i < 30; i++) ZC.update(1 / 60);
ok(ZC.__test.actors.every(function (a) { return a.dead || a.chute === 0; }), "los paracaídas se pliegan al aterrizar");
ok(ZC.match.elapsed > 0.2, "después de aterrizar corre el reloj", String(ZC.match.elapsed));
ok(ZC.killfeed.some(function (k) { return /Aterrizaje/.test(k.text); }), "el registro avisa el aterrizaje");
ZC.input.fire = false; ZC.input.analog = false;
dp.gun.cooldown = 0; dp.gun.reloading = 0;
const shotOk = ZC.__test.fire();
ok(shotOk && ZC.bullets.length > 0, "tras aterrizar ya se puede disparar");
// Dibujo del despliegue
ZC.startMatch();
(function () {
  const texts = [];
  const spy = Object.assign({}, makeCtx());
  spy.fillText = function (t) { texts.push(String(t)); };
  let curves = 0;
  spy.quadraticCurveTo = function () { curves++; };
  const real = ZC.ctx; ZC.ctx = spy;
  ZC.viewW = 844; ZC.viewH = 390;
  try {
    ZC.draw();
    ok(true, "draw() durante la caída no lanza");
  } catch (e) { ok(false, "draw() durante la caída no lanza", e && e.stack); }
  ok(texts.indexOf("3") >= 0, "se dibuja el número grande de la cuenta", texts.slice(0, 12).join("|"));
  ok(texts.some(function (t) { return /SALTANDO SOBRE/.test(t); }), "se nombra el mapa de la caída");
  ok(texts.some(function (t) { return /Guía la caída/.test(t); }), "pista para guiar la caída");
  ok(texts.some(function (t) { return / m$/.test(t); }), "altímetro en metros");
  ok(curves >= 8, "se dibujan los paracaídas", String(curves));
  ZC.__test.skipDrop();
  texts.length = 0;
  ZC.draw();
  ok(texts.indexOf("A COMBATIR") >= 0, "al aterrizar se ve A COMBATIR");
  ZC.ctx = real;
  ZC.viewW = savedView.w; ZC.viewH = savedView.h;
})();
ok(!ZC.Drop.active(), "skipDrop termina la caída");
ZC.cfg.dropTime = 0;
ZC.startMatch();
ok(!ZC.Drop.active() && ZC.map.spawns.some(function (sp) { return sp.x === ZC.__test.player.x && sp.y === ZC.__test.player.y; }),
  "con dropTime 0 se aparece en su punto como antes");
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
