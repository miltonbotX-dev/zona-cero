/* ============================================================================
   ZCero — jugador
   Contrato: Crea al jugador (ZC.spawnPlayer) y aplica su input+física (ZC.updatePlayer). No pinta HUD ni define teclas.
   Depende de: js/zc.js, js/entities.js, js/physics.js, js/input.js (readPlayerInput en runtime)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/player.js");

ZC.spawnPlayer = function (spot) {
    spot = spot || { x: 400, y: ZC.CFG.groundY };
    ZC.player = ZC.makeActor({
      id: 0, name: "Tú", color: "red", isPlayer: true,
      x: spot.x, y: spot.y
    });
    if (ZC.applyProfile) ZC.applyProfile(ZC.player);
    return ZC.player;
  };

  ZC.updatePlayer = function (dt, pin) {
    var a = ZC.player;
    if (!a || a.dead) return;
    pin = pin || { moveX: 0, jump: false, fire: false, reload: false };
    ZC.controlActor(a, dt, pin.moveX, pin.jump, pin.fire, pin.reload);
    ZC.collideWorld(a, dt);
  };
})(typeof window !== "undefined" ? window : globalThis);
