/* ============================================================================
   ZCero — despliegue (caída con cuenta regresiva)
   Contrato: Al empezar la partida todos caen en paracaídas desde lo alto del mapa mientras corre una cuenta 3-2-1. Durante la caída no hay disparos, ni zona, ni bots pensando. Al llegar a 0 se aterriza y empieza el combate. ZC.Drop.start / update / active / skip, más el dibujo del paracaídas (drawWorld) y de la cuenta (drawHUD).
   Depende de: js/zc.js, js/config.js, js/physics.js (collideWorld en runtime)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/drop.js");

  // Datos de diseño (cámbialos aquí)
  var STEER = 150;       // px/s que el jugador puede desviarse en el aire
  var TOP_Y = 330;       // altura de salida (y del mundo; 0 es el techo). Deja sitio al paracaídas en pantalla
  var GO_TIME = 0.9;     // cuánto dura el aviso "A combatir" tras aterrizar

  ZC.Drop = {
    // Estado de la secuencia. t avanza de 0 a dur. go > 0 mientras se ve "A combatir".
    state: { on: false, t: 0, dur: 0, go: 0, lastShown: 0 },

    active: function () { return !!this.state.on; },

    // Coloca a cada actor arriba de su punto de aparición con una velocidad de caída
    // calculada para que toque el suelo justo cuando la cuenta llega a 0.
    start: function (dur) {
      var s = this.state;
      s.dur = dur;
      s.t = 0;
      s.go = 0;
      s.lastShown = Math.ceil(dur);
      s.on = dur > 0;
      if (!s.on) return;
      for (var i = 0; i < ZC.actors.length; i++) {
        var a = ZC.actors[i];
        // Sale desde arriba de su punto de aparición y cae hasta la primera superficie
        // bajo la salida (pasarela, caja o suelo): así nadie aterriza antes de tiempo
        // y todos tocan tierra justo en el 0.
        var startY = Math.max(150, Math.min(a.y - 200, TOP_Y + (a.isPlayer ? 0 : ZC.util.rand(-120, 60))));
        var targetY = ZC.Drop.surfaceBelow(a.x, startY);
        a.dropFromY = startY;
        a.dropVy = (targetY - startY) / dur;
        a.y = startY;
        a.vx = 0;
        a.vy = a.dropVy;
        a.grounded = false;
        a.landed = false;
        a.chute = 1; // 1 = paracaídas abierto; se pliega al aterrizar
      }
    },

    // y de la primera superficie que pisa un actor en x cayendo desde y.
    surfaceBelow: function (x, y) {
      var best = ZC.CFG.groundY;
      var half = (ZC.CFG.actorW || 20) / 2;
      var m = ZC.map || { platforms: [], crates: [] };
      for (var i = 0; i < m.platforms.length; i++) {
        var p = m.platforms[i];
        if (x + half > p.x + 3 && x - half < p.x + p.w - 3 && p.y >= y && p.y < best) best = p.y;
      }
      for (var j = 0; j < m.crates.length; j++) {
        var c = m.crates[j];
        if (x + half > c.x && x - half < c.x + c.w && c.y >= y && c.y < best) best = c.y;
      }
      return best;
    },

    // Termina la caída ya (botón de prueba y partidas con dropTime 0).
    skip: function () {
      var s = this.state;
      if (!s.on) return;
      s.t = s.dur;
      this.finish();
    },

    finish: function () {
      var s = this.state;
      s.on = false;
      s.go = GO_TIME;
      for (var i = 0; i < ZC.actors.length; i++) {
        var a = ZC.actors[i];
        // Quien no tocó suelo sigue cayendo con la física normal (cae solo unos píxeles)
        if (!a.landed) a.vy = Math.min(a.vy, 120);
        a.landed = true;
      }
      ZC.match.startedAt = ZC.util.now();
      if (ZC.addFeed) ZC.addFeed("Aterrizaje · " + ZC.match.alive + " en combate");
      if (ZC.sfx) ZC.sfx("land");
    },

    // Avanza la caída. moveX es el input horizontal del jugador (-1..1).
    update: function (dt, moveX) {
      var s = this.state;
      if (s.go > 0) s.go = Math.max(0, s.go - dt);
      // El paracaídas se pliega al tocar suelo (también después de la cuenta)
      for (var k = 0; k < ZC.actors.length; k++) {
        var b = ZC.actors[k];
        if (b.landed && b.chute > 0) b.chute = Math.max(0, b.chute - dt * 4);
      }
      if (!s.on) return;
      s.t += dt;
      var shown = Math.ceil(Math.max(0, s.dur - s.t));
      if (shown !== s.lastShown) {
        s.lastShown = shown;
        if (shown > 0 && ZC.sfx) ZC.sfx("tick");
      }
      for (var i = 0; i < ZC.actors.length; i++) {
        var a = ZC.actors[i];
        if (a.dead) continue;
        if (a.landed) {
          // Ya en el suelo: puede caminar, pero aún no disparar
          a.vx = a.isPlayer ? (moveX || 0) * ZC.CFG.moveSpeed * 0.6 : 0;
          ZC.collideWorld(a, dt);
          continue;
        }
        a.vx = a.isPlayer ? (moveX || 0) * STEER : 0;
        a.vy = a.dropVy - ZC.CFG.gravity * dt; // collideWorld suma la gravedad de un frame
        ZC.collideWorld(a, dt);
        a.vy = a.dropVy;
        if (a.isPlayer) a.aimX = moveX < 0 ? -1 : (moveX > 0 ? 1 : a.aimX), a.aimY = 0;
        if (a.grounded) {
          a.landed = true;
          a.vy = 0;
          if (ZC.burst) ZC.burst(a.x, a.y, 8, "#a08a62", 120);
        }
      }
      if (s.t >= s.dur) this.finish();
    },

    // Número que se ve en pantalla (3, 2, 1) o 0 si ya terminó.
    count: function () {
      var s = this.state;
      if (!s.on) return 0;
      return Math.max(1, Math.ceil(s.dur - s.t));
    },

    // Altura simulada para el indicador lateral (metros, decorativo)
    altitude: function () {
      var p = ZC.player;
      if (!p || p.dropFromY == null) return 0;
      var total = Math.max(1, ZC.CFG.groundY - p.dropFromY);
      return Math.max(0, Math.round((ZC.CFG.groundY - p.y) / total * 300));
    }
  };

  // Paracaídas y estela, en coordenadas del mundo (render.js lo llama antes de los actores).
  ZC.drawDropWorld = function () {
    var c = ZC.ctx;
    if (!c) return;
    var s = ZC.Drop.state;
    for (var i = 0; i < ZC.actors.length; i++) {
      var a = ZC.actors[i];
      if (a.dead || !(a.chute > 0)) continue;
      var k = a.chute;
      var sway = Math.sin((s.t + i) * 2.2) * 4 * k;
      var topY = a.y - 120 - 18 * k;
      var w = 56 * k + 10;
      c.save();
      c.globalAlpha = 0.25 + 0.75 * k;
      // Cuerdas
      c.strokeStyle = "rgba(226,210,170,0.7)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(a.x - 9, a.y - 52); c.lineTo(a.x - w / 2 + sway, topY + 14);
      c.moveTo(a.x + 9, a.y - 52); c.lineTo(a.x + w / 2 + sway, topY + 14);
      c.moveTo(a.x, a.y - 54); c.lineTo(a.x + sway, topY + 16);
      c.stroke();
      // Vela: franjas oliva y arena
      c.beginPath();
      c.moveTo(a.x - w / 2 + sway, topY + 16);
      c.quadraticCurveTo(a.x + sway, topY - 30 * k, a.x + w / 2 + sway, topY + 16);
      c.quadraticCurveTo(a.x + sway, topY + 6, a.x - w / 2 + sway, topY + 16);
      c.closePath();
      c.fillStyle = a.isPlayer ? "#c9963f" : "#6f7a4c";
      c.fill();
      c.strokeStyle = "rgba(30,22,14,0.75)";
      c.lineWidth = 2;
      c.stroke();
      // Estela de viento mientras cae
      if (!a.landed) {
        c.strokeStyle = "rgba(236,222,190,0.22)";
        c.lineWidth = 1;
        for (var j = 0; j < 3; j++) {
          var ox = (j - 1) * 14 + sway;
          var off = ((s.t * 260 + j * 37 + i * 19) % 60);
          c.beginPath();
          c.moveTo(a.x + ox, a.y - 10 - off);
          c.lineTo(a.x + ox, a.y - 34 - off);
          c.stroke();
        }
      }
      c.restore();
    }
  };

  // Cuenta regresiva en pantalla (encima del HUD).
  ZC.drawDropHUD = function () {
    var c = ZC.ctx;
    if (!c) return;
    var s = ZC.Drop.state;
    var W = ZC.viewW, H = ZC.viewH;
    var compact = H < 500;
    if (s.on) {
      var n = ZC.Drop.count();
      var frac = (s.dur - s.t) - (n - 1); // 1 → 0 dentro de cada segundo
      var pop = 1 + Math.max(0, frac - 0.75) * 1.6;
      // Franjas de cine arriba y abajo: marca que es una secuencia, no una pausa
      var band = compact ? 18 : 28;
      c.fillStyle = "rgba(14,11,7,0.55)";
      c.fillRect(0, 0, W, band);
      c.fillRect(0, H - band, W, band);

      // Arriba al centro, bajo el cronómetro: el jugador cae más abajo (camFeetRatio 0.8)
      var R = compact ? 38 : 60;
      var cy = (compact ? 56 : 80) + R + (compact ? 6 : 10);
      c.textAlign = "center";
      c.fillStyle = "#d9a24a";
      c.font = "700 " + (compact ? 11 : 13) + "px Segoe UI, sans-serif";
      var mapName = (ZC.map && ZC.map.name) ? ZC.map.name : "la zona";
      c.fillText(("Saltando sobre " + mapName).toUpperCase(), W / 2, cy - R - (compact ? 6 : 10));

      // Número grande con anillo de progreso del segundo actual
      c.save();
      c.translate(W / 2, cy);
      c.fillStyle = "rgba(22,18,12,0.62)";
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(214,190,140,0.25)";
      c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = "#d9a24a";
      c.beginPath(); c.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ZC.util.clamp(frac, 0, 1)); c.stroke();
      c.scale(pop, pop);
      c.fillStyle = "#f3e9d2";
      c.font = "800 " + (compact ? 46 : 72) + "px Segoe UI, sans-serif";
      c.textBaseline = "middle";
      c.fillText(String(n), 0, compact ? 3 : 4);
      c.textBaseline = "alphabetic";
      c.restore();

      // Pista en la franja de abajo, entre los joysticks
      c.fillStyle = "#e6dcc6";
      c.font = (compact ? 11 : 13) + "px Segoe UI, sans-serif";
      c.fillText("Guía la caída: joystick izquierdo o A / D", W / 2, H - band / 2 + 4);

      // Altímetro a la izquierda
      var alt = ZC.Drop.altitude();
      var ax = compact ? 22 : 34, ah = compact ? 110 : 200, ay = compact ? 132 : H / 2 - ah / 2;
      c.fillStyle = "rgba(22,18,12,0.6)";
      c.fillRect(ax - 4, ay - 4, 12, ah + 8);
      c.fillStyle = "rgba(214,190,140,0.25)";
      c.fillRect(ax, ay, 4, ah);
      var py = ay + ah * (1 - ZC.util.clamp(alt / 300, 0, 1));
      c.fillStyle = "#d9a24a";
      c.fillRect(ax - 6, py - 2, 16, 4);
      c.textAlign = "left";
      c.fillStyle = "#efe6d2";
      c.font = "700 " + (compact ? 12 : 13) + "px Segoe UI, sans-serif";
      c.fillText(alt + " m", ax + 16, py + 4);
    } else if (s.go > 0) {
      var a = ZC.util.clamp(s.go / 0.9, 0, 1);
      c.save();
      c.globalAlpha = a;
      c.textAlign = "center";
      c.fillStyle = "rgba(22,18,12,0.6)";
      var bw = compact ? 260 : 360, bh = compact ? 44 : 60;
      c.fillRect(W / 2 - bw / 2, H * 0.4 - bh / 2, bw, bh);
      c.fillStyle = "#d9a24a";
      c.fillRect(W / 2 - bw / 2, H * 0.4 - bh / 2, bw, 3);
      c.fillStyle = "#f3e9d2";
      c.font = "800 " + (compact ? 24 : 32) + "px Segoe UI, sans-serif";
      c.textBaseline = "middle";
      c.fillText("A COMBATIR", W / 2, H * 0.4 + 2);
      c.textBaseline = "alphabetic";
      c.restore();
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
