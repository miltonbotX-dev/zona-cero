/* ============================================================================
   Zona Cero — apariencia del personaje
   Contrato: Dibuja la forma del combatiente (ZC.Appearance.draw) y registra los aspectos elegibles en el lobby. No decide daño, input ni HUD.
   Depende de: js/zc.js, js/weapons.js (en runtime, al dibujar)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   La forma vive solo aquí. Para cambiar casco, torso, piernas o un aspecto nuevo, edita este archivo.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/appearance.js");

  function limb(ctx, x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function botPalette(color) {
    var armor = (color && String(color).charAt(0) === "#") ? color : "#c45a4a";
    return {
      id: "bot",
      suit: "#2f3026",
      suitDark: "#1f2019",
      armor: armor,
      trim: "#d9cfb8",
      visor: "#c9a35a",
      pack: "#22231b",
      skin: "#c4a484",
      bulk: 1,
      helm: "helmet"
    };
  }

  ZC.Appearance = {
    looks: {},
    register: function (def) {
      def = def || {};
      if (!def.id) throw new Error("Un aspecto necesita id");
      this.looks[def.id] = def;
      return def;
    },
    get: function (id) {
      return this.looks[id] || this.looks.operativo || null;
    },
    list: function () {
      var self = this;
      return Object.keys(this.looks).map(function (id) { return self.looks[id]; });
    },
    paletteFor: function (actor) {
      if (actor && actor.isPlayer) {
        var id = actor.look || (ZC.profile && ZC.profile.look) || "operativo";
        var look = this.get(id);
        if (look) return look;
      }
      return botPalette(actor && actor.color);
    },
    /* Origen: pies del actor en (0, 0). Y negativo es arriba. El llamador ya trasladó el contexto. */
    draw: function (actor) {
      var ctx = ZC.ctx;
      if (!ctx || !actor) return;
      var pal = this.paletteFor(actor);
      var bulk = pal.bulk || 1;
      var air = !actor.grounded;
      var walking = !!(actor.grounded && Math.abs(actor.vx) > 20);
      var swing = walking ? Math.sin(actor.walkPhase || 0) : 0;
      var hurt = actor.hurt > 0;
      var suit = hurt ? "#f4f7ff" : pal.suit;
      var suitDark = hurt ? "#ffffff" : pal.suitDark;
      var gunId = (actor.gun && actor.gun.current) || "rifle";
      var weapon = (ZC.WEAPONS && ZC.WEAPONS[gunId]) || { color: "#cdbb8a", id: gunId };

      // Geometría compartida con combat.js (ZC.gunRig en weapons.js): el cuerpo se
      // voltea hacia donde apunta y el arma sale del hombro; la boca coincide con
      // el punto de donde salen las balas.
      var rig = ZC.gunRig ? ZC.gunRig(actor, bulk) : { face: 1, localAng: Math.atan2(actor.aimY || 0, actor.aimX || 1), barrel: 36 };

      ctx.save();
      if (rig.face < 0) ctx.scale(-1, 1);

      // Mochila, detrás del torso
      ctx.fillStyle = pal.pack;
      ctx.fillRect(-8 * bulk, -46, 8, 15);
      ctx.fillStyle = pal.trim;
      ctx.fillRect(-7.2 * bulk, -44, 2, 8);

      leg(ctx, -1, -swing, air, bulk, suit, suitDark, pal);
      torso(ctx, bulk, suit, suitDark, pal, hurt);
      leg(ctx, 1, swing, air, bulk, suit, suitDark, pal);
      shoulders(ctx, bulk, pal);
      offArm(ctx, bulk, swing, suitDark, pal);
      head(ctx, actor, pal);
      gunArm(ctx, actor, bulk, suitDark, pal, weapon, rig);
      ctx.restore();
    }
  };

  function leg(ctx, side, swingAmt, air, bulk, suit, suitDark, pal) {
    var hipX = side * 3.4 * bulk;
    var hipY = -30;
    var kneeX = side * 4.2 * bulk + swingAmt * 6;
    var kneeY = air ? -19 : -15;
    var footX = side * 3 * bulk - swingAmt * 4;
    var footY = air ? -8 : -2;
    limb(ctx, hipX, hipY, kneeX, kneeY, 4.6, suitDark);
    limb(ctx, kneeX, kneeY, footX, footY, 3.6, suit);
    ctx.fillStyle = pal.armor;
    ctx.fillRect(footX - 4.5, footY - 2, 9, 5);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(kneeX - 2.2, kneeY - 1.6, 4.4, 3);
  }

  function torso(ctx, bulk, suit, suitDark, pal, hurt) {
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.moveTo(-8.5 * bulk, -47);
    ctx.lineTo(8.5 * bulk, -47);
    ctx.lineTo(7 * bulk, -30);
    ctx.lineTo(-7 * bulk, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hurt ? "rgba(255,255,255,0.35)" : pal.armor;
    ctx.fillRect(-5.5 * bulk, -45, 11 * bulk, 10);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-1.3, -44, 2.6, 8);
    ctx.fillStyle = suitDark;
    ctx.fillRect(-7 * bulk, -32.5, 14 * bulk, 3.2);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-1.6, -32.5, 3.2, 3.2);
    // Cartuchera
    ctx.fillStyle = pal.pack;
    ctx.fillRect(3.2 * bulk, -31.5, 3.4, 4);
  }

  function shoulders(ctx, bulk, pal) {
    var r = pal.helm === "heavy" ? 5.6 : 4.1;
    ctx.fillStyle = pal.armor;
    ctx.beginPath();
    ctx.arc(-9 * bulk, -45, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9 * bulk, -45, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-9 * bulk - 2, -46, 4, 1.6);
    ctx.fillRect(9 * bulk - 2, -46, 4, 1.6);
  }

  function offArm(ctx, bulk, swing, suitDark, pal) {
    var handX = -12 * bulk;
    var handY = -31 + swing * 2;
    limb(ctx, -8 * bulk, -44, handX, handY, 3.3, suitDark);
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(handX, handY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function head(ctx, actor, pal) {
    ctx.fillStyle = pal.suitDark;
    ctx.fillRect(-3, -50, 6, 6);
    if (pal.helm === "hood") {
      ctx.fillStyle = pal.suit;
      ctx.beginPath();
      ctx.arc(0, -55, 11, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(9, -44, 0, -46);
      ctx.quadraticCurveTo(-9, -44, -10, -55);
      ctx.fill();
      ctx.fillStyle = pal.suitDark;
      ctx.beginPath();
      ctx.arc(0, -54, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.visor;
      ctx.fillRect(-4.5, -55, 9, 2.6);
      return;
    }
    var hr = pal.helm === "heavy" ? 9.4 : 8.2;
    ctx.fillStyle = pal.suitDark;
    ctx.beginPath();
    ctx.arc(0, -56, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.armor;
    ctx.beginPath();
    ctx.arc(0, -58, hr - 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = pal.visor;
    ctx.fillRect(-6, -56.5, 12, 3.4);
    if (pal.helm === "heavy") {
      ctx.fillStyle = pal.trim;
      ctx.fillRect(-7, -66, 14, 3);
      ctx.fillStyle = pal.suitDark;
      ctx.fillRect(-8.5, -64.5, 17, 2);
    } else {
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(1.5, -63.5);
      ctx.lineTo(1.5, -69);
      ctx.stroke();
      ctx.fillStyle = pal.trim;
      ctx.fillRect(0.4, -70, 2.2, 2.2);
    }
  }

  function gunArm(ctx, actor, bulk, suitDark, pal, weapon, rig) {
    var ang = rig.localAng;
    var L = rig.barrel || 36;            // boca del cañón (px desde el hombro)
    var kick = actor.flash > 0 ? -1.6 : 0; // retroceso leve al disparar
    var G = ZC.GUN_RIG || { shoulderX: 7, shoulderY: -38, armY: -44, gripX: 12 };
    var px = G.shoulderX * bulk, py = G.shoulderY;
    var c = Math.cos(ang), s = Math.sin(ang);
    // Brazo: del hombro a la mano que sujeta el arma (pivote + empuñadura rotada)
    var hx = px + c * (G.gripX + kick) - s * 1, hy = py + s * (G.gripX + kick) + c * 1;
    limb(ctx, px - 1, G.armY, hx, hy, 3.4, suitDark);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.translate(kick, 0);
    // Cuerpo del arma y cañón hasta L
    ctx.fillStyle = "#2a2822";
    ctx.fillRect(13, -2.4, 16, 5);
    ctx.fillStyle = weapon.color || "#cdbb8a";
    ctx.fillRect(27, -1.5, L - 27, 3);
    ctx.fillStyle = "#1c1a16";
    ctx.fillRect(L - 1.2, -1.9, 1.2, 3.8);
    if (weapon.id === "shotgun") {
      ctx.fillStyle = "#2a2822";
      ctx.fillRect(15, 2.2, 11, 2.6);
    } else {
      ctx.fillStyle = "#45413a";
      ctx.fillRect(18, 2.2, 4, 4);
    }
    // Mano sobre la empuñadura
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(G.gripX, 1, 2.3, 0, Math.PI * 2);
    ctx.fill();
    if (actor.flash > 0) {
      // Fogonazo pegado a la boca del cañón, apuntando en la dirección del disparo
      ctx.translate(-kick, 0);
      ctx.fillStyle = "rgba(255, 214, 140, 0.9)";
      ctx.beginPath();
      ctx.moveTo(L, -3.2);
      ctx.lineTo(L + 11, 0);
      ctx.lineTo(L, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff6c0";
      ctx.beginPath();
      ctx.arc(L + 1, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ZC.Appearance.register({
    id: "operativo",
    name: "Operativo",
    blurb: "Casco oliva, visor ámbar y hombreras.",
    suit: "#3a3f2e",
    suitDark: "#252a1d",
    armor: "#5f6b48",
    trim: "#c9b98a",
    visor: "#d9a54e",
    pack: "#2a2c20",
    skin: "#c4a484",
    bulk: 1,
    helm: "helmet"
  });
  ZC.Appearance.register({
    id: "sombra",
    name: "Sombra",
    blurb: "Capucha y silueta más estrecha.",
    suit: "#2b2a27",
    suitDark: "#171614",
    armor: "#4a4640",
    trim: "#9a8f7c",
    visor: "#b89a66",
    pack: "#1a1917",
    skin: "#b9927a",
    bulk: 0.9,
    helm: "hood"
  });
  ZC.Appearance.register({
    id: "pesado",
    name: "Pesado",
    blurb: "Placas anchas y visor arena.",
    suit: "#3d3428",
    suitDark: "#241c14",
    armor: "#8d6b3c",
    trim: "#cf963c",
    visor: "#e6c27a",
    pack: "#2a2118",
    skin: "#c4a484",
    bulk: 1.2,
    helm: "heavy"
  });
})(typeof window !== "undefined" ? window : globalThis);
