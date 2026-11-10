/* ============================================================================
   Zona Cero — arranque (presentación, carga y entrada al lobby)
   Contrato: ZC.Boot controla la secuencia al abrir la página:
     1) "splash": tarjeta con el logo de Zona Cero (~1.4 s, un toque la acorta).
     2) "loading": barra de carga real. Cuenta el logo y las imágenes de fondo de
        cada mapa (ZC.Maps.images). La barra nunca muestra más de lo que de verdad
        cargó; si algo tarda demasiado (maxWait) se entra igual y se dice.
     3) "ready": 100 %, «Toca para entrar» o pasa sola tras un momento.
     4) "done": oculta #boot-screen y abre el lobby (ZC.openLobby).
   La lógica es pura (ZC.Boot.step(dt)) para poder probarla sin navegador.
   Depende de: js/zc.js, js/maps.js, js/ui.js, js/lobby.js (en runtime)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/boot.js");

  var Boot = {
    // Tiempos en segundos. Cortos: es una entrada, no un anuncio.
    timing: { splash: 1.4, minLoad: 0.9, readyHold: 0.8, maxWait: 9 },
    phase: "idle",
    t: 0,          // tiempo dentro de la fase actual
    shown: 0,      // progreso mostrado (0..1), nunca mayor que el real
    items: [],     // { src, img, done, failed }
    timedOut: false,
    raf: 0,
    lastTs: 0,
    manual: false,

    // Registra lo que hay que esperar: el logo y los fondos de mapa.
    collect: function () {
      var list = [];
      var seen = {};
      function add(src, img, kind) {
        if (!src || seen[src]) return;
        seen[src] = true;
        var it = { src: src, img: img || null, done: false, failed: false, kind: kind || "asset" };
        if (!it.img) it.done = true; // sin Image (pruebas / navegador raro): nada que esperar
        else {
          var settle = function (failed) { it.done = true; it.failed = !!failed; };
          if (it.img.complete && it.img.naturalWidth > 0) it.done = true;
          else if (it.img.addEventListener) {
            it.img.addEventListener("load", function () { settle(false); });
            it.img.addEventListener("error", function () { settle(true); });
          }
        }
        list.push(it);
      }
      if (ZC.Maps) {
        if (ZC.Maps.preload) ZC.Maps.preload();
        ZC.Maps.list().forEach(function (id) {
          var src = ZC.Maps.all[id].backgroundImage;
          add(src, ZC.Maps.images ? ZC.Maps.images[src] : null, "map");
        });
      }
      if (typeof document !== "undefined" && document.getElementById) {
        var logo = document.getElementById("boot-logo");
        if (logo && logo.getAttribute) add(logo.getAttribute("src") || "logo", logo, "logo");
      }
      this.items = list;
      return list;
    },

    // Progreso real: elementos terminados / total (un error también termina:
    // el mapa usa su degradado de respaldo).
    progress: function () {
      if (!this.items.length) return 1;
      var n = 0;
      for (var i = 0; i < this.items.length; i++) {
        var it = this.items[i];
        if (!it.done && it.img && it.img.complete) {
          it.done = true;
          it.failed = !(it.img.naturalWidth > 0);
        }
        if (it.done) n++;
      }
      return n / this.items.length;
    },

    start: function (opts) {
      opts = opts || {};
      this.manual = !!opts.manual;
      if (opts.timing) for (var k in opts.timing) this.timing[k] = opts.timing[k];
      this.collect();
      this.phase = "splash";
      this.t = 0;
      this.shown = 0;
      this.timedOut = false;
      setBooting(true);
      ZC.showOverlay("boot-screen");
      this.paint();
      if (!this.manual && global.requestAnimationFrame) {
        var self = this;
        this.lastTs = 0;
        var tick = function (ts) {
          if (self.phase === "done" || self.phase === "idle") return;
          if (!self.lastTs) self.lastTs = ts;
          var dt = Math.min(0.1, (ts - self.lastTs) / 1000);
          self.lastTs = ts;
          self.step(dt);
          self.raf = global.requestAnimationFrame(tick);
        };
        this.raf = global.requestAnimationFrame(tick);
      }
      return this;
    },

    setPhase: function (p) {
      this.phase = p;
      this.t = 0;
      this.paint();
    },

    step: function (dt) {
      if (this.phase === "idle" || this.phase === "done") return this.phase;
      this.t += dt;
      var T = this.timing;
      if (this.phase === "splash") {
        if (this.t >= T.splash) this.setPhase("loading");
      } else if (this.phase === "loading") {
        var real = this.progress();
        // La barra avanza suave pero nunca pasa del progreso real.
        var ramp = T.minLoad > 0 ? Math.min(1, this.t / T.minLoad) : 1;
        this.shown = Math.min(real, Math.max(this.shown, ramp * real));
        if (real >= 1 && this.t >= T.minLoad) {
          this.shown = 1;
          this.setPhase("ready");
        } else if (this.t >= T.maxWait) {
          // No se queda colgada: entra con lo que hay y lo dice (sin fingir 100 %).
          this.timedOut = true;
          this.shown = real;
          this.setPhase("ready");
        }
      } else if (this.phase === "ready") {
        if (this.t >= T.readyHold) this.enter();
      }
      this.paint();
      return this.phase;
    },

    // Toque o clic: acorta la presentación; con todo listo, entra.
    tap: function () {
      if (this.phase === "splash") this.setPhase("loading");
      else if (this.phase === "ready") this.enter();
      return this.phase;
    },

    enter: function () {
      if (this.phase === "done") return;
      this.phase = "done";
      if (this.raf && global.cancelAnimationFrame) global.cancelAnimationFrame(this.raf);
      this.raf = 0;
      ZC.hideOverlay("boot-screen");
      setBooting(false);
      if (ZC.openLobby) ZC.openLobby();
      else ZC.showOverlay("title-screen");
    },

    // Saltar todo (pruebas o enlace directo): entra al lobby ya.
    skip: function () {
      if (this.phase === "idle") this.collect();
      this.shown = this.progress();
      this.enter();
    },

    paint: function () {
      if (typeof document === "undefined" || !document.getElementById) return;
      var root = document.getElementById("boot-screen");
      if (!root) return;
      if (root.setAttribute) root.setAttribute("data-phase", this.phase);
      var fill = document.getElementById("boot-fill");
      var pct = document.getElementById("boot-pct");
      var status = document.getElementById("boot-status");
      var tapHint = document.getElementById("boot-tap");
      var n = Math.floor(this.shown * 100 + 1e-6);
      if (fill && fill.style) fill.style.width = n + "%";
      if (pct) pct.textContent = n + "%";
      if (status) {
        var msg = "Preparando";
        if (this.phase === "loading") {
          var done = 0, maps = 0;
          this.items.forEach(function (it) { if (it.kind === "map") { maps++; if (it.done) done++; } });
          msg = done < maps ? "Cargando mapas  " + done + " / " + maps
            : (this.progress() < 1 ? "Cargando recursos" : "Preparando el lobby");
        } else if (this.phase === "ready" || this.phase === "done") {
          msg = this.timedOut ? "Algunos fondos siguen cargando" : "Listo";
        }
        status.textContent = msg;
      }
      if (tapHint) tapHint.hidden = this.phase !== "ready";
    }
  };

  function setBooting(on) {
    if (typeof document === "undefined" || !document.getElementById) return;
    var app = document.getElementById("app");
    if (app && app.classList) app.classList.toggle("booting", !!on);
  }

  ZC.Boot = Boot;

  ZC.bindBoot = function () {
    var root = typeof document !== "undefined" && document.getElementById ? document.getElementById("boot-screen") : null;
    if (root && !root.__zcBound) {
      root.addEventListener("click", function () { Boot.tap(); });
      root.__zcBound = true;
      global.addEventListener("keydown", function (e) {
        if (Boot.phase !== "splash" && Boot.phase !== "ready") return;
        if (e.code === "Enter" || e.code === "Space") Boot.tap();
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
