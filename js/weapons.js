/* ============================================================================
   Zona Cero — armas
   Contrato: Define ZC.WEAPONS y ZC.copyLoadout / ZC.registerWeapon. El combate lee estas fichas; no pongas lógica de disparo aquí.
   Depende de: js/zc.js, js/config.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/weapons.js");

ZC.WEAPONS = {
    rifle: {
      id: "rifle", name: "Fusil", damage: 16, pellets: 1, spread: 0.032,
      speed: 1000, range: 1020, fireDelay: 0.125, mag: 24, reserve: 48,
      reload: 1.2, auto: true, color: "#7ad7ff", recoil: 0.07
    },
    shotgun: {
      id: "shotgun", name: "Escopeta", damage: 9, pellets: 5, spread: 0.2,
      speed: 820, range: 350, fireDelay: 0.58, mag: 6, reserve: 18,
      reload: 1.5, auto: false, color: "#ffcf6b", recoil: 0.2
    }
  };

  // Punto de extensión: registrar otra arma (sin pantalla de inventario todavía).
  // Después hay que soltarla en el mapa o dársela al loadout inicial.
  ZC.registerWeapon = function (id, def) {
    def = def || {};
    def.id = id;
    ZC.WEAPONS[id] = def;
    return def;
  };

  ZC.copyLoadout = function () {
    var load = { current: "rifle", cooldown: 0, reloading: 0, reloadOf: null };
    Object.keys(ZC.WEAPONS).forEach(function (id) {
      var w = ZC.WEAPONS[id];
      load[id] = { mag: w.mag, reserve: w.reserve };
    });
    return load;
  };
})(typeof window !== "undefined" ? window : globalThis);
