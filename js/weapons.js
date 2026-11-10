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
      reload: 1.2, auto: true, color: "#cdbb8a", recoil: 0.07,
      barrel: 38
    },
    shotgun: {
      id: "shotgun", name: "Escopeta", damage: 9, pellets: 5, spread: 0.2,
      speed: 820, range: 350, fireDelay: 0.58, mag: 6, reserve: 18,
      reload: 1.5, auto: false, color: "#e0a85a", recoil: 0.2,
      barrel: 35
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

  // ---------------------------------------------------------------------------
  // Geometría del arma en la mano (una sola fuente para el dibujo y las balas).
  // Coordenadas locales: pies del actor en (0, 0), Y negativo hacia arriba.
  // El arma gira sobre un pivote a la altura del pecho (shoulderX * bulk, shoulderY)
  // y su boca (cañón) queda a `barrel` px de ese pivote. El brazo sale del hombro
  // (armY) hasta la mano. shoulderY = -38 queda sobre las cajas (40 px de alto):
  // un disparo recto sigue chocando con una caja que está en medio.
  // appearance.js dibuja con estos números y combat.js saca las balas del mismo
  // punto, así la bala nunca sale de la cintura.
  // ---------------------------------------------------------------------------
  ZC.GUN_RIG = { shoulderX: 7, shoulderY: -38, armY: -44, gripX: 12, defaultBarrel: 36 };

  ZC.barrelOf = function (weaponId) {
    var w = ZC.WEAPONS[weaponId];
    return (w && w.barrel) || ZC.GUN_RIG.defaultBarrel;
  };

  // Hacia dónde mira el cuerpo: según la puntería; si apunta recto arriba/abajo, según facing.
  ZC.faceOf = function (actor) {
    var ax = actor && actor.aimX || 0;
    if (ax > 0.001) return 1;
    if (ax < -0.001) return -1;
    return actor && actor.facing < 0 ? -1 : 1;
  };

  // Hombro y boca del arma relativos a los pies, más el ángulo real del disparo.
  // bulk: ancho del aspecto (1 para bots; el lobby/appearance pasan el suyo).
  ZC.gunRig = function (actor, bulk) {
    if (bulk == null) {
      var pal = ZC.Appearance && ZC.Appearance.paletteFor ? ZC.Appearance.paletteFor(actor) : null;
      bulk = (pal && pal.bulk) || 1;
    }
    var face = ZC.faceOf(actor);
    var ax = actor && actor.aimX || 0, ay = actor && actor.aimY || 0;
    if (Math.abs(ax) < 1e-6 && Math.abs(ay) < 1e-6) ax = face;
    var ang = Math.atan2(ay, ax);
    // Ángulo en el espacio espejado del dibujo (cuando mira a la izquierda se voltea en X)
    var local = Math.atan2(ay, Math.abs(ax) < 1e-6 ? 0 : Math.abs(ax));
    var gunId = (actor && actor.gun && actor.gun.current) || "rifle";
    var L = ZC.barrelOf(gunId);
    var sx = face * ZC.GUN_RIG.shoulderX * bulk;
    var sy = ZC.GUN_RIG.shoulderY;
    return {
      face: face, bulk: bulk, ang: ang, localAng: local, barrel: L,
      shoulderX: sx, shoulderY: sy,
      muzzleX: sx + Math.cos(ang) * L,
      muzzleY: sy + Math.sin(ang) * L
    };
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
