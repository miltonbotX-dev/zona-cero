/* ============================================================================
   Zona Cero — overlays DOM
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

  ZC.goMenu = function () {
    ZC.state = "title";
    if (ZC.closeLobby) ZC.closeLobby();
    else ZC.hideOverlay("lobby-screen");
    ZC.hideOverlay("end-screen");
    const t = document.getElementById("title-screen");
    if (t) { t.hidden = false; t.classList.add("active"); }
  }

  // Añadir una pantalla = crear el overlay HTML + registrarlo aquí + llamar ZC.UI.show("id").
  ZC.UI = {
    screens: {
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
    if (ZC.bindLobby) ZC.bindLobby();
  };
})(typeof window !== "undefined" ? window : globalThis);
