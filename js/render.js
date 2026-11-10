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

  // Altura de los pies del jugador en pantalla (0 = arriba, 1 = abajo).
  // En celular horizontal (alto < 500) queda más arriba para que el HUD inferior
  // (joysticks y vida) no tape a quien está en el suelo. En la caída va más abajo
  // para que el paracaídas y la cuenta regresiva no se pisen.
  ZC.camFeetRatio = function () {
    if (ZC.Drop && ZC.Drop.active()) return 0.8;
    return ZC.viewH < 500 ? 0.58 : 0.64;
  };
  // Límite inferior de la cámara: puede bajar más allá del mundo para encuadrar
  // el suelo a la altura de camFeetRatio (lo de abajo se pinta como tierra).
  ZC.camMaxY = function () {
    return Math.max(0, ZC.CFG.worldH - ZC.viewH, ZC.CFG.groundY - ZC.viewH * (ZC.viewH < 500 ? 0.58 : 0.64));
  };

  ZC.updateCamera = function (dt) {
    if (!ZC.player) return;
    const look = ZC.viewW < 1000 ? 70 : 90;
    const tx = ZC.player.x - ZC.viewW * 0.5 + ZC.player.aimX * look;
    const ty = ZC.player.y - ZC.viewH * ZC.camFeetRatio() + ZC.player.aimY * (ZC.viewH < 500 ? 22 : 40);
    const k = 1 - Math.pow(0.0016, dt * ZC.CFG.camLerp * 0.15);
    ZC.cam.x = ZC.util.lerp(ZC.cam.x, tx, ZC.util.clamp(k, 0, 1));
    ZC.cam.y = ZC.util.lerp(ZC.cam.y, ty, ZC.util.clamp(k, 0, 1));
    ZC.cam.x = ZC.util.clamp(ZC.cam.x, 0, Math.max(0, ZC.CFG.worldW - ZC.viewW));
    ZC.cam.y = ZC.util.clamp(ZC.cam.y, 0, ZC.camMaxY());
    if (ZC.cam.shake > 0) {
      ZC.cam.x += ZC.util.rand(-ZC.cam.shake, ZC.cam.shake);
      ZC.cam.y += ZC.util.rand(-ZC.cam.shake, ZC.cam.shake);
    }
  }

  // Márgenes seguros del celular (muesca / bordes curvos). index.html tiene un
  // div #safe-probe con padding = env(safe-area-inset-*); aquí se lee en px.
  ZC.readSafeArea = function () {
    var out = { l: 0, r: 0, t: 0, b: 0 };
    try {
      var el = document.getElementById("safe-probe");
      if (!el || !global.getComputedStyle) return out;
      var cs = global.getComputedStyle(el);
      out.l = parseFloat(cs.paddingLeft) || 0;
      out.r = parseFloat(cs.paddingRight) || 0;
      out.t = parseFloat(cs.paddingTop) || 0;
      out.b = parseFloat(cs.paddingBottom) || 0;
    } catch (e) {}
    return out;
  };

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
    ZC.safe = ZC.readSafeArea();
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
    if (ZC.drawDropWorld) ZC.drawDropWorld();
    ZC.drawActors();
    ZC.drawBullets();
    ZC.drawParticles();
    ZC.drawZoneOverlay();
    ZC.drawFloats();
    ZC.ctx.restore();
    ZC.drawHUD();
    if (ZC.drawDropHUD) ZC.drawDropHUD();
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
    // La cámara puede bajar más que el mundo (ver camMaxY): rellena hasta el borde de la vista
    const bottom = Math.max(ZC.CFG.worldH, ZC.cam.y + ZC.viewH + 40);
    c.fillStyle = P.ground;
    c.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, bottom - ZC.CFG.groundY);
    c.fillStyle = P.groundTop;
    c.fillRect(0, ZC.CFG.groundY, ZC.CFG.worldW, 4);
    c.fillStyle = P.groundBand;
    c.fillRect(0, ZC.CFG.groundY + 4, ZC.CFG.worldW, 10);
    c.strokeStyle = P.groundLine;
    c.lineWidth = 1;
    for (let x = 0; x < ZC.CFG.worldW; x += 64) {
      c.beginPath(); c.moveTo(x, ZC.CFG.groundY + 14); c.lineTo(x + 18, bottom); c.stroke();
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
  // Dónde va cada panel del HUD en pantalla (px CSS). Un solo lugar para el diseño:
  // drawHUD dibuja con estos rectángulos y las pruebas los comparan con los botones táctiles.
  //  - Arriba izquierda: silencio y pantalla completa (botones DOM) y debajo el registro de bajas.
  //  - Arriba centro: tiempo, vivos y estado de la zona.
  //  - Arriba derecha: minimapa y, debajo, TOP 3 (como PUBG Mobile).
  //  - Abajo centro: vida, arma y munición, entre los dos joysticks.
  ZC.hudLayout = function () {
    const W = ZC.viewW, H = ZC.viewH;
    const compact = H < 500;
    const safe = ZC.safe || { l: 0, r: 0, t: 0, b: 0 };
    const L = Math.max(compact ? 10 : 16, safe.l + 6);
    const R = Math.max(compact ? 10 : 16, safe.r + 6);
    const T = compact ? 8 : 12;
    const timer = { x: 0, y: T, w: compact ? 224 : 300, h: compact ? 40 : 52 };
    timer.x = Math.round(W / 2 - timer.w / 2);
    const mapW = compact ? 172 : 210;
    const minimap = { x: W - R - mapW, y: T, w: mapW, h: compact ? 58 : 72 };
    const top3 = { x: minimap.x, y: minimap.y + minimap.h + 6, w: mapW, h: compact ? 68 : 88 };
    // Vida: centrada entre el joystick izquierdo y el grupo de botones de la derecha
    const leftEdge = L + (compact ? 116 : 132) + 14;
    const rightEdge = W - R - (compact ? 266 : 310) - 10;
    let vw = compact ? 270 : 320;
    const vh = compact ? 50 : 62;
    let vx = Math.round(W / 2 - vw / 2);
    if (vx + vw > rightEdge) vx = Math.max(leftEdge, rightEdge - vw);
    if (vx < leftEdge) vx = leftEdge;
    if (vx + vw > rightEdge) vw = Math.max(180, rightEdge - vx);
    const vitals = { x: vx, y: H - vh - (compact ? 8 : 14) - safe.b, w: vw, h: vh };
    const feed = { x: L, y: T + (compact ? 44 : 56), w: Math.max(140, timer.x - 10 - L), row: compact ? 18 : 22, rows: compact ? 4 : 6 };
    return {
      compact: compact, timer: timer, minimap: minimap, top3: top3, vitals: vitals, feed: feed,
      warnY: timer.y + timer.h + (compact ? 22 : 30)
    };
  };

  ZC.drawHUD = function () {
    if (ZC.state === "title") {
      // Fondo vivo detrás del menú
      return;
    }
    const c = ZC.ctx;
    const Lay = ZC.hudLayout();
    const cp = Lay.compact;
    ZC.hudRects = Lay;

    // Vida, arma y munición (abajo centro). Durante la caída se oculta: abajo va la pista.
    if (ZC.player && !(ZC.Drop && ZC.Drop.active())) {
      const v = Lay.vitals;
      c.fillStyle = "rgba(22,18,12,0.78)";
      ZC.roundRect(c, v.x, v.y, v.w, v.h, 8); c.fill();
      c.strokeStyle = "rgba(214,190,140,0.28)"; c.lineWidth = 1;
      c.stroke();
      const pad = 10;
      const hr = ZC.util.clamp(ZC.player.hp / ZC.player.maxHp, 0, 1);
      // Barra de vida con número
      const bx = v.x + pad, by = v.y + (cp ? 8 : 10), bwid = v.w - pad * 2, bh = cp ? 12 : 14;
      c.fillStyle = "#2b251c";
      c.fillRect(bx, by, bwid, bh);
      c.fillStyle = hr > 0.35 ? "#8fb35a" : "#c8553d";
      c.fillRect(bx, by, bwid * hr, bh);
      c.fillStyle = "#17130e";
      c.font = "bold " + (cp ? 10 : 11) + "px Segoe UI, sans-serif";
      c.textAlign = "left";
      c.fillText(ZC.player.dead ? "ELIMINADO" : "VIDA", bx + 5, by + bh - 2);
      c.textAlign = "right";
      c.fillStyle = "#efe6d2";
      c.fillText(ZC.player.dead ? "espectando" : String(Math.ceil(ZC.player.hp)), bx + bwid - 4, by + bh - 2);
      // Arma y munición
      const w = ZC.WEAPONS[ZC.player.gun.current];
      const clip = ZC.player.gun[ZC.player.gun.current];
      const ly = v.y + v.h - (cp ? 9 : 12);
      c.textAlign = "left";
      c.fillStyle = w.color;
      c.font = "bold " + (cp ? 14 : 16) + "px Segoe UI, sans-serif";
      c.fillText(w.name.toUpperCase(), bx, ly);
      c.textAlign = "right";
      if (ZC.player.gun.reloading > 0) {
        c.fillStyle = "#d99a3a";
        c.font = "bold " + (cp ? 12 : 13) + "px Segoe UI, sans-serif";
        c.fillText("RECARGANDO", bx + bwid, ly);
      } else {
        c.fillStyle = clip.mag === 0 ? "#c8553d" : "#efe6d2";
        c.font = "bold " + (cp ? 18 : 20) + "px Segoe UI, sans-serif";
        const magTxt = String(clip.mag);
        c.fillText(magTxt, bx + bwid - (cp ? 34 : 40), ly);
        c.fillStyle = "#b3a68a";
        c.font = (cp ? 13 : 14) + "px Segoe UI, sans-serif";
        c.fillText("/ " + clip.reserve, bx + bwid, ly);
      }
    }

    // Cronómetro y vivos (arriba centro)
    const t = Lay.timer;
    const mm = Math.floor(ZC.match.elapsed / 60);
    const ss = Math.floor(ZC.match.elapsed % 60);
    const time = (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
    c.textAlign = "center";
    c.fillStyle = "rgba(22,18,12,0.72)";
    ZC.roundRect(c, t.x, t.y, t.w, t.h, 8); c.fill();
    c.fillStyle = "#e0b25c";
    c.font = "bold " + (cp ? 17 : 20) + "px Segoe UI, sans-serif";
    c.fillText(time, t.x + t.w * 0.27, t.y + (cp ? 21 : 24));
    c.fillStyle = "#efe6d2";
    c.font = "bold " + (cp ? 14 : 16) + "px Segoe UI, sans-serif";
    c.fillText(ZC.match.alive + " vivos", t.x + t.w * 0.73, t.y + (cp ? 21 : 24));
    c.fillStyle = ZC.zone.shrinking ? "#d99a3a" : "#b3a68a";
    c.font = (cp ? 10 : 11) + "px Segoe UI, sans-serif";
    const zl = (ZC.Drop && ZC.Drop.active()) ? "DESPLIEGUE" : ZC.zoneLabel();
    c.fillText(zl + "  ·  DPS fuera " + Math.round(ZC.zone.dps), t.x + t.w / 2, t.y + t.h - (cp ? 7 : 9));

    // Minimapa (arriba derecha)
    const m = Lay.minimap;
    c.fillStyle = "rgba(22,18,12,0.72)";
    ZC.roundRect(c, m.x, m.y, m.w, m.h, 6); c.fill();
    const sx = (m.w - 12) / ZC.CFG.worldW, sy = (m.h - 12) / ZC.CFG.worldH;
    c.save();
    c.beginPath(); ZC.roundRect(c, m.x, m.y, m.w, m.h, 6); c.clip();
    c.fillStyle = "rgba(224,178,92,0.16)";
    c.beginPath();
    c.arc(m.x + 6 + ZC.zone.cx * sx, m.y + 6 + ZC.zone.cy * sy, ZC.zone.r * sx, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(214,190,140,0.18)";
    c.fillRect(m.x + 6, m.y + 6 + ZC.CFG.groundY * sy, m.w - 12, 1);
    ZC.actors.forEach(function (a) {
      if (a.dead) return;
      c.fillStyle = a.isPlayer ? "#f0d79a" : a.color;
      const s2 = a.isPlayer ? 5 : 4;
      c.fillRect(m.x + 6 + a.x * sx - s2 / 2, m.y + 6 + a.y * sy - s2 / 2, s2, s2);
    });
    c.restore();
    c.strokeStyle = "rgba(214,190,140,0.28)";
    c.lineWidth = 1;
    ZC.roundRect(c, m.x, m.y, m.w, m.h, 6); c.stroke();

    // TOP 3 (debajo del minimapa)
    const ranked = ZC.actors.slice().sort(function (a, b) {
      if (a.dead !== b.dead) return a.dead ? 1 : -1;
      return b.kills - a.kills;
    }).slice(0, 3);
    const tp = Lay.top3;
    const row = cp ? 16 : 20;
    c.textAlign = "left";
    c.fillStyle = "rgba(22,18,12,0.74)";
    ZC.roundRect(c, tp.x, tp.y, tp.w, tp.h, 8); c.fill();
    c.fillStyle = "#d99a3a";
    c.font = "bold " + (cp ? 10 : 11) + "px Segoe UI, sans-serif";
    c.fillText("TOP 3", tp.x + 10, tp.y + (cp ? 14 : 17));
    c.textAlign = "right";
    c.fillStyle = "#8a7e66";
    c.fillText("BAJAS", tp.x + tp.w - 10, tp.y + (cp ? 14 : 17));
    ranked.forEach(function (a, i) {
      const yy = tp.y + (cp ? 31 : 38) + i * row;
      c.textAlign = "left";
      c.fillStyle = a.dead ? "#7a705e" : a.color;
      if (a.isPlayer && !a.dead) c.fillStyle = "#f0d79a";
      c.font = (cp ? 12 : 13) + "px Segoe UI, sans-serif";
      c.fillText((i + 1) + ". " + a.name + (a.dead ? " (caído)" : ""), tp.x + 10, yy);
      c.textAlign = "right";
      c.fillStyle = "#efe6d2";
      c.fillText(String(a.kills), tp.x + tp.w - 10, yy);
    });

    // Registro de bajas (arriba izquierda, bajo los botones)
    const f = Lay.feed;
    c.textAlign = "left";
    ZC.killfeed.slice(0, f.rows).forEach(function (k, i) {
      c.globalAlpha = ZC.util.clamp(k.life / 1.2, 0, 1);
      c.font = (cp ? 11 : 12) + "px Segoe UI, sans-serif";
      const tw = c.measureText ? c.measureText(k.text).width : k.text.length * 6.5;
      const bw = Math.min(f.w, tw + 16);
      c.fillStyle = "rgba(22,18,12,0.58)";
      c.fillRect(f.x, f.y + i * f.row, bw, f.row - 2);
      c.save();
      c.beginPath(); c.rect(f.x, f.y + i * f.row, bw, f.row - 2); c.clip();
      c.fillStyle = "#e6dcc6";
      c.fillText(k.text, f.x + 8, f.y + i * f.row + (cp ? 12 : 14));
      c.restore();
    });
    c.globalAlpha = 1;

    // Aviso fuera de zona (bajo el cronómetro, sin tapar el suelo)
    if (ZC.player && !ZC.player.dead && !ZC.inZone(ZC.player.x, ZC.player.y - 16)) {
      c.textAlign = "center";
      c.fillStyle = "rgba(214,96,64,0.95)";
      c.font = "bold " + (cp ? 17 : 22) + "px Segoe UI, sans-serif";
      c.fillText("VUELVE A LA ZONA", ZC.viewW / 2, Lay.warnY);
    }

    if (ZC.state === "playing" && ZC.player && ZC.player.dead && !ZC.match.winner) {
      c.textAlign = "center";
      c.fillStyle = "rgba(239,230,210,0.85)";
      c.font = (cp ? 13 : 16) + "px Segoe UI, sans-serif";
      c.fillText("Espectando el cierre · puesto provisional #" + (ZC.match.playerPlace || ZC.match.alive + 1), ZC.viewW / 2, Lay.warnY + (cp ? 20 : 26));
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
