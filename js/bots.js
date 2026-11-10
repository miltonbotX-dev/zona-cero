/* ============================================================================
   Zona Cero — inteligencia local
   Contrato: thinkBot y ayudantes de visión/cobertura. Los bots se pelean entre sí y huyen de la zona. Ajusta inaccuracy/aggress en makeActor o aquí.
   Depende de: js/zc.js, js/maps.js, js/physics.js, js/zone.js, js/combat.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/bots.js");

ZC.hasLineOfSight = function (ax, ay, bx, by) {
    for (let i = 0; i < ZC.map.crates.length; i++) {
      const c = ZC.map.crates[i];
      if (ZC.util.segmentHitsAABB(ax, ay, bx, by, c.x, c.y, c.w, c.h)) return false;
    }
    for (let i = 0; i < ZC.map.platforms.length; i++) {
      const p = ZC.map.platforms[i];
      if (ZC.util.segmentHitsAABB(ax, ay, bx, by, p.x, p.y, p.w, p.h)) return false;
    }
    return true;
  }

  ZC.nearestEnemy = function (self) {
    let best = null, bestD = 1e12;
    for (let i = 0; i < ZC.actors.length; i++) {
      const o = ZC.actors[i];
      if (o === self || o.dead) continue;
      const d = ZC.util.dist2(self.x, self.y, o.x, o.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  ZC.nearestLoot = function (self, type) {
    let best = null, bestD = 1e12;
    for (let i = 0; i < ZC.loots.length; i++) {
      const L = ZC.loots[i];
      if (type && L.type !== type) continue;
      const d = ZC.util.dist2(self.x, self.y, L.x, L.y);
      if (d < bestD) { bestD = d; best = L; }
    }
    return best;
  }

  ZC.thinkBot = function (a, dt) {
    const ai = a.ai;
    if (!ai) return;
    ai.think -= dt;
    ai.nextJump = Math.max(0, ai.nextJump - dt);
    const outside = !ZC.inZone(a.x, a.y - 16);
    const soonOut = ZC.zone.shrinking && ZC.util.dist2(a.x, a.y - 16, ZC.zone.tx, ZC.zone.ty) > (ZC.zone.tr - 30) * (ZC.zone.tr - 30);
    let moveX = 0, jumping = false, firing = false, reloading = false;

    // Prioridad 1: sobrevivir a la zona
    if (outside || soonOut) {
      const tx = ZC.zone.shrinking ? ZC.zone.tx : ZC.zone.cx;
      const ty = ZC.zone.shrinking ? ZC.zone.ty : ZC.zone.cy;
      moveX = tx > a.x + 8 ? 1 : tx < a.x - 8 ? -1 : 0;
      if (ty < a.y - 50 && ai.nextJump <= 0) { jumping = true; ai.nextJump = 0.35; }
      // Dispara si alguien está delante mientras huye
      const foe = ZC.nearestEnemy(a);
      if (foe && ZC.util.dist2(a.x, a.y, foe.x, foe.y) < 280 * 280) {
        ZC.aimAt(a, foe.x, foe.y - 18, ai.inaccuracy * 1.2);
        if (ZC.hasLineOfSight(a.x, a.y - 16, foe.x, foe.y - 18)) firing = Math.random() < 0.35;
      } else {
        a.aimX = moveX || a.facing; a.aimY = -0.15;
      }
      ZC.controlActor(a, dt, moveX, jumping, firing, false);
      ZC.collideWorld(a, dt);
      return;
    }

    if (ai.think <= 0) {
      ai.think = ZC.util.rand(0.12, 0.32);
      const foe = ZC.nearestEnemy(a);
      ai.target = foe;
      const clip = a.gun[a.gun.current];
      if (clip.mag === 0 && clip.reserve > 0) ai.state = "reload";
      else if (a.hp < 40 && ZC.nearestLoot(a, "health") && ZC.util.dist2(a.x, a.y, ZC.nearestLoot(a, "health").x, ZC.nearestLoot(a, "health").y) < 260 * 260) {
        ai.state = "loot"; ai.loot = ZC.nearestLoot(a, "health");
      } else if (foe && Math.sqrt(ZC.util.dist2(a.x, a.y, foe.x, foe.y)) < 620 * ai.aggress + 180) {
        ai.state = "fight";
      } else if (ZC.nearestLoot(a) && ZC.util.dist2(a.x, a.y, ZC.nearestLoot(a).x, ZC.nearestLoot(a).y) < 180 * 180) {
        ai.state = "loot"; ai.loot = ZC.nearestLoot(a);
      } else {
        ai.state = "wander";
        if (Math.random() < 0.4) ai.wanderDir = Math.random() < 0.5 ? -1 : 1;
        if (!ai.wanderDir) ai.wanderDir = a.facing;
      }
      // Elige arma según distancia
      if (foe) {
        const d = Math.hypot(foe.x - a.x, foe.y - a.y);
        if (d < 240 && a.gun.shotgun.mag + a.gun.shotgun.reserve > 0) a.gun.current = "shotgun";
        else a.gun.current = "rifle";
      }
    }

    if (ai.state === "reload") {
      reloading = true;
      moveX = 0;
      const c = ZC.nearestCover(a);
      if (c) moveX = c.x + c.w / 2 > a.x ? 0.6 : -0.6;
    } else if (ai.state === "loot" && ai.loot) {
      moveX = ai.loot.x > a.x + 6 ? 1 : ai.loot.x < a.x - 6 ? -1 : 0;
      if (ai.loot.y < a.y - 40 && ai.nextJump <= 0) { jumping = true; ai.nextJump = 0.4; }
    } else if (ai.state === "fight" && ai.target && !ai.target.dead) {
      const t = ai.target;
      const d = Math.hypot(t.x - a.x, t.y - a.y);
      ZC.aimAt(a, t.x, t.y - 18, ai.inaccuracy);
      const see = ZC.hasLineOfSight(a.x, a.y - 16, t.x, t.y - 18);
      if (see && d < (a.gun.current === "shotgun" ? 360 : 820)) {
        firing = true;
        // Strafe
        moveX = (Math.sin(ZC.match.elapsed * 2 + a.id) > 0 ? 1 : -1) * 0.7;
        if (d < 90) moveX = t.x > a.x ? -1 : 1;
        if (d > 360) moveX = t.x > a.x ? 0.85 : -0.85;
      } else {
        moveX = t.x > a.x + 10 ? 1 : t.x < a.x - 10 ? -1 : 0;
        if (!see && ai.nextJump <= 0 && Math.random() < 0.4) { jumping = true; ai.nextJump = 0.5; }
      }
      if (t.y < a.y - 55 && ai.nextJump <= 0) { jumping = true; ai.nextJump = 0.38; }
    } else {
      moveX = ai.wanderDir || a.facing;
      if (a.x < 80) ai.wanderDir = 1;
      if (a.x > ZC.CFG.worldW - 80) ai.wanderDir = -1;
      if (Math.random() < 0.01) jumping = true;
    }

    // Obstáculo delante: saltar la caja
    if (ZC.boxAhead(a, moveX) && ai.nextJump <= 0) { jumping = true; ai.nextJump = 0.4; }

    if (a.gun[a.gun.current].mag === 0) reloading = true;
    ZC.controlActor(a, dt, moveX, jumping, firing, reloading);
    ZC.collideWorld(a, dt);
  }

  ZC.aimAt = function (a, x, y, inaccuracy) {
    let dx = x - a.x, dy = y - (a.y - 16);
    const n = ZC.util.norm(dx, dy);
    const jitter = inaccuracy || 0;
    a.aimX = n.x + ZC.util.rand(-jitter, jitter);
    a.aimY = n.y + ZC.util.rand(-jitter, jitter);
    const n2 = ZC.util.norm(a.aimX, a.aimY);
    a.aimX = n2.x; a.aimY = n2.y;
    if (Math.abs(a.aimX) > 0.2) a.facing = a.aimX > 0 ? 1 : -1;
  }

  ZC.nearestCover = function (a) {
    let best = null, bestD = 80 * 80;
    for (let i = 0; i < ZC.map.crates.length; i++) {
      const c = ZC.map.crates[i];
      const d = ZC.util.dist2(a.x, a.y, c.x + c.w / 2, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  ZC.boxAhead = function (a, dir) {
    if (!dir) return false;
    const s = dir > 0 ? 1 : -1;
    const px = a.x + s * (a.w / 2 + 8);
    for (let i = 0; i < ZC.map.crates.length; i++) {
      const c = ZC.map.crates[i];
      if (px > c.x && px < c.x + c.w && a.y > c.y && a.y - a.h < c.y + c.h) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // SECCIÓN: CONTROLES PC Y TÁCTILES (Pointer Events multitouch)
})(typeof window !== "undefined" ? window : globalThis);
