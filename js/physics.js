/* ============================================================================
   Zona Cero — física de plataformas
   Contrato: collideWorld, tryJump (doble salto + coyote) y controlActor (mover/saltar y dispara/recarga vía combate). Mutan el actor; leen ZC.map y ZC.CFG.
   Depende de: js/zc.js, js/config.js, js/maps.js  (en runtime llama a ZC.fireWeapon / ZC.startReload)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/physics.js");

ZC.collideWorld = function (a, dt) {
    // Horizontal contra cajas sólidas y bordes del mundo
    a.x += a.vx * dt;
    const half = a.w / 2;
    if (a.x < half + 8) { a.x = half + 8; a.vx = 0; }
    if (a.x > ZC.CFG.worldW - half - 8) { a.x = ZC.CFG.worldW - half - 8; a.vx = 0; }
    const bodyX = a.x - half, bodyY = a.y - a.h, bw = a.w, bh = a.h;
    for (let i = 0; i < ZC.map.crates.length; i++) {
      const c = ZC.map.crates[i];
      if (!ZC.util.aabb(bodyX, bodyY, bw, bh, c.x, c.y, c.w, c.h)) continue;
      if (a.vx > 0) a.x = c.x - half;
      else if (a.vx < 0) a.x = c.x + c.w + half;
      a.vx = 0;
    }

    // Vertical: gravedad + suelo + cajas + plataformas de un solo sentido
    a.vy = Math.min(ZC.CFG.maxFall, a.vy + ZC.CFG.gravity * dt);
    const prevY = a.y;
    a.y += a.vy * dt;
    a.grounded = false;

    if (a.y > ZC.CFG.groundY) {
      a.y = ZC.CFG.groundY; a.vy = 0; a.grounded = true; a.jumpsLeft = 1;
    }

    // Cajas sólidas verticales
    for (let i = 0; i < ZC.map.crates.length; i++) {
      const c = ZC.map.crates[i];
      const bx = a.x - half, by = a.y - a.h;
      if (!ZC.util.aabb(bx, by, a.w, a.h, c.x, c.y, c.w, c.h)) continue;
      if (a.vy >= 0 && prevY - 1 <= c.y) {
        a.y = c.y; a.vy = 0; a.grounded = true; a.jumpsLeft = 1;
      } else if (a.vy < 0 && prevY - a.h >= c.y + c.h - 1) {
        a.y = c.y + c.h + a.h; a.vy = 0;
      }
    }

    // Plataformas: solo se aterriza cayendo desde arriba
    if (a.vy >= 0) {
      for (let i = 0; i < ZC.map.platforms.length; i++) {
        const p = ZC.map.platforms[i];
        const withinX = a.x + half > p.x + 3 && a.x - half < p.x + p.w - 3;
        if (!withinX) continue;
        if (prevY <= p.y + 4 && a.y >= p.y && prevY <= a.y) {
          a.y = p.y; a.vy = 0; a.grounded = true; a.jumpsLeft = 1;
        }
      }
    }

    if (a.grounded) a.coyote = ZC.CFG.coyote;
    else a.coyote = Math.max(0, a.coyote - dt);
  }

  ZC.tryJump = function (a) {
    if (a.dead) return false;
    const can = a.grounded || a.coyote > 0 || a.jumpsLeft > 0;
    // Si aún estamos en coyote (acabamos de dejar el suelo) es el primer salto
    if (a.grounded || a.coyote > 0) {
      a.vy = ZC.CFG.jumpV;
      a.grounded = false;
      a.coyote = 0;
      a.jumpsLeft = 1;
      ZC.puffJump(a);
      if (a === ZC.player) ZC.sfx("jump");
      return true;
    }
    if (a.jumpsLeft > 0) {
      a.vy = ZC.CFG.doubleJumpV;
      a.jumpsLeft -= 1;
      ZC.puffJump(a);
      if (a === ZC.player) ZC.sfx("jump");
      return true;
    }
    return false;
  }

  ZC.puffJump = function (a) {
    for (let i = 0; i < 6; i++) {
      ZC.spawnParticle(a.x + ZC.util.rand(-8, 8), a.y, ZC.util.rand(-50, 50), ZC.util.rand(-80, -10), 0.28, "rgba(200,220,240,0.7)", 2, 0.86);
    }
  }

  ZC.controlActor = function (a, dt, moveX, jumping, firing, reloading) {
    if (a.dead) { a.vx = 0; return; }
    const speed = a.grounded ? ZC.CFG.moveSpeed : ZC.CFG.airSpeed;
    if (Math.abs(moveX) > 0.08) {
      a.vx = moveX * speed;
      a.facing = moveX > 0 ? 1 : -1;
      a.walkPhase += dt * 12;
    } else {
      // En suelo se detiene en seco (más leíble en un shooter);
      // en el aire conserva un poco de inercia.
      a.vx = a.grounded ? 0 : a.vx * Math.pow(0.14, dt);
      if (Math.abs(a.vx) < 6) a.vx = 0;
    }
    if (jumping) a.jumpBuf = ZC.CFG.jumpBuffer;
    else a.jumpBuf = Math.max(0, a.jumpBuf - dt);
    if (a.jumpBuf > 0 && (a.grounded || a.coyote > 0 || a.jumpsLeft > 0)) {
      if (ZC.tryJump(a)) a.jumpBuf = 0;
    }
    if (reloading) ZC.startReload(a);
    if (a.gun.cooldown > 0) a.gun.cooldown -= dt;
    if (a.gun.reloading > 0) {
      a.gun.reloading -= dt;
      if (a.gun.reloading <= 0) ZC.finishReload(a);
    }
    if (firing) ZC.fireWeapon(a);
    if (a.flash > 0) a.flash -= dt;
    if (a.hurt > 0) a.hurt -= dt;
    if (a.invuln > 0) a.invuln -= dt;
  }
})(typeof window !== "undefined" ? window : globalThis);
