/* ============================================================================
   Zona Cero — dibujo y HUD
   Contrato: Cámara, escenario, proyectiles, zona y HUD de canvas. La forma del personaje la dibuja js/appearance.js.
   Depende de: js/zc.js, js/maps.js, js/weapons.js, js/zone.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/render.js");

  ZC.updateCamera = function (dt) {
    if (!ZC.player) return;
    const look = 90;
    const tx = ZC.player.x - ZC.viewW * 0.5 + ZC.player.aimX * look;
    const ty = ZC.player.y - ZC.viewH * 0.62 + ZC.player.aimY * 40;
    const k = 1 - Math.pow(0.0016, dt * ZC.CFG.camLerp * 0.15);
    ZC.cam.x = ZC.util.lerp(ZC.cam.x, tx, ZC.util.clamp(k, 0, 1));
    ZC.cam.y = ZC.util.lerp(ZC.cam.y, ty, ZC.util.clamp(k, 0, 1));
    ZC.cam.x = ZC.util.clamp(ZC.cam.x, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
    ZC.cam.y = ZC.util.clamp(ZC.cam.y, 0, Math.max(0, ZC.CFG.worldH - ZC.viewH));
    if (ZC.cam.shake > 0) {
      ZC.cam.x += ZC.util.rand(-ZC.cam.shake, ZC.cam.shake);
      ZC.cam.y += ZC.util.rand(-ZC.cam.shake, ZC.cam.shake);
    }
  }

  ZC.resize = function () {
    if (!ZC.canvas) return;
    const parent = ZC.canvas.parentElement || document.body;
    const w = parent.clientWidth || global.innerWidth || 1280;
    const h = parent.clientHeight || global.innerHeight || 720;
    ZC.dpr = Math.min(global.devicePixelRatio || 1, 2);
    ZC.viewW = Math.max(640, w);
    ZC.viewH = Math.max(360, h);
    ZC.canvas.width = Math.floor(ZC.viewW * ZC.dpr);
    ZC.canvas.height = Math.floor(ZC.viewH * ZC.dpr);
    ZC.canvas.style.width = w + "px";
    ZC.canvas.style.height = h + "px";
    if (ZC.ctx && ZC.ctx.setTransform) ZC.ctx.setTransform(ZC.dpr, 0, 0, ZC.dpr, 0, 0);
  }

  ZC.draw = function () {
    if (!ZC.ctx) return;
    ZC.ctx.setTransform(ZC.dpr, 0, 0, ZC.dpr, 0, 0);
    ZC.ctx.clearRect(0, 0, ZC.viewW, ZC.viewH);
    ZC.ctx.save();
    ZC.ctx.translate(-ZC.cam.x, -ZC.cam.y);
    ZC.drawBackdrop();
    ZC.drawZoneInsideHint();
    ZC.drawWorld();
    ZC.drawLoot();
    ZC.drawActors();
    ZC.drawBullets();
    ZC.drawParticles();
    ZC.drawZoneOverlay();
    ZC.drawFloats();
    ZC.ctx.restore();
    ZC.drawHUD();
  }

  ZC.drawBackdrop = function () {
    // Cielo nocturno en degradado
    const g = ZC.ctx.createLinearGradient(0, 0, 0, ZC.CFG.worldH);
    g.addColorStop(0, "#0b1224");
    g.addColorStop(0.45, "#121a30");
    g.addColorStop(0.78, "#1a2236");
    g.addColorStop(1, "#0d121c");
    ZC.ctx.fillStyle = g;
    ZC.ctx.fillRect(ZC.cam.x - 20, ZC.cam.y - 20, ZC.viewW + 40, ZC.viewH + 40);

    // Luna
    ZC.ctx.fillStyle = "#d9e7ff";
    ZC.ctx.shadowColor = "rgba(180,210,255,0.55)";
    ZC.ctx.shadowBlur = 30;
    ZC.ctx.beginPath(); ZC.ctx.arc(2100, 120, 38, 0, Math.PI * 2); ZC.ctx.fill();
    ZC.ctx.shadowBlur = 0;
    ZC.ctx.fillStyle = "#0b1224";
    ZC.ctx.beginPath(); ZC.ctx.arc(2116, 110, 30, 0, Math.PI * 2); ZC.ctx.fill();

    ZC.stars.forEach(function (s) {
      ZC.ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(ZC.match.elapsed * 2 + s.x));
      ZC.ctx.fillStyle = "#dce7ff";
      ZC.ctx.fillRect(s.x, s.y, s.s, s.s);
    });
    ZC.ctx.globalAlpha = 1;

    // Siluetas de planta industrial
    ZC.map.silos.forEach(function (s) {
      ZC.ctx.fillStyle = "#0a101c";
      ZC.ctx.fillRect(s.x, ZC.CFG.groundY - s.h, s.w, s.h);
      ZC.ctx.fillRect(s.x + s.w * 0.35, ZC.CFG.groundY - s.h - 50, 16, 50);
      ZC.ctx.fillStyle = "#151c2c";
      ZC.ctx.fillRect(s.x + 4, ZC.CFG.groundY - s.h + 4, s.w - 8, 8);
    });
    ZC.windows.forEach(function (w) {
      const on = w.on && ((ZC.match.elapsed + w.flicker) % 7 > 0.25);
      ZC.ctx.fillStyle = on ? "rgba(255, 196, 90, 0.72)" : "rgba(30, 40, 58, 0.8)";
      ZC.ctx.fillRect(w.x, w.y, 10, 12);
    });

    // Niebla baja
    const fog = ZC.ctx.createLinearGradient(0, ZC.CFG.groundY - 160, 0, ZC.CFG.worldH);
    fog.addColorStop(0, "rgba(20,30,50,0)");
    fog.addColorStop(1, "rgba(10,14,24,0.55)");
    ZC.ctx.fillStyle = fog;
    ZC.ctx.fillRect(0, ZC.CFG.groundY - 160, ZC.CFG.worldW, ZC.CFG.worldH - (ZC.CFG.groundY - 160));
  }

  ZC.drawWorld = function () {
    // Suelo
    ZC.ctx.fillStyle = "#1b2230";
    ZC.ctx.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, ZC.CFG.worldH - ZC.CFG.groundY);
    ZC.ctx.fillStyle = "#2a3344";
    ZC.ctx.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, 8);
    ZC.ctx.fillStyle = "#3d2a14";
    ZC.ctx.fillRect(0, ZC.CFG.groundY + 8, ZC.CFG.worldW, 10);
    // Rejilla de metal en el piso
    ZC.ctx.strokeStyle = "rgba(80,100,130,0.18)";
    ZC.ctx.lineWidth = 1;
    for (let x = 0; x < ZC.CFG.worldW; x += 40) {
      ZC.ctx.beginPath(); ZC.ctx.moveTo(x, ZC.CFG.groundY); ZC.ctx.lineTo(x, ZC.CFG.worldH); ZC.ctx.stroke();
    }

    // Plataformas de acero con cinta de peligro
    ZC.map.platforms.forEach(function (p) {
      ZC.ctx.fillStyle = "#2c3548";
      ZC.ctx.fillRect(p.x, p.y, p.w, p.h);
      ZC.ctx.fillStyle = "#3d4a62";
      ZC.ctx.fillRect(p.x, p.y, p.w, 5);
      for (let x = p.x; x < p.x + p.w; x += 16) {
        ZC.ctx.fillStyle = ((x - p.x) / 16) % 2 < 1 ? "#f0c14b" : "#16181e";
        ZC.ctx.fillRect(x, p.y + p.h - 5, 16, 5);
      }
      ZC.ctx.fillStyle = "rgba(92,228,255,0.12)";
      ZC.ctx.fillRect(p.x, p.y - 2, p.w, 2);
    });

    // Cajas de madera (cobertura)
    ZC.map.crates.forEach(function (c) {
      ZC.ctx.fillStyle = "#8a5a2b";
      ZC.ctx.fillRect(c.x, c.y, c.w, c.h);
      ZC.ctx.fillStyle = "#a66d34";
      ZC.ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      ZC.ctx.strokeStyle = "#5a3816";
      ZC.ctx.lineWidth = 2;
      ZC.ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
      ZC.ctx.beginPath();
      ZC.ctx.moveTo(c.x + 6, c.y + 6); ZC.ctx.lineTo(c.x + c.w - 6, c.y + c.h - 6);
      ZC.ctx.moveTo(c.x + c.w - 6, c.y + 6); ZC.ctx.lineTo(c.x + 6, c.y + c.h - 6);
      ZC.ctx.stroke();
      ZC.ctx.fillStyle = "#c4a36a";
      ZC.ctx.fillRect(c.x + 4, c.y + 4, 6, 6);
      ZC.ctx.fillRect(c.x + c.w - 10, c.y + 4, 6, 6);
      ZC.ctx.fillRect(c.x + 4, c.y + c.h - 10, 6, 6);
      ZC.ctx.fillRect(c.x + c.w - 10, c.y + c.h - 10, 6, 6);
    });
  }

  ZC.drawLoot = function () {
    ZC.loots.forEach(function (L) {
      const bob = Math.sin(ZC.match.elapsed * 4 + L.x * 0.05) * 3;
      ZC.ctx.save();
      ZC.ctx.translate(L.x, L.y + bob);
      if (L.type === "health") {
        ZC.ctx.fillStyle = "#14914d"; ZC.ctx.fillRect(-10, -10, 20, 20);
        ZC.ctx.fillStyle = "#7dffb0"; ZC.ctx.fillRect(-3, -8, 6, 16); ZC.ctx.fillRect(-8, -3, 16, 6);
      } else if (L.type === "ammo") {
        ZC.ctx.fillStyle = "#d7a33a"; ZC.ctx.fillRect(-11, -8, 22, 16);
        ZC.ctx.fillStyle = "#5a3d10"; ZC.ctx.fillRect(-8, -5, 5, 10); ZC.ctx.fillRect(3, -5, 5, 10);
      } else {
        ZC.ctx.fillStyle = "#3d6d88"; ZC.ctx.fillRect(-12, -7, 24, 14);
        ZC.ctx.fillStyle = "#9be7ff"; ZC.ctx.fillRect(4, -4, 10, 4);
      }
      ZC.ctx.restore();
    });
  }

  ZC.drawActors = function () {
    ZC.actors.forEach(function (a) {
      if (a.dead) {
        // Silueta caída breve no permanente: solo marca
        ZC.ctx.globalAlpha = 0.35;
        ZC.ctx.fillStyle = a.color;
        ZC.ctx.beginPath(); ZC.ctx.ellipse(a.x, a.y - 4, 16, 5, 0, 0, Math.PI * 2); ZC.ctx.fill();
        ZC.ctx.globalAlpha = 1;
        return;
      }
      ZC.ctx.save();
      ZC.ctx.translate(a.x, a.y);
      if (a.hurt > 0) { ZC.ctx.translate(ZC.util.rand(-2, 2), 0); }

      // Sombra
      ZC.ctx.fillStyle = "rgba(0,0,0,0.35)";
      ZC.ctx.beginPath(); ZC.ctx.ellipse(0, -2, 12, 4, 0, 0, Math.PI * 2); ZC.ctx.fill();

      if (ZC.Appearance) ZC.Appearance.draw(a);

      // Nombre y vida, por encima del casco
      ZC.ctx.font = "bold 11px Segoe UI, sans-serif";
      ZC.ctx.textAlign = "center";
      ZC.ctx.fillStyle = a.isPlayer ? "#7af0ff" : "#e8eef8";
      ZC.ctx.fillText(a.name, 0, -76);
      const bw = 28, ratio = ZC.util.clamp(a.hp / a.maxHp, 0, 1);
      ZC.ctx.fillStyle = "rgba(0,0,0,0.45)";
      ZC.ctx.fillRect(-bw / 2, -72, bw, 3);
      ZC.ctx.fillStyle = ratio > 0.4 ? "#3ee089" : "#ff5d7a";
      ZC.ctx.fillRect(-bw / 2, -72, bw * ratio, 3);

      ZC.ctx.restore();
    });
  }

  ZC.drawBullets = function () {
    ZC.bullets.forEach(function (b) {
      ZC.ctx.strokeStyle = b.color;
      ZC.ctx.lineWidth = 2.2;
      ZC.ctx.globalAlpha = 0.9;
      ZC.ctx.beginPath();
      ZC.ctx.moveTo(b.px, b.py);
      ZC.ctx.lineTo(b.x, b.y);
      ZC.ctx.stroke();
      ZC.ctx.fillStyle = "#fff";
      ZC.ctx.globalAlpha = 1;
      ZC.ctx.beginPath(); ZC.ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2); ZC.ctx.fill();
    });
  }

  ZC.drawParticles = function () {
    ZC.particles.forEach(function (p) {
      ZC.ctx.globalAlpha = ZC.util.clamp(p.life / p.max, 0, 1);
      ZC.ctx.fillStyle = p.color;
      ZC.ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ZC.ctx.globalAlpha = 1;
  }

  ZC.drawFloats = function () {
    ZC.ctx.font = "bold 13px Segoe UI, sans-serif";
    ZC.ctx.textAlign = "center";
    ZC.floating.forEach(function (f) {
      ZC.ctx.globalAlpha = ZC.util.clamp(f.life / 0.7, 0, 1);
      ZC.ctx.fillStyle = f.color;
      ZC.ctx.fillText(f.text, f.x, f.y);
    });
    ZC.ctx.globalAlpha = 1;
  }

  ZC.drawZoneInsideHint = function () {
    ZC.ctx.save();
    ZC.ctx.strokeStyle = "rgba(92,228,255,0.35)";
    ZC.ctx.lineWidth = 3;
    ZC.ctx.setLineDash([10, 8]);
    ZC.ctx.beginPath();
    ZC.ctx.arc(ZC.zone.cx, ZC.zone.cy, Math.max(8, ZC.zone.r), 0, Math.PI * 2);
    ZC.ctx.stroke();
    if (ZC.zone.shrinking) {
      ZC.ctx.strokeStyle = "rgba(255,176,32,0.4)";
      ZC.ctx.beginPath();
      ZC.ctx.arc(ZC.zone.tx, ZC.zone.ty, Math.max(8, ZC.zone.tr), 0, Math.PI * 2);
      ZC.ctx.stroke();
    }
    ZC.ctx.setLineDash([]);
    ZC.ctx.restore();
  }

  ZC.drawZoneOverlay = function () {
    // Oscurece fuera del círculo seguro con evenodd
    ZC.ctx.save();
    ZC.ctx.beginPath();
    ZC.ctx.rect(ZC.cam.x - 40, ZC.cam.y - 40, ZC.viewW + 80, ZC.viewH + 80);
    ZC.ctx.arc(ZC.zone.cx, ZC.zone.cy, Math.max(8, ZC.zone.r), 0, Math.PI * 2, true);
    ZC.ctx.fillStyle = "rgba(48, 12, 64, 0.42)";
    ZC.ctx.fill("evenodd");
    ZC.ctx.restore();
    // Borde brillante
    ZC.ctx.beginPath();
    ZC.ctx.arc(ZC.zone.cx, ZC.zone.cy, Math.max(8, ZC.zone.r), 0, Math.PI * 2);
    ZC.ctx.strokeStyle = "rgba(92,228,255,0.75)";
    ZC.ctx.lineWidth = 3;
    ZC.ctx.shadowColor = "#5ce4ff";
    ZC.ctx.shadowBlur = 12;
    ZC.ctx.stroke();
    ZC.ctx.shadowBlur = 0;
  }

  ZC.roundRect = function (c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------------------------------------------------------------------------
  // SECCIÓN: HUD (vida, munición, cronómetro, top 3, ZC.killfeed, minimapa)
  // ---------------------------------------------------------------------------
  ZC.drawHUD = function () {
    if (ZC.state === "title") {
      // Fondo vivo detrás del menú
      return;
    }
    const pad = 16;
    // Vida y arma (abajo-centro / izquierda)
    if (ZC.player) {
      const hx = pad, hy = ZC.viewH - 86;
      ZC.ctx.fillStyle = "rgba(8,14,26,0.72)";
      ZC.roundRect(ZC.ctx, hx, hy, 280, 70, 8); ZC.ctx.fill();
      ZC.ctx.strokeStyle = "rgba(92,228,255,0.25)"; ZC.ctx.lineWidth = 1;
      ZC.ctx.stroke();
      ZC.ctx.fillStyle = "#93a6bd";
      ZC.ctx.font = "11px Segoe UI, sans-serif";
      ZC.ctx.textAlign = "left";
      ZC.ctx.fillText(ZC.player.dead ? "ELIMINADO — espectando" : "VIDA", hx + 12, hy + 18);
      ZC.ctx.fillStyle = "#1a2230";
      ZC.ctx.fillRect(hx + 12, hy + 26, 256, 10);
      const hr = ZC.util.clamp(ZC.player.hp / ZC.player.maxHp, 0, 1);
      ZC.ctx.fillStyle = hr > 0.35 ? "#3ee089" : "#ff5d7a";
      ZC.ctx.fillRect(hx + 12, hy + 26, 256 * hr, 10);
      const w = ZC.WEAPONS[ZC.player.gun.current];
      const clip = ZC.player.gun[ZC.player.gun.current];
      ZC.ctx.fillStyle = w.color;
      ZC.ctx.font = "bold 16px Segoe UI, sans-serif";
      ZC.ctx.fillText(w.name, hx + 12, hy + 56);
      ZC.ctx.fillStyle = "#e8f4ff";
      ZC.ctx.fillText(clip.mag + " / " + clip.reserve, hx + 118, hy + 56);
      if (ZC.player.gun.reloading > 0) {
        ZC.ctx.fillStyle = "#ffb020";
        ZC.ctx.font = "12px Segoe UI, sans-serif";
        ZC.ctx.fillText("RECARGANDO", hx + 188, hy + 56);
      }
    }

    // Cronómetro y vivos
    const mm = Math.floor(ZC.match.elapsed / 60);
    const ss = Math.floor(ZC.match.elapsed % 60);
    const time = (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
    ZC.ctx.textAlign = "center";
    ZC.ctx.fillStyle = "rgba(8,14,26,0.7)";
    ZC.roundRect(ZC.ctx, ZC.viewW / 2 - 150, 12, 300, 52, 8); ZC.ctx.fill();
    ZC.ctx.fillStyle = "#5ce4ff";
    ZC.ctx.font = "bold 20px Segoe UI, sans-serif";
    ZC.ctx.fillText(time, ZC.viewW / 2 - 70, 36);
    ZC.ctx.fillStyle = "#e8f4ff";
    ZC.ctx.font = "bold 16px Segoe UI, sans-serif";
    ZC.ctx.fillText(ZC.match.alive + " vivos", ZC.viewW / 2 + 70, 36);
    ZC.ctx.fillStyle = ZC.zone.shrinking ? "#ffb020" : "#93a6bd";
    ZC.ctx.font = "11px Segoe UI, sans-serif";
    ZC.ctx.fillText(ZC.zoneLabel() + "  ·  DPS fuera " + Math.round(ZC.zone.dps), ZC.viewW / 2, 54);

    // Top 3
    const ranked = ZC.actors.slice().sort(function (a, b) {
      if (a.dead !== b.dead) return a.dead ? 1 : -1;
      return b.kills - a.kills;
    }).slice(0, 3);
    ZC.ctx.textAlign = "left";
    const tx = ZC.viewW - 210, ty = 12;
    ZC.ctx.fillStyle = "rgba(8,14,26,0.72)";
    ZC.roundRect(ZC.ctx, tx, ty, 198, 92, 8); ZC.ctx.fill();
    ZC.ctx.fillStyle = "#ffb020";
    ZC.ctx.font = "bold 11px Segoe UI, sans-serif";
    ZC.ctx.fillText("TOP 3", tx + 12, ty + 18);
    ranked.forEach(function (a, i) {
      ZC.ctx.fillStyle = a.dead ? "#66758a" : a.color;
      ZC.ctx.font = "13px Segoe UI, sans-serif";
      ZC.ctx.fillText((i + 1) + ". " + a.name + (a.dead ? " ✕" : ""), tx + 12, ty + 38 + i * 18);
      ZC.ctx.textAlign = "right";
      ZC.ctx.fillStyle = "#e8f4ff";
      ZC.ctx.fillText(String(a.kills), tx + 186, ty + 38 + i * 18);
      ZC.ctx.textAlign = "left";
    });

    // Killfeed
    ZC.ctx.textAlign = "left";
    ZC.killfeed.forEach(function (k, i) {
      ZC.ctx.globalAlpha = ZC.util.clamp(k.life / 1.2, 0, 1);
      ZC.ctx.fillStyle = "rgba(8,14,26,0.55)";
      ZC.ctx.fillRect(16, 80 + i * 22, Math.min(360, 20 + k.text.length * 7.2), 20);
      ZC.ctx.fillStyle = "#d5e6f5";
      ZC.ctx.font = "12px Segoe UI, sans-serif";
      ZC.ctx.fillText(k.text, 24, 94 + i * 22);
    });
    ZC.ctx.globalAlpha = 1;

    // Minimapa
    const mw = 176, mh = 64, mx = ZC.viewW - 210, my = 112;
    ZC.ctx.fillStyle = "rgba(8,14,26,0.7)";
    ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.fill();
    const sx = (mw - 12) / ZC.CFG.worldW, sy = (mh - 12) / ZC.CFG.worldH;
    ZC.ctx.save();
    ZC.ctx.beginPath(); ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.clip();
    ZC.ctx.fillStyle = "rgba(92,228,255,0.12)";
    ZC.ctx.beginPath();
    ZC.ctx.arc(mx + 6 + ZC.zone.cx * sx, my + 6 + ZC.zone.cy * sy, ZC.zone.r * sx, 0, Math.PI * 2);
    ZC.ctx.fill();
    ZC.actors.forEach(function (a) {
      if (a.dead) return;
      ZC.ctx.fillStyle = a.isPlayer ? "#7af0ff" : a.color;
      ZC.ctx.fillRect(mx + 6 + a.x * sx - 2, my + 6 + a.y * sy - 2, 4, 4);
    });
    ZC.ctx.restore();
    ZC.ctx.strokeStyle = "rgba(92,228,255,0.25)";
    ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.stroke();

    // Aviso fuera de zona
    if (ZC.player && !ZC.player.dead && !ZC.inZone(ZC.player.x, ZC.player.y - 16)) {
      ZC.ctx.textAlign = "center";
      ZC.ctx.fillStyle = "rgba(255,93,122,0.9)";
      ZC.ctx.font = "bold 22px Segoe UI, sans-serif";
      ZC.ctx.fillText("¡VUELVE A LA ZONA!", ZC.viewW / 2, ZC.viewH - 110);
    }

    if (ZC.state === "playing" && ZC.player && ZC.player.dead && !ZC.match.winner) {
      ZC.ctx.textAlign = "center";
      ZC.ctx.fillStyle = "rgba(255,255,255,0.8)";
      ZC.ctx.font = "16px Segoe UI, sans-serif";
      ZC.ctx.fillText("Espectando el cierre · puesto provisional #" + (ZC.match.playerPlace || ZC.match.alive + 1), ZC.viewW / 2, 92);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
