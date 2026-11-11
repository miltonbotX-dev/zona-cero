/* ============================================================================
   ZCero — combate
   Contrato: Disparo, recarga, proyectiles, daño, muerte (suelta loot) y recolección. Llama ZC.checkWinner / ZC.recountAlive definidos en game.js.
   Depende de: js/zc.js, js/weapons.js, js/entities.js, js/maps.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/combat.js");

ZC.fireWeapon = function (actor) {
    const w = ZC.WEAPONS[actor.gun.current];
    const clip = actor.gun[actor.gun.current];
    if (!w || actor.dead || actor.gun.cooldown > 0 || actor.gun.reloading > 0) return false;
    if (clip.mag <= 0) {
      if (clip.reserve > 0) ZC.startReload(actor);
      else if (actor === ZC.player) ZC.addFloat(actor.x, actor.y - 40, "SIN MUNICIÓN", "#d99a3a");
      return false;
    }
    clip.mag -= 1;
    actor.gun.cooldown = w.fireDelay;
    const muzzle = ZC.muzzlePoint(actor);
    const base = muzzle.ang;
    for (let i = 0; i < w.pellets; i++) {
      const ang = base + ZC.util.rand(-w.spread, w.spread);
      const b = ZC.spawnBullet(actor, muzzle.x, muzzle.y, Math.cos(ang), Math.sin(ang), w);
      // A quemarropa: el primer tramo para golpear actores empieza en el hombro,
      // para que un rival pegado al cañón no quede "detrás" de la bala.
      b.hx = muzzle.sx; b.hy = muzzle.sy;
    }
    ZC.burst(muzzle.x, muzzle.y, w.pellets === 1 ? 4 : 8, w.color, 180);
    actor.flash = 0.06;
    ZC.sfx("shoot", w.id);
    return true;
  }

  ZC.startReload = function (actor) {
    const id = actor.gun.current;
    const clip = actor.gun[id];
    const w = ZC.WEAPONS[id];
    if (actor.gun.reloading > 0 || clip.mag >= w.mag || clip.reserve <= 0) return false;
    actor.gun.reloading = w.reload;
    actor.gun.reloadOf = id;
    if (actor === ZC.player) ZC.sfx("reload");
    return true;
  }

  ZC.finishReload = function (actor) {
    const id = actor.gun.reloadOf || actor.gun.current;
    const clip = actor.gun[id];
    const w = ZC.WEAPONS[id];
    const need = w.mag - clip.mag;
    const take = Math.min(need, clip.reserve);
    clip.mag += take;
    clip.reserve -= take;
    actor.gun.reloading = 0;
    actor.gun.reloadOf = null;
  }

  ZC.spawnBullet = function (owner, x, y, dx, dy, w) {
    if (ZC.bullets.length >= ZC.CFG.bulletMax) ZC.bullets.shift();
    const n = ZC.util.norm(dx, dy);
    ZC.bullets.push({
      x: x, y: y, px: x, py: y,
      vx: n.x * w.speed, vy: n.y * w.speed,
      life: w.range / w.speed,
      dmg: w.damage, owner: owner, color: w.color,
      weapon: w.id, r: 3
    });
    return ZC.bullets[ZC.bullets.length - 1];
  }

  // Boca del arma en coordenadas del mundo. Antes era (x + 28, y - 10): la altura
  // de la cintura. Ahora usa ZC.gunRig (weapons.js), la misma geometría con la que
  // appearance.js dibuja el arma, así bala, fogonazo y estela salen del cañón.
  ZC.muzzlePoint = function (actor) {
    const rig = ZC.gunRig(actor);
    return {
      x: actor.x + rig.muzzleX, y: actor.y + rig.muzzleY, ang: rig.ang,
      sx: actor.x + rig.shoulderX, sy: actor.y + rig.shoulderY
    };
  }

  ZC.applyDamage = function (victim, amount, src, cause) {
    if (!victim || victim.dead || amount <= 0) return false;
    victim.hp -= amount;
    victim.hurt = 0.18;
    ZC.addFloat(victim.x, victim.y - victim.h - 8, "-" + Math.round(amount), src === ZC.player ? "#ffe08a" : "#ffd0d6");
    if (src === ZC.player && victim !== ZC.player) ZC.cam.shake = Math.max(ZC.cam.shake, 5);
    if (victim === ZC.player) ZC.cam.shake = Math.max(ZC.cam.shake, 9);
    if (victim.hp <= 0) {
      victim.hp = 0;
      ZC.killActor(victim, src, cause);
      return true;
    }
    return true;
  }

  ZC.killActor = function (victim, src, cause) {
    if (victim.dead) return;
    victim.dead = true;
    victim.hp = 0;
    victim.vx = 0; victim.vy = 0;
    ZC.burst(victim.x, victim.y - 16, 22, victim.color, 280);
    ZC.burst(victim.x, victim.y - 16, 10, "#ffe9c4", 200);
    ZC.sfx("die");
    // Al morir suelta munición / arma (inspirado en la referencia, sin respawn)
    ZC.spawnLoot(victim.x, victim.y - 12, "ammo");
    if (Math.random() < 0.55) ZC.spawnLoot(victim.x + 10, victim.y - 18, "weapon", victim.gun.current);
    if (Math.random() < 0.4) ZC.spawnLoot(victim.x - 12, victim.y - 10, "health");
    if (src && src !== victim && !src.dead) src.kills += 1;
    if (src === ZC.player && victim !== ZC.player) ZC.match.playerKills += 1;
    let line;
    if (cause === "zone") line = victim.name + " cayó en la zona";
    else if (src && src !== victim) line = src.name + " eliminó a " + victim.name;
    else line = victim.name + " fue eliminado";
    ZC.addFeed(line);
    ZC.recountAlive();
    if (victim.isPlayer) {
      ZC.match.playerPlace = ZC.match.alive + 1;
    }
    ZC.checkWinner();
  }

  ZC.pickLoot = function (actor, item) {
    if (item.type === "health") {
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + 38);
      if (actor === ZC.player) ZC.addFloat(actor.x, actor.y - 46, "+" + Math.round(actor.hp - before) + " HP", "#a8cf6e");
    } else if (item.type === "ammo") {
      actor.gun.rifle.reserve = Math.min(90, actor.gun.rifle.reserve + 18);
      actor.gun.shotgun.reserve = Math.min(36, actor.gun.shotgun.reserve + 6);
      if (actor === ZC.player) ZC.addFloat(actor.x, actor.y - 46, "+MUNICIÓN", "#e0c27a");
    } else if (item.type === "weapon") {
      const id = item.weapon === "shotgun" ? "shotgun" : "rifle";
      actor.gun[id].reserve = Math.min(id === "rifle" ? 90 : 36, actor.gun[id].reserve + ZC.WEAPONS[id].mag);
      if (actor === ZC.player) {
        actor.gun.current = id;
        ZC.addFloat(actor.x, actor.y - 46, ZC.WEAPONS[id].name, ZC.WEAPONS[id].color);
      } else if (Math.random() < 0.5) actor.gun.current = id;
    }
    if (actor === ZC.player) ZC.sfx("loot");
  }

  ZC.updateLoot = function (dt) {
    for (let i = ZC.loots.length - 1; i >= 0; i--) {
      const L = ZC.loots[i];
      L.life -= dt;
      if (L.life <= 0) { ZC.loots.splice(i, 1); continue; }
      if (!L.grounded) {
        L.vy += ZC.CFG.gravity * dt;
        L.y += L.vy * dt; L.x += L.vx * dt;
        if (L.y > ZC.CFG.groundY - 8) { L.y = ZC.CFG.groundY - 8; L.vy = 0; L.grounded = true; }
        ZC.map.platforms.forEach(function (p) {
          if (L.x > p.x && L.x < p.x + p.w && L.y > p.y - 10 && L.y < p.y + 12 && L.vy >= 0) {
            L.y = p.y - 8; L.vy = 0; L.grounded = true;
          }
        });
      }
      for (let a = 0; a < ZC.actors.length; a++) {
        const ac = ZC.actors[a];
        if (ac.dead) continue;
        if (Math.abs(ac.x - L.x) < 22 && Math.abs((ac.y - 16) - L.y) < 28) {
          ZC.pickLoot(ac, L);
          ZC.burst(L.x, L.y, 8, "#fff6c8", 120);
          ZC.loots.splice(i, 1);
          break;
        }
      }
    }
  }

  ZC.updateBullets = function (dt) {
    for (let i = ZC.bullets.length - 1; i >= 0; i--) {
      const b = ZC.bullets[i];
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      let hit = false;
      // Cajas y plataformas bloquean (cobertura táctica)
      for (let c = 0; c < ZC.map.crates.length && !hit; c++) {
        const r = ZC.map.crates[c];
        if (ZC.util.segmentHitsAABB(b.px, b.py, b.x, b.y, r.x, r.y, r.w, r.h)) {
          ZC.burst(b.x, b.y, 6, "#c4a574", 140);
          hit = true;
        }
      }
      for (let p = 0; p < ZC.map.platforms.length && !hit; p++) {
        const r = ZC.map.platforms[p];
        if (ZC.util.segmentHitsAABB(b.px, b.py, b.x, b.y, r.x, r.y, r.w, r.h)) {
          ZC.burst(b.x, b.y, 5, "#9aa8b8", 120);
          hit = true;
        }
      }
      if (!hit && (b.y > ZC.CFG.groundY || b.x < 0 || b.x > ZC.CFG.worldW || b.y < 0)) {
        hit = true;
        ZC.burst(b.x, ZC.util.clamp(b.y, 0, ZC.CFG.groundY), 4, "#889", 80);
      }
      if (!hit) {
        for (let a = 0; a < ZC.actors.length; a++) {
          const ac = ZC.actors[a];
          if (ac.dead || ac === b.owner) continue;
          // Caja de impacto = cuerpo dibujado (pies al casco), no solo la de colisión
          const hh = Math.max(ac.h, ZC.CFG.hurtH || ac.h);
          const rx = ac.x - ac.w / 2 - 2, ry = ac.y - hh - 2;
          const hx = b.hx != null ? b.hx : b.px, hy = b.hy != null ? b.hy : b.py;
          if (ZC.util.segmentHitsAABB(hx, hy, b.x, b.y, rx, ry, ac.w + 4, hh + 6)) {
            ZC.applyDamage(ac, b.dmg, b.owner, "shot");
            ZC.burst(b.x, b.y, 8, ac.color, 180);
            hit = true;
            break;
          }
        }
      }
      b.hx = null; b.hy = null;
      if (hit || b.life <= 0) ZC.bullets.splice(i, 1);
    }
  }

  ZC.updateParticles = function (dt) {
    for (let i = ZC.particles.length - 1; i >= 0; i--) {
      const p = ZC.particles[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += 80 * dt;
      if (p.life <= 0) ZC.particles.splice(i, 1);
    }
    for (let i = ZC.floating.length - 1; i >= 0; i--) {
      ZC.floating[i].life -= dt;
      ZC.floating[i].y -= 28 * dt;
      if (ZC.floating[i].life <= 0) ZC.floating.splice(i, 1);
    }
    for (let i = ZC.killfeed.length - 1; i >= 0; i--) {
      ZC.killfeed[i].life -= dt;
      if (ZC.killfeed[i].life <= 0) ZC.killfeed.splice(i, 1);
    }
    ZC.cam.shake = Math.max(0, ZC.cam.shake - dt * 18);
  }
})(typeof window !== "undefined" ? window : globalThis);
