/* ============================================================================
   ZCero — arranque (videos de entrada, carga y paso al lobby)
   Contrato: ZC.Boot controla la secuencia al abrir la página:
     1) "creator": video del creador (assets/creadorAmilthon.mp4) con la firma
        de ZC.BRAND.creator abajo, pequeña, que aparece suave.
     2) "intro": animación de entrada del juego (assets/intro.mp4).
     3) "loading": barra de carga real. Cuenta el logo y las imágenes de fondo de
        cada mapa (ZC.Maps.images). Mientras corren los videos ya se van bajando.
        La barra nunca muestra más de lo que de verdad cargó; si algo tarda
        demasiado (maxWait) se entra igual y se dice.
     4) "ready": 100 %, «Toca para entrar» o pasa sola tras un momento.
     5) "done": oculta #boot-screen y abre el lobby (ZC.openLobby).
   Videos: el navegador solo deja arrancarlos SIN sonido (muted + playsinline).
   El primer toque activa el sonido; el botón «Saltar» pasa al siguiente.
   Si un video no carga, se traba o el navegador no lo deja reproducir, se salta
   solo tras unos segundos: la entrada nunca se queda colgada.
   La lógica es pura (ZC.Boot.step(dt)) para poder probarla sin navegador.
   Depende de: js/zc.js, js/maps.js, js/ui.js, js/lobby.js (en runtime)
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/boot.js");

  // Orden de los videos. Para quitar uno, bórralo de esta lista (y su <video>).
  var FILMS = [
    { phase: "creator", id: "boot-video-creator" },
    { phase: "intro", id: "boot-video-intro" }
  ];

  var Boot = {
    // Tiempos en segundos.
    //  videoStart: espera máxima a que un video empiece a moverse.
    //  videoStall: si se queda congelado este tiempo, se salta.
    //  videoMax:   tope absoluto por video (por si el navegador no avisa del final).
    //  creditAt:   cuándo aparece la firma sobre el video del creador.
    timing: { minLoad: 0.9, readyHold: 0.8, maxWait: 9, videoStart: 6, videoStall: 3.5, videoMax: 16, creditAt: 3.2 },
    phase: "idle",
    t: 0,          // tiempo dentro de la fase actual
    shown: 0,      // progreso mostrado (0..1), nunca mayor que el real
    items: [],     // { src, img, done, failed }
    timedOut: false,
    raf: 0,
    lastTs: 0,
    manual: false,
    sound: false,  // true tras el primer toque (si el juego no está en silencio)
    film: null,    // estado del video actual: { el, lastTime, still, blocked, started }
    skipped: [],   // fases de video que se saltaron solas (para pruebas y depuración)

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
      var logo = el("boot-logo");
      if (logo && logo.getAttribute) add(logo.getAttribute("src") || "logo", logo, "logo");
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
      this.t = 0;
      this.shown = 0;
      this.timedOut = false;
      this.skipped = [];
      this.sound = false;
      setBooting(true);
      if (ZC.applyBrand) ZC.applyBrand();
      ZC.showOverlay("boot-screen");
      // opts.films === false: sin videos (directo a la carga)
      this.setPhase(opts.films === false ? "loading" : FILMS[0].phase);
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

    isFilm: function (p) { return filmIndex(p == null ? this.phase : p) >= 0; },

    setPhase: function (p) {
      var prev = this.phase;
      if (this.isFilm(prev) && prev !== p) stopFilm(this.film);
      this.phase = p;
      this.t = 0;
      this.film = null;
      if (this.isFilm(p)) this.film = playFilm(FILMS[filmIndex(p)].id, this.sound);
      // Mientras corre un video, el siguiente ya se va bajando
      var next = FILMS[filmIndex(p) + 1];
      if (next) { var nv = el(next.id); if (nv) { try { nv.preload = "auto"; } catch (e) {} } }
      this.paint();
    },

    // Pasa del video actual al siguiente (o a la carga).
    nextFilm: function (why) {
      var i = filmIndex(this.phase);
      if (i < 0) return this.phase;
      if (why && why !== "end" && why !== "user") this.skipped.push(this.phase + ":" + why);
      this.setPhase(FILMS[i + 1] ? FILMS[i + 1].phase : "loading");
      return this.phase;
    },

    // Revisa el video en curso: terminó, falló, se trabó o nunca arrancó.
    stepFilm: function (dt) {
      var T = this.timing, f = this.film;
      if (!f || !f.el) return this.nextFilm("missing");
      var v = f.el;
      if (v.error) return this.nextFilm("error");
      var cur = Number(v.currentTime) || 0;
      var dur = Number(v.duration) || 0;
      if (v.ended || (dur > 0 && cur >= dur - 0.06)) return this.nextFilm("end");
      if (cur > f.lastTime + 0.001) { f.lastTime = cur; f.still = 0; f.started = true; }
      else f.still += dt;
      if (!f.started) {
        // El navegador no lo deja reproducir solo: se ve el botón de play y,
        // si nadie toca, se salta igual.
        if (this.t >= T.videoStart) return this.nextFilm(f.blocked ? "blocked" : "slow");
      } else if (f.still >= T.videoStall) return this.nextFilm("stall");
      if (this.t >= (dur > 0 ? Math.min(T.videoMax, dur + 2) : T.videoMax)) return this.nextFilm("max");
      return this.phase;
    },

    step: function (dt) {
      if (this.phase === "idle" || this.phase === "done") return this.phase;
      this.t += dt;
      var T = this.timing;
      if (this.isFilm()) {
        this.stepFilm(dt);
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

    // Primer toque durante un video: activa el sonido (y lo arranca si el
    // navegador lo había bloqueado). No salta: para eso está «Saltar».
    // Con todo cargado, un toque entra al lobby.
    tap: function () {
      if (this.isFilm()) {
        this.unlockSound();
        var f = this.film;
        if (f && f.el && f.el.paused && !f.el.ended) tryPlay(f);
      } else if (this.phase === "ready") this.enter();
      return this.phase;
    },

    // Botón «Saltar»: el video actual termina ya.
    skipFilm: function () {
      if (!this.isFilm()) return this.phase;
      this.unlockSound();
      return this.nextFilm("user");
    },

    // Sonido de los videos: solo tras un toque y si el juego no está en silencio.
    unlockSound: function () {
      if (ZC.unlockAudio) { try { ZC.unlockAudio(); } catch (e) {} }
      this.setSound(!ZC.muted);
    },
    setSound: function (on) {
      this.sound = !!on;
      var f = this.film;
      if (f && f.el) { try { f.el.muted = !this.sound; } catch (e) {} }
      this.paint();
    },

    enter: function () {
      if (this.phase === "done") return;
      if (this.isFilm()) stopFilm(this.film);
      this.film = null;
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
      var root = el("boot-screen");
      if (!root) return;
      if (root.setAttribute) root.setAttribute("data-phase", this.phase);
      var film = this.isFilm();
      FILMS.forEach(function (fl) {
        var v = el(fl.id);
        if (v) v.hidden = Boot.phase !== fl.phase;
      });
      var credit = el("boot-credit");
      if (credit) {
        credit.hidden = this.phase !== "creator";
        if (credit.classList) credit.classList.toggle("on", this.phase === "creator" && this.t >= this.timing.creditAt);
      }
      var hint = el("boot-hint");
      if (hint) hint.hidden = !(film && this.film && this.film.blocked && !this.film.started);
      var snd = el("boot-sound");
      if (snd) {
        if (snd.classList) snd.classList.toggle("off", !this.sound);
        if (snd.setAttribute) {
          snd.setAttribute("aria-label", this.sound ? "Silenciar video" : "Activar sonido");
          snd.setAttribute("title", this.sound ? "Silenciar video" : "Activar sonido");
        }
      }
      var fill = el("boot-fill");
      var pct = el("boot-pct");
      var status = el("boot-status");
      var tapHint = el("boot-tap");
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

  function el(id) {
    if (typeof document === "undefined" || !document.getElementById) return null;
    return document.getElementById(id);
  }

  function filmIndex(p) {
    for (var i = 0; i < FILMS.length; i++) if (FILMS[i].phase === p) return i;
    return -1;
  }

  // Arranca un <video> desde el inicio. Devuelve su estado para stepFilm.
  function playFilm(id, sound) {
    var v = el(id);
    // Sin <video> (o el navegador no sabe reproducir): se trata como si faltara
    if (v && typeof v.play !== "function") v = null;
    var f = { el: v, lastTime: 0, still: 0, started: false, blocked: false };
    if (!v) return f;
    try {
      v.muted = !sound;
      v.playsInline = true;
      if (v.currentTime) v.currentTime = 0;
    } catch (e) {}
    tryPlay(f);
    return f;
  }

  function tryPlay(f) {
    if (!f || !f.el || typeof f.el.play !== "function") return;
    try {
      var p = f.el.play();
      if (p && p.then) {
        p.then(function () { f.blocked = false; Boot.paint(); }, function () {
          // Bloqueado (ahorro de batería, política del navegador...).
          // Si tenía sonido, probamos otra vez en silencio.
          if (!f.el.muted) {
            f.el.muted = true;
            Boot.sound = false;
            tryPlay(f);
            return;
          }
          f.blocked = true;
          Boot.paint();
        });
      }
    } catch (e) { f.blocked = true; }
  }

  function stopFilm(f) {
    if (!f || !f.el) return;
    try { if (f.el.pause) f.el.pause(); } catch (e) {}
    f.el.hidden = true;
  }

  function setBooting(on) {
    var app = el("app");
    if (app && app.classList) app.classList.toggle("booting", !!on);
  }

  Boot.FILMS = FILMS;
  ZC.Boot = Boot;

  ZC.bindBoot = function () {
    var root = el("boot-screen");
    if (root && !root.__zcBound) {
      root.addEventListener("click", function () { Boot.tap(); });
      root.__zcBound = true;
      var skipBtn = el("boot-skip");
      if (skipBtn) skipBtn.addEventListener("click", function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        Boot.skipFilm();
      });
      var snd = el("boot-sound");
      if (snd) snd.addEventListener("click", function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (Boot.sound) Boot.setSound(false); else Boot.unlockSound();
      });
      // Si el video termina, avanza en el mismo instante (sin esperar al siguiente cuadro)
      FILMS.forEach(function (fl) {
        var v = el(fl.id);
        if (v && v.addEventListener) {
          v.addEventListener("ended", function () { if (Boot.phase === fl.phase) Boot.nextFilm("end"); });
          v.addEventListener("error", function () { if (Boot.phase === fl.phase) Boot.nextFilm("error"); });
        }
      });
      global.addEventListener("keydown", function (e) {
        if (Boot.isFilm() && (e.code === "Escape" || e.code === "Enter" || e.code === "Space")) Boot.skipFilm();
        else if (Boot.phase === "ready" && (e.code === "Enter" || e.code === "Space")) Boot.tap();
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
