/* ============================================================================
   ZCero — entidades (actores, partículas, loot)
   Contrato: Fábricas: makeActor, spawnLoot, seedLoot (usa ZC.map.lootSpots), partículas y killfeed. No decide quién gana ni dispara.
   Depende de: js/zc.js, js/config.js, js/weapons.js, js/maps.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/entities.js");

ZC.resetWorldDecor = function () {
    ZC.stars.length = 0;
    for (let i = 0; i < 90; i++) {
      ZC.stars.push({ x: Math.random() * ZC.CFG.worldW, y: Math.random() * 380, s: ZC.util.rand(0.6, 2.1), a: ZC.util.rand(0.25, 0.9) });
    }
    ZC.windows.length = 0;
    ZC.map.silos.forEach(function (s) {
      const cols = Math.max(2, Math.floor(s.w / 22));
      const rows = Math.max(3, Math.floor(s.h / 28));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.55) {
            ZC.windows.push({
              x: s.x + 8 + c * 20,
              y: ZC.CFG.groundY - s.h + 16 + r * 26,
              on: Math.random() < 0.7,
              flicker: Math.random()
            });
          }
        }
      }
    });
  }

  ZC.spawnParticle = function (x, y, vx, vy, life, color, size, drag) {
    if (ZC.particles.length >= ZC.CFG.particleMax) ZC.particles.shift();
    ZC.particles.push({
      x: x, y: y, vx: vx, vy: vy, life: life, max: life,
      color: color, size: size || 2, drag: drag == null ? 0.9 : drag
    });
  }
  ZC.burst = function (x, y, n, color, spd) {
    for (let i = 0; i < n; i++) {
      const a = ZC.util.rand(0, Math.PI * 2), s = ZC.util.rand(40, spd || 220);
      ZC.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, ZC.util.rand(0.18, 0.45), color, ZC.util.rand(1.4, 3.2), 0.88);
    }
  }
  ZC.addFloat = function (x, y, text, color) {
    ZC.floating.push({ x: x, y: y, text: text, color: color || "#fff", life: 0.7 });
  }
  ZC.addFeed = function (text) {
    ZC.killfeed.unshift({ text: text, life: 4.2 });
    if (ZC.killfeed.length > 6) ZC.killfeed.pop();
  }

  ZC.spawnLoot = function (x, y, type, extra) {
    ZC.loots.push({
      x: x, y: y, vx: ZC.util.rand(-40, 40), vy: ZC.util.rand(-180, -80),
      type: type, // health | ammo | weapon
      weapon: extra || null,
      life: 28, r: 12, grounded: false
    });
  }

  ZC.seedLoot = function () {
    var spots = (ZC.map && ZC.map.lootSpots) ? ZC.map.lootSpots : [];
    spots.forEach(function (s, i) {
      const t = i % 5 === 0 ? "weapon" : (i % 2 === 0 ? "health" : "ammo");
      ZC.spawnLoot(s[0], s[1], t, t === "weapon" ? "shotgun" : null);
      const L = ZC.loots[ZC.loots.length - 1];
      L.vx = 0; L.vy = 0; L.grounded = true;
    });
  }

  ZC.makeActor = function (opts) {
    return {
      id: opts.id,
      name: opts.name,
      color: opts.color,
      isPlayer: !!opts.isPlayer,
      x: opts.x, y: opts.y,
      vx: 0, vy: 0,
      w: ZC.CFG.actorW, h: ZC.CFG.actorH,
      hp: 100, maxHp: 100,
      grounded: false,
      jumpsLeft: 1,
      coyote: 0, jumpBuf: 0,
      aimX: 1, aimY: 0,
      facing: 1,
      dead: false,
      kills: 0,
      gun: ZC.copyLoadout(),
      flash: 0,
      hurt: 0,
      invuln: 0,
      wantMove: 0,
      wantJump: false,
      wantFire: false,
      wantReload: false,
      ai: opts.isPlayer ? null : {
        think: 0,
        target: null,
        state: "wander",
        inaccuracy: ZC.util.rand(0.06, 0.16),
        aggress: ZC.util.rand(0.45, 0.95),
        nextJump: 0
      },
      walkPhase: 0
    };
  }

  ZC.feetRect = function (a) {
    return { x: a.x - a.w / 2, y: a.y - a.h, w: a.w, h: a.h };
  }
})(typeof window !== "undefined" ? window : globalThis);
