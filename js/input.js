/* ============================================================================
   Zona Cero — entrada PC y táctil
   Contrato: Teclado/ratón y joysticks Pointer Events. ZC.Input.bindings define las teclas actuales. Expone readPlayerInput y bindInput.
   Depende de: js/zc.js  (en runtime llama ZC.startMatch, ZC.toggleMute, ZC.unlockAudio)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/input.js");

// Punto de extensión: cambiar teclas aquí. Una futura pantalla de
  // "configurar controles" escribiría sobre este objeto; no hay UI aún.
  ZC.Input = ZC.Input || {};
  ZC.Input.bindings = {
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
    jump: ["Space", "KeyW", "ArrowUp"],
    reload: ["KeyR"],
    weapon1: ["Digit1", "Numpad1"],
    weapon2: ["Digit2", "Numpad2"],
    cycleWeapon: ["KeyQ"],
    mute: ["KeyM"],
    start: ["Enter"]
  };

  function anyKey(list) {
    for (var i = 0; i < list.length; i++) if (ZC.keys[list[i]]) return true;
    return false;
  }

  ZC.bindInput = function () {
    const el = ZC.canvas;
    global.addEventListener("keydown", function (e) {
      ZC.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
      if (e.code === "KeyM") { ZC.toggleMute(); }
      if (e.code === "Enter" && ZC.state === "title" && !ZC.layoutEditing) {
        if (ZC.lobbyOpen && ZC.startFromLobby) ZC.startFromLobby();
        else if (ZC.openLobby) ZC.openLobby();
        else ZC.startMatch();
      }
      if (e.code === "KeyQ") ZC.input.swap = 3; // ciclar
    });
    global.addEventListener("keyup", function (e) { ZC.keys[e.code] = false; });
    el.addEventListener("mousemove", function (e) {
      const w = ZC.worldFromScreen(e.clientX, e.clientY);
      ZC.input.mx = w.x; ZC.input.my = w.y;
    });
    el.addEventListener("mousedown", function (e) {
      if (e.button === 0) ZC.input.fire = true;
      ZC.unlockAudio();
    });
    global.addEventListener("mouseup", function (e) {
      if (e.button === 0) ZC.input.fire = false;
    });
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // Capa táctil
    const left = document.getElementById("joy-left");
    const right = document.getElementById("joy-right");
    const jumpB = document.getElementById("btn-jump");
    const relB = document.getElementById("btn-reload");
    const swapB = document.getElementById("btn-swap");

    function bindJoy(node, side) {
      if (!node) return;
      node.addEventListener("pointerdown", function (e) {
        if (ZC.layoutEditing) return;
        e.preventDefault();
        node.setPointerCapture(e.pointerId);
        ZC.enableTouch();
        if (side === "left") ZC.touch.leftId = e.pointerId;
        else ZC.touch.rightId = e.pointerId;
        ZC.updateJoy(e, side);
      });
      node.addEventListener("pointermove", function (e) {
        if (side === "left" && e.pointerId !== ZC.touch.leftId) return;
        if (side === "right" && e.pointerId !== ZC.touch.rightId) return;
        ZC.updateJoy(e, side);
      });
      function end(e) {
        if (side === "left" && e.pointerId === ZC.touch.leftId) {
          ZC.touch.leftId = null; ZC.touch.lx = 0; ZC.touch.ly = 0;
          ZC.input.analog = false; ZC.input.moveX = 0;
          ZC.placeKnob("knob-left", 0, 0);
        }
        if (side === "right" && e.pointerId === ZC.touch.rightId) {
          ZC.touch.rightId = null; ZC.touch.rx = 0; ZC.touch.ry = 0;
          ZC.input.aimStick = false; ZC.input.fire = false;
          ZC.placeKnob("knob-right", 0, 0);
        }
      }
      node.addEventListener("pointerup", end);
      node.addEventListener("pointercancel", end);
    }
    bindJoy(left, "left");
    bindJoy(right, "right");

    function pressHold(btn, on, off) {
      if (!btn) return;
      btn.addEventListener("pointerdown", function (e) {
        if (ZC.layoutEditing) return;
        e.preventDefault(); ZC.enableTouch(); on();
        btn.setPointerCapture(e.pointerId);
      });
      btn.addEventListener("pointerup", off);
      btn.addEventListener("pointercancel", off);
    }
    // El latch (jumpPressed) sobrevive aunque el dedo suelte antes del siguiente frame.
    pressHold(jumpB, function () { ZC.input.jumpHold = true; ZC.input.jumpPressed = true; }, function () { ZC.input.jumpHold = false; });
    pressHold(relB, function () { ZC.input.reloadHold = true; }, function () { ZC.input.reloadHold = false; });
    if (swapB) {
      swapB.addEventListener("pointerdown", function (e) {
        if (ZC.layoutEditing) return;
        e.preventDefault(); ZC.enableTouch(); ZC.input.swap = 3;
      });
    }

    [left, right, jumpB, relB, swapB].forEach(bindLayoutDrag);

    global.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") ZC.enableTouch();
    }, { passive: true });

    try {
      if (global.matchMedia && global.matchMedia("(pointer: coarse)").matches) ZC.enableTouch();
    } catch (err) { /* matchMedia no crítico */ }
  }

  ZC.updateJoy = function (e, side) {
    const node = document.getElementById(side === "left" ? "joy-left" : "joy-right");
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const max = rect.width * 0.42;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const n = ZC.util.norm(dx, dy);
    const mag = Math.min(n.l, max);
    const ox = (n.l < 1e-6 ? 0 : n.x) * mag;
    const oy = (n.l < 1e-6 ? 0 : n.y) * mag;
    const nx = max < 1e-6 ? 0 : ox / max;
    const ny = max < 1e-6 ? 0 : oy / max;
    if (side === "left") {
      ZC.touch.lx = nx; ZC.touch.ly = ny;
      ZC.input.analog = true;
      ZC.input.moveX = nx;
      ZC.placeKnob("knob-left", ox, oy);
    } else {
      ZC.touch.rx = nx; ZC.touch.ry = ny;
      ZC.input.aimStick = true;
      if (n.l > 8) { ZC.input.aimX = n.x; ZC.input.aimY = n.y; }
      ZC.input.fire = Math.hypot(nx, ny) > 0.32;
      ZC.placeKnob("knob-right", ox, oy);
    }
  }

  ZC.placeKnob = function (id, ox, oy) {
    const k = document.getElementById(id);
    if (!k) return;
    k.style.transform = "translate(calc(-50% + " + ox + "px), calc(-50% + " + oy + "px))";
  }

  ZC.enableTouch = function () {
    ZC.touch.enabled = true;
    const ui = document.getElementById("touch-ui");
    if (ui) { ui.classList.add("show"); ui.setAttribute("aria-hidden", "false"); }
    if (ZC.canvas) ZC.canvas.style.cursor = "default";
    if (ZC.applyControlLayout) ZC.applyControlLayout();
  }

  var LAYOUT_IDS = ["joy-left", "joy-right", "btn-jump", "btn-reload", "btn-swap"];

  function bindLayoutDrag(node) {
    if (!node || node.__zcDrag) return;
    node.__zcDrag = true;
    node.addEventListener("pointerdown", function (e) {
      if (!ZC.layoutEditing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var app = document.getElementById("app") || document.body;
      var bounds = app.getBoundingClientRect();
      var box = node.getBoundingClientRect();
      var ox = e.clientX - box.left;
      var oy = e.clientY - box.top;
      if (node.setPointerCapture) node.setPointerCapture(e.pointerId);
      function move(ev) {
        if (!bounds.width || !bounds.height) return;
        var x = (ev.clientX - ox - bounds.left) / bounds.width * 100;
        var y = (ev.clientY - oy - bounds.top) / bounds.height * 100;
        x = Math.max(0, Math.min(86, x));
        y = Math.max(0, Math.min(78, y));
        node.style.left = x.toFixed(1) + "%";
        node.style.top = y.toFixed(1) + "%";
        node.style.right = "auto";
        node.style.bottom = "auto";
        if (!ZC.profile) return;
        if (!ZC.profile.layout) ZC.profile.layout = {};
        ZC.profile.layout[node.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      }
      function up() {
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", up);
        node.removeEventListener("pointercancel", up);
        if (ZC.saveProfile) ZC.saveProfile();
      }
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", up);
      node.addEventListener("pointercancel", up);
    }, true);
  }

  ZC.applyControlLayout = function () {
    var ui = document.getElementById("touch-ui");
    var p = ZC.profile;
    var scale = (p && p.controlScale) || 1;
    if (ui && ui.style && ui.style.setProperty) ui.style.setProperty("--touch-scale", String(scale));
    for (var i = 0; i < LAYOUT_IDS.length; i++) {
      var el = document.getElementById(LAYOUT_IDS[i]);
      var pos = p && p.layout && p.layout[LAYOUT_IDS[i]];
      if (!el) continue;
      if (!pos) {
        el.style.left = "";
        el.style.top = "";
        el.style.right = "";
        el.style.bottom = "";
        continue;
      }
      el.style.left = pos.x + "%";
      el.style.top = pos.y + "%";
      el.style.right = "auto";
      el.style.bottom = "auto";
    }
  };

  ZC.resetControlLayout = function () {
    if (ZC.profile) {
      ZC.profile.layout = null;
      ZC.profile.controlScale = 1;
    }
    ZC.applyControlLayout();
    if (ZC.saveProfile) ZC.saveProfile();
  };

  ZC.beginLayoutEdit = function () {
    ZC.layoutEditing = true;
    ZC.enableTouch();
    var ui = document.getElementById("touch-ui");
    if (ui) ui.classList.add("layout-edit");
    var bar = document.getElementById("layout-bar");
    if (bar) bar.hidden = false;
    var sheet = document.getElementById("lobby-sheet");
    if (sheet) sheet.hidden = true;
    ZC.lobbySheet = null;
  };

  ZC.endLayoutEdit = function () {
    if (!ZC.layoutEditing && !document.getElementById("layout-bar")) return;
    ZC.layoutEditing = false;
    var ui = document.getElementById("touch-ui");
    if (ui && ui.classList) ui.classList.remove("layout-edit");
    var bar = document.getElementById("layout-bar");
    if (bar) bar.hidden = true;
    if (ZC.saveProfile && ZC.profile) ZC.saveProfile();
    if (ZC.lobbyOpen && ui && ui.classList) ui.classList.remove("show");
  };

  ZC.worldFromScreen = function (clientX, clientY) {
    const rect = ZC.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) / rect.width * ZC.viewW;
    const sy = (clientY - rect.top) / rect.height * ZC.viewH;
    return { x: ZC.cam.x + sx, y: ZC.cam.y + sy };
  }

  ZC.readPlayerInput = function () {
    ZC.syncDigitalInput();
    let moveX = 0;
    if (ZC.input.analog) moveX = ZC.util.clamp(ZC.input.moveX, -1, 1);
    else moveX = (ZC.input.right ? 1 : 0) - (ZC.input.left ? 1 : 0);
    if (!ZC.input.aimStick && ZC.player) {
      const w = { x: ZC.input.mx, y: ZC.input.my };
      const dx = w.x - ZC.player.x, dy = w.y - (ZC.player.y - 16);
      const n = ZC.util.norm(dx, dy);
      if (n.l > 4) { ZC.player.aimX = n.x; ZC.player.aimY = n.y; }
    } else if (ZC.player && ZC.input.aimStick) {
      ZC.player.aimX = ZC.input.aimX; ZC.player.aimY = ZC.input.aimY;
    }
    if (ZC.player && ZC.input.swap) {
      var slots = (ZC.player.gun.carried && ZC.player.gun.carried.length) ? ZC.player.gun.carried : ["rifle", "shotgun"];
      var pick = null;
      if (ZC.input.swap === 1) pick = "rifle";
      else if (ZC.input.swap === 2) pick = "shotgun";
      if (pick) {
        if (slots.indexOf(pick) >= 0) ZC.player.gun.current = pick;
      } else {
        var at = slots.indexOf(ZC.player.gun.current);
        ZC.player.gun.current = slots[(at < 0 ? 0 : at + 1) % slots.length];
      }
      ZC.input.swap = 0;
    }
    // Un toque = un salto. Si se pasara el hold, el mismo press consumiría el doble salto al frame siguiente.
    var jump = !!ZC.input.jumpPressed;
    ZC.input.jumpPressed = false;
    return { moveX: moveX, jump: jump, fire: ZC.input.fire, reload: ZC.input.reload };
  }


  ZC.syncDigitalInput = function () {
    var b = ZC.Input.bindings;
    ZC.input.left = anyKey(b.left);
    ZC.input.right = anyKey(b.right);
    var keyJump = anyKey(b.jump);
    if (keyJump && !ZC.input._keyJump) ZC.input.jumpPressed = true;
    ZC.input._keyJump = keyJump;
    // No pisar el botón táctil: antes esto ponía jump/reload en false cada frame.
    ZC.input.jump = keyJump || !!ZC.input.jumpHold;
    ZC.input.reload = anyKey(b.reload) || !!ZC.input.reloadHold;
    if (anyKey(b.weapon1)) ZC.input.swap = 1;
    if (anyKey(b.weapon2)) ZC.input.swap = 2;
  };
})(typeof window !== "undefined" ? window : globalThis);
