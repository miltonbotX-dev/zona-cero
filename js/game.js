/* ============================================================================
   ZCero — bootstrap y flujo de partida
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
    if (ZC.isTraining()) return; // en entrenamiento no hay ganador: los rivales reaparecen
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
    if (ZC.Drop) { ZC.Drop.state.on = false; ZC.Drop.state.go = 0; }
  }

  // opts.mode: "classic" | "training". Si no se pasa, usa el del lobby (ZC.profile.mode).
  ZC.startMatch = function (opts) {
    ZC.unlockAudio();
    var mode = (opts && opts.mode) || (ZC.profile && ZC.profile.mode) || "classic";
    ZC.match.mode = mode === "training" ? "training" : "classic";
    var training = ZC.isTraining();
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
    if (training) {
      // Entrenamiento: la zona no se cierra ni hace daño
      ZC.zone.r = ZC.zone.tr = 5000;
      ZC.zone.dps = 0; ZC.zone.shrinking = false;
      ZC.match.lootTimer = ZC.TRAINING.lootEvery;
    }

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
    if (training) ZC.trainingTopUp();
    ZC.recountAlive();
    ZC.cam.x = ZC.util.clamp(ZC.player.x - ZC.viewW / 2, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
    ZC.cam.y = ZC.util.clamp(ZC.player.y - ZC.viewH * ZC.camFeetRatio(), 0, ZC.camMaxY());
    ZC.state = "playing";
    ZC.match.startedAt = ZC.util.now();
    if (ZC.setInMatch) ZC.setInMatch(true);
    if (ZC.setTrainingUI) ZC.setTrainingUI(training);
    // Despliegue: todos caen con cuenta 3-2-1 antes de poder disparar (js/drop.js)
    // En entrenamiento la caída es corta (ZC.TRAINING.dropTime).
    var dropT = ZC.Drop ? Math.max(0, +(training ? ZC.TRAINING.dropTime : ZC.CFG.dropTime) || 0) : 0;
    if (ZC.Drop) ZC.Drop.start(dropT);
    if (training) {
      ZC.addFeed("Entrenamiento · los rivales no disparan");
    }
    if (dropT > 0) {
      ZC.cam.x = ZC.util.clamp(ZC.player.x - ZC.viewW / 2, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
      ZC.cam.y = ZC.util.clamp(ZC.player.y - ZC.viewH * ZC.camFeetRatio(), 0, ZC.camMaxY());
      ZC.addFeed("Despliegue · " + ZC.match.alive + " en el aire");
    } else {
      ZC.addFeed("La partida comenzó · " + ZC.match.alive + " en combate");
    }
    if (opts && opts.requestFullscreen && ZC.requestFullscreen) ZC.requestFullscreen();
  }

  ZC.endMatch = function () {
    if (ZC.state === "over") return;
    if (ZC.isTraining()) return; // entrenamiento: nunca sale «Derrota» ni fin de partida
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
    if (kicker) kicker.textContent = win ? "Último superviviente" : "Fin de la partida";
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

  // ---------------------------------------------------------------------------
  // SECCIÓN: MODO ENTRENAMIENTO
  // ---------------------------------------------------------------------------
  // Munición de reserva siempre llena para el jugador.
  ZC.trainingTopUp = function () {
    var P = ZC.player;
    if (!P || !P.gun) return;
    Object.keys(ZC.WEAPONS).forEach(function (id) {
      if (P.gun[id]) P.gun[id].reserve = ZC.TRAINING.ammo;
    });
  };

  // Un rival eliminado vuelve tras ZC.TRAINING.respawn segundos, lejos del jugador.
  ZC.respawnBot = function (a) {
    var spots = (ZC.map && ZC.map.spawns) ? ZC.map.spawns : [];
    var best = null, bestD = -1;
    for (var i = 0; i < spots.length; i++) {
      var d = ZC.player ? Math.abs(spots[i].x - ZC.player.x) : 0;
      // Elige al azar entre los puntos a más de 300 px del jugador
      var score = (d > 300 ? 1000 : 0) + Math.random() * 900;
      if (score > bestD) { bestD = score; best = spots[i]; }
    }
    best = best || { x: 300 + Math.random() * (ZC.CFG.worldW - 600), y: ZC.CFG.groundY };
    var fresh = ZC.makeActor({ id: a.id, name: a.name, color: a.color, x: best.x, y: best.y });
    fresh.kills = a.kills;
    fresh.look = a.look;
    var idx = ZC.actors.indexOf(a);
    if (idx >= 0) ZC.actors[idx] = fresh; else ZC.actors.push(fresh);
    ZC.burst(fresh.x, fresh.y - 20, 14, "#e0c27a", 160);
    ZC.addFeed(fresh.name + " reapareció");
    ZC.recountAlive();
    return fresh;
  };

  // Lo que cambia en cada cuadro del entrenamiento (reaparición, munición, botín).
  ZC.updateTraining = function (dt) {
    ZC.trainingTopUp();
    for (var i = 0; i < ZC.actors.length; i++) {
      var a = ZC.actors[i];
      if (!a.dead || a.isPlayer) continue;
      if (a.respawnIn == null) a.respawnIn = ZC.TRAINING.respawn;
      a.respawnIn -= dt;
      if (a.respawnIn <= 0) ZC.respawnBot(a);
    }
    ZC.match.lootTimer = (ZC.match.lootTimer == null ? ZC.TRAINING.lootEvery : ZC.match.lootTimer) - dt;
    if (ZC.match.lootTimer <= 0) {
      ZC.match.lootTimer = ZC.TRAINING.lootEvery;
      if (ZC.loots.length < ZC.TRAINING.minLoot) ZC.seedLoot();
    }
  };

  // Salir de la partida al lobby (botón casita del entrenamiento). Sin ventana
  // de confirmar: en entrenamiento no se pierde nada.
  ZC.leaveMatch = function () {
    ZC.state = "title";
    ZC.clearSim();
    ZC.match.mode = "classic";
    if (ZC.setTrainingUI) ZC.setTrainingUI(false);
    ZC.hideOverlay("end-screen");
    if (ZC.openLobby) ZC.openLobby(); else ZC.goMenu();
  };

  ZC.formatTime = function (t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  ZC.update = function (dt) {
    dt = ZC.util.clamp(dt, 0, 0.05);
    // Celular en vertical durante la partida: pausa hasta que vuelvas a horizontal
    if (ZC.state === "playing" && ZC.needsRotate && ZC.needsRotate()) return;
    if (ZC.state === "title") {
      ZC.match.elapsed += dt;
      // Cámara lenta de menú
      ZC.cam.x = (Math.sin(ZC.match.elapsed * 0.15) * 0.5 + 0.5) * Math.max(0, ZC.CFG.worldW - ZC.viewW);
      ZC.cam.y = 80;
      ZC.updateParticles(dt);
      return;
    }

    // Despliegue: mientras dura la cuenta no corre el reloj, ni la zona, ni los bots
    if (ZC.Drop && (ZC.Drop.active() || ZC.Drop.state.go > 0)) {
      if (ZC.Drop.active() && ZC.state === "playing") {
        const din = ZC.player ? ZC.readPlayerInput() : { moveX: 0 };
        ZC.Drop.update(dt, ZC.player && !ZC.player.dead ? din.moveX : 0);
        ZC.updateParticles(dt);
        ZC.updateCamera(dt);
        return;
      }
      ZC.Drop.update(dt, 0);
    }

    ZC.match.elapsed += dt;
    const training = ZC.isTraining();
    if (!training) ZC.updateZone(dt);

    if (ZC.state === "playing" || ZC.state === "over") {
      const pin = ZC.player ? ZC.readPlayerInput() : { moveX: 0, jump: false, fire: false, reload: false };
      for (let i = 0; i < ZC.actors.length; i++) {
        const a = ZC.actors[i];
        if (a.dead) continue;
        if (a.isPlayer) {
          ZC.updatePlayer(dt, pin);
        } else if (ZC.Drop && ZC.Drop.state.go > 0) {
          // Respiro de "A COMBATIR": los bots se quedan quietos un instante tras aterrizar
          ZC.controlActor(a, dt, 0, false, false, false);
          ZC.collideWorld(a, dt);
        } else if (training) {
          ZC.thinkDummy(a, dt); // blanco de práctica: camina o se queda quieto, no dispara
        } else {
          ZC.thinkBot(a, dt);
        }
        // Daño de zona en ticks (~4 HP) para no saturar el HUD
        if (!training && !ZC.inZone(a.x, a.y - 16) && ZC.zone.dps > 0) {
          a.zoneAcc = (a.zoneAcc || 0) + ZC.zone.dps * dt;
          if (a.zoneAcc >= 4) {
            ZC.applyDamage(a, a.zoneAcc, null, "zone");
            a.zoneAcc = 0;
          }
        } else {
          a.zoneAcc = 0;
        }
      }
      if (training && ZC.state === "playing") ZC.updateTraining(dt);
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
          ZC.cam.y = ZC.util.lerp(ZC.cam.y, follow.y - ZC.viewH * ZC.camFeetRatio(), 0.08);
          ZC.cam.x = ZC.util.clamp(ZC.cam.x, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
          ZC.cam.y = ZC.util.clamp(ZC.cam.y, 0, ZC.camMaxY());
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
      if (ZC.bindBoot) ZC.bindBoot();
      ZC.mounted = true;
    }
    // Entrada tipo PUBG Mobile: logo, carga real y lobby (js/boot.js).
    // opts.boot === false (o sin boot.js) deja el menú de antes.
    if (opts.boot !== false && ZC.Boot && !global.__ZC_TEST__ && ZC.Boot.phase === "idle") {
      ZC.Boot.start();
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
      muted: ZC.muted,
      training: ZC.isTraining(),
      drop: ZC.Drop ? { on: ZC.Drop.active(), count: ZC.Drop.count(), t: ZC.Drop.state.t, dur: ZC.Drop.state.dur } : null
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
    skipDrop: function () { if (ZC.Drop) ZC.Drop.skip(); },
    hudLayout: function () { return ZC.hudLayout ? ZC.hudLayout() : null; },
    startReload: function () { return ZC.player ? ZC.startReload(ZC.player) : false; },
    skipBoot: function () { if (ZC.Boot) ZC.Boot.skip(); },
    muzzle: function (actor) { return ZC.muzzlePoint(actor || ZC.player); }
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
