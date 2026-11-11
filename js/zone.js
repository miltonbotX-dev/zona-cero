/* ============================================================================
   ZCero — zona que se cierra
   Contrato: ZC.ZONE_SCRIPT y el círculo seguro (reset/update/inZone). El daño lo aplica game.js leyendo ZC.zone.dps.
   Depende de: js/zc.js, js/config.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/zone.js");

  ZC.ZONE_SCRIPT = [
    { wait: 10, radius: 1200, dps: 7,  hold: 0 },
    { wait: 8,  radius: 780,  dps: 11, hold: 6 },
    { wait: 7,  radius: 460,  dps: 16, hold: 5 },
    { wait: 6,  radius: 250,  dps: 22, hold: 5 },
    { wait: 5,  radius: 130,  dps: 32, hold: 8 }
  ];

  ZC.resetZone = function () {
    ZC.zone.cx = 1300; ZC.zone.cy = 560; ZC.zone.r = 1750;
    ZC.zone.tx = 1300; ZC.zone.ty = 560; ZC.zone.tr = 1750;
    ZC.zone.phase = 0; ZC.zone.timer = ZC.ZONE_SCRIPT[0].wait;
    ZC.zone.shrinking = false; ZC.zone.dps = 0; ZC.zone.hold = 0;
    ZC.pickNextCenter(ZC.ZONE_SCRIPT[0].radius);
  }

  ZC.pickNextCenter = function (nextR) {
    // El centro deriva un poco, como en PUBG, pero se queda dentro del mapa
    const ang = ZC.util.rand(0, Math.PI * 2);
    const drift = ZC.util.rand(40, 220);
    ZC.zone.tx = ZC.util.clamp(ZC.zone.cx + Math.cos(ang) * drift, 380, ZC.CFG.worldW - 380);
    ZC.zone.ty = ZC.util.clamp(ZC.zone.cy + Math.sin(ang) * drift * 0.55, 280, ZC.CFG.groundY - 80);
    ZC.zone.tr = nextR;
  }

  ZC.updateZone = function (dt) {
    const step = ZC.ZONE_SCRIPT[Math.min(ZC.zone.phase, ZC.ZONE_SCRIPT.length - 1)];
    ZC.zone.timer -= dt;
    if (!ZC.zone.shrinking && ZC.zone.hold > 0) {
      ZC.zone.hold -= dt;
      if (ZC.zone.hold <= 0 && ZC.zone.phase < ZC.ZONE_SCRIPT.length) {
        ZC.zone.shrinking = true;
        ZC.zone.timer = step.wait;
        ZC.pickNextCenter(step.radius);
      }
    } else if (!ZC.zone.shrinking && ZC.zone.timer <= 0) {
      ZC.zone.shrinking = true;
      ZC.zone.timer = step.wait;
    }
    if (ZC.zone.shrinking) {
      const t = step.wait <= 0 ? 1 : 1 - ZC.util.clamp(ZC.zone.timer / step.wait, 0, 1);
      // ease suave
      const e = t * t * (3 - 2 * t);
      ZC.zone.r = ZC.util.lerp(ZC.zone.r, ZC.zone.tr, 1 - Math.pow(0.22, dt));
      // hacia objetivo de forma más directa según progreso
      ZC.zone.cx = ZC.util.lerp(ZC.zone.cx, ZC.zone.tx, 1 - Math.pow(0.25, dt));
      ZC.zone.cy = ZC.util.lerp(ZC.zone.cy, ZC.zone.ty, 1 - Math.pow(0.25, dt));
      ZC.zone.dps = step.dps;
      if (ZC.zone.timer <= 0 || Math.abs(ZC.zone.r - ZC.zone.tr) < 4) {
        ZC.zone.r = ZC.zone.tr; ZC.zone.cx = ZC.zone.tx; ZC.zone.cy = ZC.zone.ty;
        ZC.zone.shrinking = false;
        ZC.zone.dps = step.dps;
        ZC.zone.phase = Math.min(ZC.zone.phase + 1, ZC.ZONE_SCRIPT.length - 1);
        ZC.zone.hold = ZC.ZONE_SCRIPT[ZC.zone.phase].hold || 6;
        ZC.zone.timer = ZC.ZONE_SCRIPT[ZC.zone.phase].wait;
        if (ZC.zone.phase < ZC.ZONE_SCRIPT.length - 1) ZC.pickNextCenter(ZC.ZONE_SCRIPT[ZC.zone.phase].radius);
      }
    }
  }

  ZC.inZone = function (x, y) {
    return ZC.util.dist2(x, y, ZC.zone.cx, ZC.zone.cy) <= ZC.zone.r * ZC.zone.r;
  }

  ZC.zoneLabel = function () {
    if (ZC.zone.shrinking) return "ZONA CERRANDO";
    if (ZC.zone.dps <= 0 && ZC.zone.phase === 0) return "ZONA ESTABLE";
    return "ZONA ESTABLE";
  }
})(typeof window !== "undefined" ? window : globalThis);
