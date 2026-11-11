/* ============================================================================
   ZCero — núcleo del namespace
   Contrato: crea window.ZC / window.ZonaCero, utilidades puras y el estado
   compartido de la partida. Ningún otro archivo debe redeclarar el namespace.
   Depende de: nada (debe cargarse primero)
   Estado compartido (mutar campos, no sustituir los objetos contenedor salvo
   player / canvas / ctx): ver ZC.actors, ZC.player, ZC.zone, ZC.input, etc.
   ========================================================================== */
(function (global) {
  "use strict";

  var ZC = {
    version: "1.6.0",
    // Nombre del juego en UN solo lugar. Para renombrarlo (por ejemplo, cuando
    // elijas el nombre según las temáticas), cambia estos textos y listo:
    // js/ui.js (ZC.applyBrand) los copia a todo lo que tenga data-brand="..."
    // en index.html y al título de la pestaña.
    BRAND: {
      name: "ZCero",                 // nombre visible (entrada, menú, pestaña)
      tag: "Battle royale",          // línea bajo el nombre en la carga
      company: "©Amilthon company",    // pie de la pantalla de carga
      creator: "Amilthon"            // firma sobre el video del creador
    },
    state: "title",
    mounted: false,
    SCRIPT_ORDER: [
      "js/zc.js", "js/config.js", "js/weapons.js", "js/maps.js", "js/entities.js",
      "js/physics.js", "js/combat.js", "js/zone.js", "js/bots.js", "js/player.js",
      "js/drop.js", "js/input.js", "js/audio.js", "js/appearance.js", "js/render.js", "js/ui.js", "js/lobby.js", "js/boot.js", "js/game.js"
    ],
    actors: [],
    bullets: [],
    particles: [],
    loots: [],
    floating: [],
    killfeed: [],
    player: null,
    zone: {
      cx: 1300, cy: 560, r: 1700,
      tx: 1300, ty: 560, tr: 1700,
      phase: 0, timer: 0, shrinking: false, dps: 0, hold: 0
    },
    cam: { x: 0, y: 0, shake: 0 },
    input: {
      left: false, right: false, jump: false, jumpPressed: false,
      jumpHold: false, reloadHold: false,
      fire: false, reload: false, aimX: 1, aimY: 0, mx: 0, my: 0,
      swap: 0, moveX: 0, analog: false, aimStick: false
    },
    touch: {
      enabled: false, leftId: null, rightId: null,
      lx: 0, ly: 0, rx: 0, ry: 0
    },
    match: {
      elapsed: 0, alive: 0, winner: null,
      playerKills: 0, playerPlace: 0, startedAt: 0
    },
    keys: {},
    muted: false,
    audioCtx: null,
    rafId: 0,
    lastT: 0,
    canvas: null,
    ctx: null,
    hudMuteBtn: null,
    viewW: 1280,
    viewH: 720,
    dpr: 1,
    stars: [],
    windows: []
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function len(x, y) { return Math.hypot(x, y); }
  function norm(x, y) {
    var l = Math.hypot(x, y);
    if (l < 1e-6) return { x: 0, y: 0, l: 0 };
    return { x: x / l, y: y / l, l: l };
  }
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }
  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }
  function segmentHitsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
    var minx = Math.min(x1, x2), maxx = Math.max(x1, x2);
    var miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
    if (maxx < rx || minx > rx + rw || maxy < ry || miny > ry + rh) return false;
    if (pointInRect(x1, y1, rx, ry, rw, rh) || pointInRect(x2, y2, rx, ry, rw, rh)) return true;
    return segSeg(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
           segSeg(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh) ||
           segSeg(x1, y1, x2, y2, rx, ry, rx, ry + rh) ||
           segSeg(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
  }
  function segSeg(a, b, c, d, e, f, g, h) {
    var d1x = c - a, d1y = d - b, d2x = g - e, d2y = h - f;
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-8) return false;
    var s = ((e - a) * d2y - (f - b) * d2x) / den;
    var t = ((e - a) * d1y - (f - b) * d1x) / den;
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
  }

  ZC.util = {
    clamp: clamp, lerp: lerp, rand: rand, irand: irand,
    dist2: dist2, len: len, norm: norm, aabb: aabb,
    pointInRect: pointInRect, now: now,
    segmentHitsAABB: segmentHitsAABB, segSeg: segSeg
  };

  global.ZC = ZC;
  global.ZonaCero = ZC;
})(typeof window !== "undefined" ? window : globalThis);
