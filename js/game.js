/* ============================================================================
   Zona Cero — bootstrap y flujo de partida
   Contrato: startMatch / endMatch / update / loop / mount y la API pública (ZonaCero). Orquesta módulos; no define físicas ni armas.
   Depende de: todos los módulos anteriores
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/game.js");

ZC.recountAlive = function () {
    ZC.match.alive = 0;
    for (let i = 0; i < ZC.actors.length; i++) if (!ZC.actors[i].dead) ZC.match.alive++;
  }

  ZC.checkWinner = function () {
    if (ZC.state !== "playing") return;
    const living = [];
    for (let i = 0; i < ZC.actors.length; i++) if (!ZC.actors[i].dead) living.push(ZC.actors[i]);
    ZC.match.alive = living.length;
    if (living.length <= 1) {
      ZC.match.winner = living[0] || null;
      if (ZC.player && ZC.player.dead && ZC.match.playerPlace === 0) ZC.match.playerPlace = 1;
      if (ZC.match.winner && ZC.match.winner.isPlayer) ZC.match.playerPlace = 1;
      ZC.endMatch();
    }
  }

  ZC.clearSim = function () {
    ZC.actors.length = 0;
    ZC.bullets.length = 0;
    ZC.particles.length = 0;
    ZC.loots.length = 0;
    ZC.floating.length = 0;
    ZC.killfeed.length = 0;
    ZC.player = null;
    ZC.match.elapsed = 0;
    ZC.match.winner = null;
    ZC.match.playerKills = 0;
    ZC.match.playerPlace = 0;
    ZC.match.alive = 0;
    ZC.cam.shake = 0;
  }

  ZC.startMatch = function () {
    ZC.unlockAudio();
    if (ZC.profile && ZC.profile.mapId && ZC.Maps && ZC.Maps.all[ZC.profile.mapId]) {
      ZC.Maps.use(ZC.profile.mapId);
    }
    if (ZC.closeLobby) ZC.closeLobby();
    ZC.hideOverlay("title-screen");
    ZC.hideOverlay("end-screen");
    ZC.hideOverlay("lobby-screen");
    ZC.clearSim();
    if (ZC.resetWorldDecor) ZC.resetWorldDecor();
    ZC.resetZone();
    ZC.seedLoot();

    // Baraja ZC.map.spawns
    const spots = ZC.map.spawns.slice();
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = spots[i]; spots[i] = spots[j]; spots[j] = tmp;
    }
    ZC.actors.push(ZC.spawnPlayer(spots[0]));
    if (ZC.profile && ZC.profile.bots) ZC.CFG.botCount = ZC.util.clamp(ZC.profile.bots | 0, 1, 7);
    for (let i = 0; i < ZC.CFG.botCount; i++) {
      const s = spots[i + 1] || { x: 200 + i * 280, y: 760 };
      ZC.actors.push(ZC.makeActor({
        id: i + 1, name: ZC.BOT_NAMES[i] || ("Bot " + (i + 1)),
        color: ZC.BOT_COLORS[i] || "#ccc",
        x: s.x, y: s.y
      }));
    }
    ZC.recountAlive();
    ZC.cam.x = ZC.util.clamp(ZC.player.x - 400, 0, ZC.CFG.worldW);
    ZC.cam.y = ZC.util.clamp(ZC.player.y - 360, 0, ZC.CFG.worldH);
    ZC.state = "playing";
    ZC.match.startedAt = ZC.util.now();
    ZC.addFeed("La partida comenzó · " + ZC.match.alive + " en combate");
  }

  ZC.endMatch = function () {
    if (ZC.state === "over") return;
    ZC.state = "over";
    const win = ZC.match.winner && ZC.match.winner.isPlayer;
    if (win) ZC.sfx("win");
    const end = document.getElementById("end-screen");
    if (!end) return;
    end.hidden = false;
    end.classList.add("active");
    end.classList.toggle("win", !!win);
    end.classList.toggle("lose", !win);
    const title = document.getElementById("end-title");
    const stats = document.getElementById("end-stats");
    const extra = document.getElementById("end-extra");
    const kicker = document.getElementById("end-kicker");
    if (kicker) kicker.textContent = win ? "Último superviviente" : "Fin de partida";
    if (title) title.textContent = win ? "Victoria" : (ZC.player && ZC.player.dead ? "Derrota" : "Fin");
    const place = ZC.match.playerPlace || (win ? 1 : ZC.match.alive + (ZC.player && ZC.player.dead ? 1 : 0));
    const who = ZC.match.winner ? ZC.match.winner.name : "Nadie";
    if (stats) {
      stats.textContent = (win ? "Quedaste en pie. " : who + " ganó la ronda. ") +
        "Puesto #" + place + " · Eliminaciones " + ZC.match.playerKills +
        " · Tiempo " + ZC.formatTime(ZC.match.elapsed);
    }
    if (extra) extra.textContent = "La zona se cerró en " + (ZC.zone.phase + 1) + " fases. Juega de nuevo cuando quieras.";
  }

  ZC.formatTime = function (t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  ZC.update = function (dt) {
    dt = ZC.util.clamp(dt, 0, 0.05);
    if (ZC.state === "title") {
      ZC.match.elapsed += dt;
      // Cámara lenta de menú
      ZC.cam.x = (Math.sin(ZC.match.elapsed * 0.15) * 0.5 + 0.5) * Math.max(0, ZC.CFG.worldW - ZC.viewW);
      ZC.cam.y = 80;
      ZC.updateParticles(dt);
      return;
    }

    ZC.match.elapsed += dt;
    ZC.updateZone(dt);

    if (ZC.state === "playing" || ZC.state === "over") {
      const pin = ZC.player ? ZC.readPlayerInput() : { moveX: 0, jump: false, fire: false, reload: false };
      for (let i = 0; i < ZC.actors.length; i++) {
        const a = ZC.actors[i];
        if (a.dead) continue;
        if (a.isPlayer) {
          ZC.updatePlayer(dt, pin);
        } else {
          ZC.thinkBot(a, dt);
        }
        // Daño de zona en ticks (~4 HP) para no saturar el HUD
        if (!ZC.inZone(a.x, a.y - 16) && ZC.zone.dps > 0) {
          a.zoneAcc = (a.zoneAcc || 0) + ZC.zone.dps * dt;
          if (a.zoneAcc >= 4) {
            ZC.applyDamage(a, a.zoneAcc, null, "zone");
            a.zoneAcc = 0;
          }
        } else {
          a.zoneAcc = 0;
        }
      }
      ZC.updateBullets(dt);
      ZC.updateLoot(dt);
      ZC.updateParticles(dt);
      ZC.updateCamera(dt);

      // Cámara de espectador si el jugador murió
      if (ZC.player && ZC.player.dead && ZC.state === "playing") {
        let follow = ZC.match.winner;
        if (!follow) {
          let best = null, bk = -1;
          ZC.actors.forEach(function (a) { if (!a.dead && a.kills > bk) { bk = a.kills; best = a; } });
          follow = best || ZC.actors.find(function (a) { return !a.dead; });
        }
        if (follow) {
          ZC.cam.x = ZC.util.lerp(ZC.cam.x, follow.x - ZC.viewW / 2, 0.08);
          ZC.cam.y = ZC.util.lerp(ZC.cam.y, follow.y - ZC.viewH / 2, 0.08);
          ZC.cam.x = ZC.util.clamp(ZC.cam.x, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
          ZC.cam.y = ZC.util.clamp(ZC.cam.y, 0, Math.max(0, ZC.CFG.worldH - ZC.viewH));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SECCIÓN: BUCLE PRINCIPAL
  // ---------------------------------------------------------------------------
  ZC.loop = function (ts) {
    if (!ZC.lastT) ZC.lastT = ts;
    const dt = Math.min(0.05, (ts - ZC.lastT) / 1000);
    ZC.lastT = ts;
    ZC.update(dt);
    ZC.draw();
    ZC.rafId = global.requestAnimationFrame(ZC.loop);
  }

  ZC.mount = function (opts) {
    opts = opts || {};
    ZC.canvas = document.getElementById("game");
    if (!ZC.canvas) throw new Error("No se encontró el canvas #game");
    ZC.ctx = ZC.canvas.getContext("2d");
    ZC.hudMuteBtn = document.getElementById("btn-mute");
    ZC.resetWorldDecor();
    ZC.resize();
    if (!ZC.mounted) {
      ZC.bindInput();
      ZC.bindShell();
      global.addEventListener("resize", ZC.resize);
      ZC.mounted = true;
    }
    ZC.lastT = 0;
    if (opts.autoLoop !== false && !global.__ZC_TEST__) {
      if (ZC.rafId) global.cancelAnimationFrame(ZC.rafId);
      ZC.rafId = global.requestAnimationFrame(ZC.loop);
    }
    return ZC;
  }

  ZC.cfg = ZC.CFG;
  ZC.weapons = ZC.WEAPONS;
  ZC.utils = {
    clamp: ZC.util.clamp,
    lerp: ZC.util.lerp,
    aabb: ZC.util.aabb,
    dist2: ZC.util.dist2,
    norm: ZC.util.norm,
    segmentHitsAABB: ZC.util.segmentHitsAABB,
    inZone: ZC.inZone
  };
  ZC.getState = function () {
    var player = ZC.player, match = ZC.match, zone = ZC.zone;
    return {
      mode: ZC.state,
      elapsed: match.elapsed,
      alive: match.alive,
      winner: match.winner ? match.winner.name : null,
      player: player ? {
        x: player.x, y: player.y, hp: player.hp, dead: player.dead,
        vx: player.vx, vy: player.vy, grounded: player.grounded,
        jumpsLeft: player.jumpsLeft,
        weapon: player.gun.current,
        mag: player.gun[player.gun.current].mag,
        reserve: player.gun[player.gun.current].reserve,
        kills: player.kills
      } : null,
      actors: ZC.actors.map(function (a) {
        return { name: a.name, dead: a.dead, hp: a.hp, x: a.x, y: a.y, kills: a.kills };
      }),
      bullets: ZC.bullets.length,
      loot: ZC.loots.length,
      zone: { r: zone.r, cx: zone.cx, cy: zone.cy, dps: zone.dps, shrinking: zone.shrinking, phase: zone.phase },
      muted: ZC.muted
    };
  };
  ZC.__test = {
    get player() { return ZC.player; },
    get actors() { return ZC.actors; },
    get bullets() { return ZC.bullets; },
    get loots() { return ZC.loots; },
    get zone() { return ZC.zone; },
    applyDamage: function (v, a, s, c) { return ZC.applyDamage(v, a, s, c); },
    tryJump: function () { return ZC.player ? ZC.tryJump(ZC.player) : false; },
    fire: function () { return ZC.player ? ZC.fireWeapon(ZC.player) : false; },
    setAim: function (x, y) { if (ZC.player) { ZC.player.aimX = x; ZC.player.aimY = y; } },
    setPlayerPos: function (x, y) { if (ZC.player) { ZC.player.x = x; ZC.player.y = y; } },
    forceZone: function (cx, cy, r, dps) {
      var zone = ZC.zone;
      zone.cx = cx; zone.cy = cy; zone.r = r; zone.dps = dps || 0;
      zone.tx = cx; zone.ty = cy; zone.tr = r;
      zone.shrinking = false; zone.hold = 9999; zone.timer = 9999;
    },
    pick: function (actor, item) { return ZC.pickLoot(actor, item); },
    startReload: function () { return ZC.player ? ZC.startReload(ZC.player) : false; }
  };

  global.ZonaCero = ZC;

  var isBrowser = typeof document !== "undefined" && !global.__ZC_TEST__;
  if (isBrowser) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { ZC.mount(); });
    } else {
      ZC.mount();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
