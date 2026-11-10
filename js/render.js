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

  // Paleta del escenario (tierra / militar). Cambia aquí el tono general del mundo.
  ZC.PALETTE = {
    ground: "#2a231a", groundTop: "#5b4b36", groundBand: "#3b3024", groundLine: "rgba(214,190,140,0.07)",
    steel: "#3f3d33", steelTop: "#6e6752", steelShade: "rgba(0,0,0,0.28)", stripeA: "#a8843f", stripeB: "#2a261f",
    haze: "rgba(60,44,28,0.38)", shadeImage: "rgba(24,18,12,0.22)"
  };

  // Fondo con imagen por mapa (js/maps.js → backgroundImage). Se dibuja con parallax:
  // la imagen mide lo mismo de alto que el mundo y se desplaza más lento que la cámara,
  // así una imagen 16:9 cubre un mundo más ancho sin estirarse.
  ZC.backdropRect = function (img) {
    const W = ZC.CFG.worldW, H = ZC.CFG.worldH;
    const s = Math.max(H / img.naturalHeight, ZC.viewW / img.naturalWidth);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const span = Math.max(1, W - ZC.viewW);
    const t = ZC.util.clamp(ZC.cam.x / span, 0, 1);
    const x = ZC.cam.x - t * Math.max(0, dw - ZC.viewW);
    return { x: x, y: H - dh, w: dw, h: dh };
  };

  ZC.drawBackdrop = function () {
    const c = ZC.ctx, P = ZC.PALETTE;
    const fb = (ZC.map && ZC.map.bgFallback) || ["#5a4632", "#3a2e22", "#1f1a14"];
    // Respaldo color tierra mientras la imagen carga (o si falta)
    const g = c.createLinearGradient(0, 0, 0, ZC.CFG.worldH);
    g.addColorStop(0, fb[0]);
    g.addColorStop(0.7, fb[1]);
    g.addColorStop(1, fb[2]);
    c.fillStyle = g;
    c.fillRect(ZC.cam.x - 20, ZC.cam.y - 20, ZC.viewW + 40, ZC.viewH + 40);

    const img = ZC.Maps && ZC.Maps.imageFor ? ZC.Maps.imageFor(ZC.map) : null;
    if (img && c.drawImage) {
      const r = ZC.backdropRect(img);
      c.drawImage(img, r.x, r.y, r.w, r.h);
      // Leve sombra para que personajes y balas se lean encima de la imagen
      c.fillStyle = P.shadeImage;
      c.fillRect(ZC.cam.x - 20, ZC.cam.y - 20, ZC.viewW + 40, ZC.viewH + 40);
    } else {
      // Sin imagen: siluetas sobrias del mapa para dar profundidad
      ZC.map.silos.forEach(function (s) {
        c.fillStyle = "rgba(28,22,16,0.75)";
        c.fillRect(s.x, ZC.CFG.groundY - s.h, s.w, s.h);
        c.fillRect(s.x + s.w * 0.35, ZC.CFG.groundY - s.h - 50, 16, 50);
      });
    }

    // Polvo bajo, cálido, para asentar el suelo
    const fog = c.createLinearGradient(0, ZC.CFG.groundY - 140, 0, ZC.CFG.groundY);
    fog.addColorStop(0, "rgba(60,44,28,0)");
    fog.addColorStop(1, P.haze);
    c.fillStyle = fog;
    c.fillRect(ZC.cam.x - 20, ZC.CFG.groundY - 140, ZC.viewW + 40, 140);
  }

  ZC.drawWorld = function () {
    const c = ZC.ctx, P = ZC.PALETTE;
    // Suelo de tierra apisonada
    c.fillStyle = P.ground;
    c.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, ZC.CFG.worldH - ZC.CFG.groundY);
    c.fillStyle = P.groundTop;
    c.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, 4);
    c.fillStyle = P.groundBand;
    c.fillRect(0, ZC.CFG.groundY + 4, ZC.CFG.worldW, 10);
    c.strokeStyle = P.groundLine;
    c.lineWidth = 1;
    for (let x = 0; x < ZC.CFG.worldW; x += 64) {
      c.beginPath(); c.moveTo(x, ZC.CFG.groundY + 14); c.lineTo(x + 18, ZC.CFG.worldH); c.stroke();
    }

    // Pasarelas de acero gastado con franja de aviso apagada
    ZC.map.platforms.forEach(function (p) {
      c.fillStyle = P.steelShade;
      c.fillRect(p.x + 3, p.y + p.h, p.w - 6, 5);
      c.fillStyle = P.steel;
      c.fillRect(p.x, p.y, p.w, p.h);
      c.fillStyle = P.steelTop;
      c.fillRect(p.x, p.y, p.w, 4);
      for (let x = p.x; x < p.x + p.w; x += 16) {
        c.fillStyle = ((x - p.x) / 16) % 2 < 1 ? P.stripeA : P.stripeB;
        c.fillRect(x, p.y + p.h - 4, Math.min(16, p.x + p.w - x), 4);
      }
    });

    // Cajas de madera (cobertura)
    ZC.map.crates.forEach(function (cr) {
      c.fillStyle = "#6e4a2a";
      c.fillRect(cr.x, cr.y, cr.w, cr.h);
      c.fillStyle = "#8a6238";
      c.fillRect(cr.x + 3, cr.y + 3, cr.w - 6, cr.h - 6);
      c.strokeStyle = "#47301a";
      c.lineWidth = 2;
      c.strokeRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4);
      c.beginPath();
      c.moveTo(cr.x + 6, cr.y + 6); c.lineTo(cr.x + cr.w - 6, cr.y + cr.h - 6);
      c.moveTo(cr.x + cr.w - 6, cr.y + 6); c.lineTo(cr.x + 6, cr.y + cr.h - 6);
      c.stroke();
      c.fillStyle = "#a88f62";
      c.fillRect(cr.x + 4, cr.y + 4, 6, 6);
      c.fillRect(cr.x + cr.w - 10, cr.y + 4, 6, 6);
      c.fillRect(cr.x + 4, cr.y + cr.h - 10, 6, 6);
      c.fillRect(cr.x + cr.w - 10, cr.y + cr.h - 10, 6, 6);
    });
  }

  ZC.drawLoot = function () {
    ZC.loots.forEach(function (L) {
      const bob = Math.sin(ZC.match.elapsed * 4 + L.x * 0.05) * 3;
      ZC.ctx.save();
      ZC.ctx.translate(L.x, L.y + bob);
      if (L.type === "health") {
        ZC.ctx.fillStyle = "#4d6136"; ZC.ctx.fillRect(-10, -10, 20, 20);
        ZC.ctx.fillStyle = "#efe6cf"; ZC.ctx.fillRect(-3, -8, 6, 16); ZC.ctx.fillRect(-8, -3, 16, 6);
      } else if (L.type === "ammo") {
        ZC.ctx.fillStyle = "#b98a3a"; ZC.ctx.fillRect(-11, -8, 22, 16);
        ZC.ctx.fillStyle = "#5a3d10"; ZC.ctx.fillRect(-8, -5, 5, 10); ZC.ctx.fillRect(3, -5, 5, 10);
      } else {
        ZC.ctx.fillStyle = "#4f5440"; ZC.ctx.fillRect(-12, -7, 24, 14);
        ZC.ctx.fillStyle = "#d9c79a"; ZC.ctx.fillRect(4, -4, 10, 4);
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
      ZC.ctx.fillStyle = a.isPlayer ? "#f0d79a" : "#ece4d2";
      ZC.ctx.fillText(a.name, 0, -76);
      const bw = 28, ratio = ZC.util.clamp(a.hp / a.maxHp, 0, 1);
      ZC.ctx.fillStyle = "rgba(0,0,0,0.45)";
      ZC.ctx.fillRect(-bw / 2, -72, bw, 3);
      ZC.ctx.fillStyle = ratio > 0.4 ? "#8fb35a" : "#c8553d";
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
    ZC.ctx.strokeStyle = "rgba(232,206,150,0.35)";
    ZC.ctx.lineWidth = 3;
    ZC.ctx.setLineDash([10, 8]);
    ZC.ctx.beginPath();
    ZC.ctx.arc(ZC.zone.cx, ZC.zone.cy, Math.max(8, ZC.zone.r), 0, Math.PI * 2);
    ZC.ctx.stroke();
    if (ZC.zone.shrinking) {
      ZC.ctx.strokeStyle = "rgba(205,128,60,0.45)";
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
    ZC.ctx.fillStyle = "rgba(70, 30, 18, 0.40)";
    ZC.ctx.fill("evenodd");
    ZC.ctx.restore();
    // Borde de la zona (sin brillo)
    ZC.ctx.beginPath();
    ZC.ctx.arc(ZC.zone.cx, ZC.zone.cy, Math.max(8, ZC.zone.r), 0, Math.PI * 2);
    ZC.ctx.strokeStyle = "rgba(236,200,130,0.78)";
    ZC.ctx.lineWidth = 3;
    ZC.ctx.stroke();
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
      ZC.ctx.fillStyle = "rgba(22,18,12,0.74)";
      ZC.roundRect(ZC.ctx, hx, hy, 280, 70, 8); ZC.ctx.fill();
      ZC.ctx.strokeStyle = "rgba(214,190,140,0.28)"; ZC.ctx.lineWidth = 1;
      ZC.ctx.stroke();
      ZC.ctx.fillStyle = "#b3a68a";
      ZC.ctx.font = "11px Segoe UI, sans-serif";
      ZC.ctx.textAlign = "left";
      ZC.ctx.fillText(ZC.player.dead ? "ELIMINADO — espectando" : "VIDA", hx + 12, hy + 18);
      ZC.ctx.fillStyle = "#2b251c";
      ZC.ctx.fillRect(hx + 12, hy + 26, 256, 10);
      const hr = ZC.util.clamp(ZC.player.hp / ZC.player.maxHp, 0, 1);
      ZC.ctx.fillStyle = hr > 0.35 ? "#8fb35a" : "#c8553d";
      ZC.ctx.fillRect(hx + 12, hy + 26, 256 * hr, 10);
      const w = ZC.WEAPONS[ZC.player.gun.current];
      const clip = ZC.player.gun[ZC.player.gun.current];
      ZC.ctx.fillStyle = w.color;
      ZC.ctx.font = "bold 16px Segoe UI, sans-serif";
      ZC.ctx.fillText(w.name, hx + 12, hy + 56);
      ZC.ctx.fillStyle = "#efe6d2";
      ZC.ctx.fillText(clip.mag + " / " + clip.reserve, hx + 118, hy + 56);
      if (ZC.player.gun.reloading > 0) {
        ZC.ctx.fillStyle = "#d99a3a";
        ZC.ctx.font = "12px Segoe UI, sans-serif";
        ZC.ctx.fillText("RECARGANDO", hx + 188, hy + 56);
      }
    }

    // Cronómetro y vivos
    const mm = Math.floor(ZC.match.elapsed / 60);
    const ss = Math.floor(ZC.match.elapsed % 60);
    const time = (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
    ZC.ctx.textAlign = "center";
    ZC.ctx.fillStyle = "rgba(22,18,12,0.72)";
    ZC.roundRect(ZC.ctx, ZC.viewW / 2 - 150, 12, 300, 52, 8); ZC.ctx.fill();
    ZC.ctx.fillStyle = "#e0b25c";
    ZC.ctx.font = "bold 20px Segoe UI, sans-serif";
    ZC.ctx.fillText(time, ZC.viewW / 2 - 70, 36);
    ZC.ctx.fillStyle = "#efe6d2";
    ZC.ctx.font = "bold 16px Segoe UI, sans-serif";
    ZC.ctx.fillText(ZC.match.alive + " vivos", ZC.viewW / 2 + 70, 36);
    ZC.ctx.fillStyle = ZC.zone.shrinking ? "#d99a3a" : "#b3a68a";
    ZC.ctx.font = "11px Segoe UI, sans-serif";
    ZC.ctx.fillText(ZC.zoneLabel() + "  ·  DPS fuera " + Math.round(ZC.zone.dps), ZC.viewW / 2, 54);

    // Top 3
    const ranked = ZC.actors.slice().sort(function (a, b) {
      if (a.dead !== b.dead) return a.dead ? 1 : -1;
      return b.kills - a.kills;
    }).slice(0, 3);
    ZC.ctx.textAlign = "left";
    const tx = ZC.viewW - 210, ty = 12;
    ZC.ctx.fillStyle = "rgba(22,18,12,0.74)";
    ZC.roundRect(ZC.ctx, tx, ty, 198, 92, 8); ZC.ctx.fill();
    ZC.ctx.fillStyle = "#d99a3a";
    ZC.ctx.font = "bold 11px Segoe UI, sans-serif";
    ZC.ctx.fillText("TOP 3", tx + 12, ty + 18);
    ranked.forEach(function (a, i) {
      ZC.ctx.fillStyle = a.dead ? "#7a705e" : a.color;
      ZC.ctx.font = "13px Segoe UI, sans-serif";
      ZC.ctx.fillText((i + 1) + ". " + a.name + (a.dead ? " ✕" : ""), tx + 12, ty + 38 + i * 18);
      ZC.ctx.textAlign = "right";
      ZC.ctx.fillStyle = "#efe6d2";
      ZC.ctx.fillText(String(a.kills), tx + 186, ty + 38 + i * 18);
      ZC.ctx.textAlign = "left";
    });

    // Killfeed
    ZC.ctx.textAlign = "left";
    ZC.killfeed.forEach(function (k, i) {
      ZC.ctx.globalAlpha = ZC.util.clamp(k.life / 1.2, 0, 1);
      ZC.ctx.fillStyle = "rgba(22,18,12,0.58)";
      ZC.ctx.fillRect(16, 80 + i * 22, Math.min(360, 20 + k.text.length * 7.2), 20);
      ZC.ctx.fillStyle = "#e6dcc6";
      ZC.ctx.font = "12px Segoe UI, sans-serif";
      ZC.ctx.fillText(k.text, 24, 94 + i * 22);
    });
    ZC.ctx.globalAlpha = 1;

    // Minimapa
    const mw = 176, mh = 64, mx = ZC.viewW - 210, my = 112;
    ZC.ctx.fillStyle = "rgba(22,18,12,0.72)";
    ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.fill();
    const sx = (mw - 12) / ZC.CFG.worldW, sy = (mh - 12) / ZC.CFG.worldH;
    ZC.ctx.save();
    ZC.ctx.beginPath(); ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.clip();
    ZC.ctx.fillStyle = "rgba(224,178,92,0.16)";
    ZC.ctx.beginPath();
    ZC.ctx.arc(mx + 6 + ZC.zone.cx * sx, my + 6 + ZC.zone.cy * sy, ZC.zone.r * sx, 0, Math.PI * 2);
    ZC.ctx.fill();
    ZC.actors.forEach(function (a) {
      if (a.dead) return;
      ZC.ctx.fillStyle = a.isPlayer ? "#f0d79a" : a.color;
      ZC.ctx.fillRect(mx + 6 + a.x * sx - 2, my + 6 + a.y * sy - 2, 4, 4);
    });
    ZC.ctx.restore();
    ZC.ctx.strokeStyle = "rgba(214,190,140,0.28)";
    ZC.roundRect(ZC.ctx, mx, my, mw, mh, 6); ZC.ctx.stroke();

    // Aviso fuera de zona
    if (ZC.player && !ZC.player.dead && !ZC.inZone(ZC.player.x, ZC.player.y - 16)) {
      ZC.ctx.textAlign = "center";
      ZC.ctx.fillStyle = "rgba(214,96,64,0.95)";
      ZC.ctx.font = "bold 22px Segoe UI, sans-serif";
      ZC.ctx.fillText("¡VUELVE A LA ZONA!", ZC.viewW / 2, ZC.viewH - 110);
    }

    if (ZC.state === "playing" && ZC.player && ZC.player.dead && !ZC.match.winner) {
      ZC.ctx.textAlign = "center";
      ZC.ctx.fillStyle = "rgba(239,230,210,0.85)";
      ZC.ctx.font = "16px Segoe UI, sans-serif";
      ZC.ctx.fillText("Espectando el cierre · puesto provisional #" + (ZC.match.playerPlace || ZC.match.alive + 1), ZC.viewW / 2, 92);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
