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
ok(/href="css\/style\.css"/.test(html), "enlaza css/style.css");

const cssPath = path.join(root, "css", "style.css");
ok(fs.existsSync(cssPath), "existe css/style.css");
const css = fs.readFileSync(cssPath, "utf8");
ok(/\[\s*hidden\s*\]\s*\{[^}]*display\s*:\s*none\s*!important/i.test(css),
  "regla CSS [hidden]{display:none!important} para que display:flex no lo pise");
ok(/\.overlay\s*\{[^}]*display\s*:\s*flex/i.test(css),
  ".overlay declara display:flex (conflicto que [hidden] debe ganar)");

const scriptSrcs = [];
html.replace(/<script\s+src="([^"]+)"><\/script>/g, function (_, src) { scriptSrcs.push(src); return ""; });
const expected = [
  "js/zc.js", "js/config.js", "js/weapons.js", "js/maps.js", "js/entities.js",
  "js/physics.js", "js/combat.js", "js/zone.js", "js/bots.js", "js/player.js",
  "js/input.js", "js/audio.js", "js/appearance.js", "js/render.js", "js/ui.js", "js/lobby.js", "js/game.js"
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

ZC.profile = { name: "Tú", look: "operativo", mapId: "arena-industrial", primary: "rifle", carried: ["rifle", "shotgun"], hp: 100, bots: 7, controlScale: 1, layout: null };
ZC.saveProfile();
ZC.Maps.use("arena-industrial");
ZC.startMatch();

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
