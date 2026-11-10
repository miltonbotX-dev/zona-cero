/* ============================================================================
   Zona Cero — configuración numérica
   Contrato: Define ZC.CFG, ZC.BOT_NAMES y ZC.BOT_COLORS. Otros módulos leen, no reescriben, salvo que cambies un valor de diseño.
   Depende de: js/zc.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/config.js");

ZC.CFG = {
    worldW: 2600,
    worldH: 920,
    groundY: 818,
    gravity: 2100,
    moveSpeed: 268,
    airSpeed: 250,
    jumpV: -575,
    doubleJumpV: -520,
    maxFall: 980,
    coyote: 0.09,
    jumpBuffer: 0.12,
    actorW: 20,
    actorH: 38,
    botCount: 7,
    startDelay: 1.15,
    camLerp: 6.5,
    particleMax: 280,
    bulletMax: 90
  };
  ZC.BOT_NAMES = ["Lobo", "Sombra", "Nox", "Vale", "Rift", "Hex", "Ion"];
  ZC.BOT_COLORS = ["#c8743f", "#8f7aa8", "#7f9a52", "#b86a6a", "#c9a646", "#6f8aa3", "#a8604a"];
})(typeof window !== "undefined" ? window : globalThis);
