/* ============================================================================
   ZCero — overlays DOM, nombre del juego (ZC.applyBrand) e íconos (ZC.icon)
   Contrato: Muestra/oculta title, lobby y result con hidden+active. ZC.UI.screens registra esas pantallas.
   Depende de: js/zc.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/ui.js");

ZC.hideOverlay = function (id) {
    const n = document.getElementById(id);
    if (!n) return;
    n.hidden = true;
    n.classList.remove("active");
  }
  ZC.showOverlay = function (id) {
    const n = document.getElementById(id);
    if (!n) return;
    n.hidden = false;
    n.classList.add("active");
  }

  // Nombre del juego: copia ZC.BRAND (js/zc.js) a todo lo que tenga
  // data-brand="name" | "tag" | "company" | "creator" y al título de la pestaña.
  ZC.applyBrand = function () {
    var B = ZC.BRAND || {};
    if (typeof document === "undefined") return;
    if (B.name) {
      try { document.title = B.name; } catch (e) {}
      var cv = document.getElementById("game");
      if (cv && cv.setAttribute) cv.setAttribute("aria-label", "Arena de " + B.name);
    }
    var nodes = document.querySelectorAll ? document.querySelectorAll("[data-brand]") : [];
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-brand");
      if (B[key]) nodes[i].textContent = B[key];
    }
  };

  // Ícono SVG del juego (los dibujos están en index.html, <symbol id="i-...">).
  // Ejemplo: ZC.icon("play") -> '<svg class="ico" ...><use href="#i-play"/></svg>'
  ZC.icon = function (name, cls) {
    return '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  };

  ZC.goMenu = function () {
    ZC.state = "title";
    ZC.setInMatch(false);
    if (ZC.closeLobby) ZC.closeLobby();
    else ZC.hideOverlay("lobby-screen");
    ZC.hideOverlay("end-screen");
    const t = document.getElementById("title-screen");
    if (t) { t.hidden = false; t.classList.add("active"); }
  }

  // Marca #app.in-match durante la partida: el CSS mueve el botón de silencio
  // a la esquina izquierda para no tapar el minimapa ni el TOP 3.
  ZC.setInMatch = function (on) {
    var app = document.getElementById("app");
    if (app && app.classList) app.classList.toggle("in-match", !!on);
  };

  // Pantalla completa en celular (Android/Chrome). iPhone Safari no la permite para
  // páginas normales: ahí no hace nada y el juego sigue igual.
  ZC.fullscreenSupported = function () {
    var el = document.documentElement;
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  };
  ZC.isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  ZC.requestFullscreen = function () {
    var coarse = global.matchMedia && global.matchMedia("(pointer: coarse)").matches;
    if (!coarse || !ZC.fullscreenSupported() || ZC.isFullscreen()) return false;
    var el = document.documentElement;
    try {
      var p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen();
      if (p && p.then) {
        p.then(function () {
          if (global.screen && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(function () {});
          }
        }).catch(function () {});
      }
      return true;
    } catch (e) { return false; }
  };
  ZC.toggleFullscreen = function () {
    if (ZC.isFullscreen()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { var r = exit.call(document); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
      return;
    }
    var el = document.documentElement;
    if (!el) return;
    try {
      var q = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : (el.webkitRequestFullscreen && el.webkitRequestFullscreen());
      if (q && q.catch) q.catch(function () {});
    } catch (e) {}
  };

  // Añadir una pantalla = crear el overlay HTML + registrarlo aquí + llamar ZC.UI.show("id").
  ZC.UI = {
    screens: {
      boot: "boot-screen",
      title: "title-screen",
      lobby: "lobby-screen",
      result: "end-screen"
    },
    hide: function (name) {
      var id = this.screens[name] || name;
      ZC.hideOverlay(id);
    },
    show: function (name) {
      var id = this.screens[name] || name;
      ZC.showOverlay(id);
    }
  };

  ZC.bindShell = function () {
    var play = document.getElementById("btn-play");
    var again = document.getElementById("btn-again");
    var menu = document.getElementById("btn-menu");
    var how = document.getElementById("btn-how");
    if (play) play.addEventListener("click", function () {
      if (ZC.openLobby) ZC.openLobby(); else ZC.startMatch();
    });
    if (again) again.addEventListener("click", function () {
      if (ZC.openLobby) ZC.openLobby(); else ZC.startMatch();
    });
    if (menu) menu.addEventListener("click", function () { ZC.goMenu(); });
    if (how) how.addEventListener("click", function () {
      var g = document.getElementById("how-grid");
      if (g) g.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    if (ZC.hudMuteBtn) ZC.hudMuteBtn.addEventListener("click", ZC.toggleMute);
    var full = document.getElementById("btn-full");
    if (full) {
      if (!ZC.fullscreenSupported()) full.hidden = true;
      full.addEventListener("click", function () { ZC.toggleFullscreen(); });
    }
    if (ZC.bindLobby) ZC.bindLobby();
    ZC.applyBrand();
  };
})(typeof window !== "undefined" ? window : globalThis);
