/* ============================================================================
   Zona Cero — lobby
   Contrato: Carga el perfil, pinta el lobby (sala) y despliega con ZC.startFromLobby. Los paneles de mochila, aspecto, mapa y ajustes viven aquí. La forma la dibuja ZC.Appearance.
   Depende de: js/zc.js, js/weapons.js, js/maps.js, js/appearance.js, js/ui.js (en runtime llama ZC.startMatch)
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/lobby.js");

  var STORE_KEY = "zona-cero-profile-v1";

  function storage() {
    try {
      if (!global.localStorage) return null;
      var k = "__zc";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return global.localStorage;
    } catch (err) {
      return null;
    }
  }

  function defaults() {
    return {
      name: "Tú",
      look: "operativo",
      mapId: "arena-industrial",
      primary: "rifle",
      carried: ["rifle", "shotgun"],
      hp: 100,
      bots: 7,
      controlScale: 1,
      layout: null
    };
  }

  function clampNum(v, a, b, fallback) {
    var n = Number(v);
    if (n !== n) return fallback;
    if (n < a) return a;
    if (n > b) return b;
    return n;
  }

  function readLayout(raw) {
    if (!raw || typeof raw !== "object") return null;
    var ids = ["joy-left", "joy-right", "btn-jump", "btn-reload", "btn-swap"];
    var out = {};
    var any = false;
    for (var i = 0; i < ids.length; i++) {
      var pos = raw[ids[i]];
      if (!pos) continue;
      var x = Number(pos.x);
      var y = Number(pos.y);
      if (x !== x || y !== y) continue;
      out[ids[i]] = { x: Math.max(0, Math.min(86, x)), y: Math.max(0, Math.min(78, y)) };
      any = true;
    }
    return any ? out : null;
  }

  function normalize(raw) {
    var d = defaults();
    var p = raw || {};
    var lookOk = ZC.Appearance && ZC.Appearance.looks && ZC.Appearance.looks[p.look];
    var mapOk = ZC.Maps && ZC.Maps.all && ZC.Maps.all[p.mapId];
    var carried = [];
    var src = p.carried || d.carried;
    for (var i = 0; i < src.length; i++) {
      if (ZC.WEAPONS && ZC.WEAPONS[src[i]] && carried.indexOf(src[i]) < 0) carried.push(src[i]);
    }
    if (!carried.length) carried = d.carried.slice();
    var name = String(p.name == null ? d.name : p.name).replace(/^\s+|\s+$/g, "").slice(0, 16);
    return {
      name: name || d.name,
      look: lookOk ? p.look : d.look,
      mapId: mapOk ? p.mapId : d.mapId,
      primary: carried.indexOf(p.primary) >= 0 ? p.primary : carried[0],
      carried: carried,
      hp: clampNum(p.hp, 50, 200, d.hp),
      bots: clampNum(p.bots, 1, 7, d.bots),
      controlScale: clampNum(p.controlScale, 0.7, 1.4, d.controlScale),
      layout: readLayout(p.layout)
    };
  }

  ZC.loadProfile = function () {
    var box = storage();
    var parsed = null;
    if (box) {
      try { parsed = JSON.parse(box.getItem(STORE_KEY) || "null"); } catch (err) { parsed = null; }
    }
    ZC.profile = normalize(parsed);
    ZC.profile.persisted = !!box;
    return ZC.profile;
  };

  ZC.saveProfile = function () {
    ZC.profile = normalize(ZC.profile);
    var box = storage();
    ZC.profile.persisted = !!box;
    if (!box) return ZC.profile;
    try {
      box.setItem(STORE_KEY, JSON.stringify({
        name: ZC.profile.name,
        look: ZC.profile.look,
        mapId: ZC.profile.mapId,
        primary: ZC.profile.primary,
        carried: ZC.profile.carried,
        hp: ZC.profile.hp,
        bots: ZC.profile.bots,
        controlScale: ZC.profile.controlScale,
        layout: ZC.profile.layout
      }));
    } catch (err) {
      ZC.profile.persisted = false;
    }
    return ZC.profile;
  };

  ZC.applyProfile = function (actor) {
    if (!actor) return actor;
    var p = normalize(ZC.profile || ZC.loadProfile());
    ZC.profile = p;
    actor.look = p.look;
    if (actor.isPlayer) {
      actor.name = p.name || "Tú";
      var look = ZC.Appearance && ZC.Appearance.get(p.look);
      actor.color = (look && look.trim) || "#c9b98a";
      actor.accent = actor.color;
      actor.maxHp = p.hp || 100;
      actor.hp = actor.maxHp;
    }
    if (actor.gun) {
      actor.gun.carried = p.carried.slice();
      if (p.carried.indexOf(actor.gun.current) < 0 || actor.isPlayer) {
        actor.gun.current = p.primary;
      }
    }
    return actor;
  };

  function updateChrome() {
    if (!ZC.profile) ZC.loadProfile();
    var p = ZC.profile;
    var name = document.getElementById("lobby-name");
    if (name && document.activeElement !== name) name.value = p.name;
    var map = ZC.Maps && ZC.Maps.all ? ZC.Maps.all[p.mapId] : null;
    var mapName = document.getElementById("lobby-map-name");
    var mapBlurb = document.getElementById("lobby-map-blurb");
    if (mapName) mapName.textContent = map ? map.name : p.mapId;
    if (mapBlurb) mapBlurb.textContent = map && map.blurb ? map.blurb : "Toca para cambiar de mapa";
    var hand = ZC.WEAPONS && ZC.WEAPONS[p.primary];
    var look = ZC.Appearance && ZC.Appearance.get(p.look);
    var sub = document.getElementById("lobby-sub");
    if (sub) {
      sub.textContent = (look ? look.name : "Operativo") + " · " +
        (hand ? hand.name : "Arma") + " · " + p.hp + " HP";
    }
  }

  function fillLooks(host) {
    host = host || document.getElementById("lobby-looks");
    if (!host || !ZC.Appearance) return;
    var html = "";
    ZC.Appearance.list().forEach(function (look) {
      var on = ZC.profile.look === look.id;
      html += '<button type="button" class="look-chip' + (on ? " on" : "") + '" data-look="' + look.id + '">' +
        '<strong>' + look.name + '</strong><span>' + (look.blurb || "") + '</span></button>';
    });
    host.innerHTML = html;
  }

  function fillInventory(host) {
    host = host || document.getElementById("lobby-inventory");
    if (!host || !ZC.WEAPONS) return;
    var html = "";
    Object.keys(ZC.WEAPONS).forEach(function (id) {
      var w = ZC.WEAPONS[id];
      var carried = ZC.profile.carried.indexOf(id) >= 0;
      var hand = ZC.profile.primary === id;
      html += '<div class="inv-card' + (hand ? " on" : "") + (carried ? " carried" : "") + '">' +
        '<button type="button" class="hand" data-act="hand" data-weapon="' + id + '">' +
        '<strong style="color:' + w.color + '">' + w.name + '</strong>' +
        '<span class="inv-meta">' + w.mag + " / " + w.reserve + " al desplegar</span>" +
        '<span class="inv-meta">' + (hand ? "En mano" : carried ? "En la mochila" : "Fuera del equipo") + "</span>" +
        "</button>" +
        '<button type="button" class="mini" data-act="drop" data-weapon="' + id + '">' +
        (carried ? "Dejar" : "Llevar") + "</button></div>";
    });
    host.innerHTML = html;
  }

  function fillMaps(host) {
    host = host || document.getElementById("lobby-maps");
    if (!host || !ZC.Maps) return;
    var html = "";
    ZC.Maps.list().forEach(function (id) {
      var map = ZC.Maps.all[id];
      var on = ZC.profile.mapId === id;
      html += '<button type="button" class="map-card' + (on ? " on" : "") + '" data-map="' + id + '">' +
        "<strong>" + map.name + "</strong><span>" + (map.blurb || "Arena local") + "</span></button>";
    });
    host.innerHTML = html;
  }

  function fillSettings(host) {
    var p = ZC.profile;
    host.innerHTML =
      '<div class="set-row"><label>Vida del personaje <strong id="set-hp-val">' + p.hp + '</strong></label>' +
      '<input id="set-hp" type="range" min="50" max="200" step="10" value="' + p.hp + '"></div>' +
      '<div class="set-row"><label>Rivales <strong id="set-bots-val">' + p.bots + '</strong></label>' +
      '<input id="set-bots" type="range" min="1" max="7" step="1" value="' + p.bots + '"></div>' +
      '<div class="set-row"><label>Tamaño de controles <strong id="set-scale-val">' + Math.round(p.controlScale * 100) + '%</strong></label>' +
      '<input id="set-scale" type="range" min="70" max="140" step="5" value="' + Math.round(p.controlScale * 100) + '"></div>' +
      '<p class="lobby-label">Mapa</p><div id="lobby-maps"></div>' +
      '<div class="actions">' +
      '<button type="button" class="cta" id="btn-layout-edit">Mover controles</button>' +
      '<button type="button" class="ghost" id="btn-layout-reset-inline">Restaurar posición</button>' +
      '</div>' +
      '<p class="footnote">Arrastra joysticks y botones. WASD, espacio y el ratón no cambian.</p>';
    fillMaps(document.getElementById("lobby-maps"));
    var hp = document.getElementById("set-hp");
    var bots = document.getElementById("set-bots");
    var scale = document.getElementById("set-scale");
    if (hp) hp.addEventListener("input", function () {
      ZC.profile.hp = Number(hp.value);
      var lab = document.getElementById("set-hp-val");
      if (lab) lab.textContent = String(ZC.profile.hp);
      ZC.saveProfile();
      updateChrome();
    });
    if (bots) bots.addEventListener("input", function () {
      ZC.profile.bots = Number(bots.value);
      var lab = document.getElementById("set-bots-val");
      if (lab) lab.textContent = String(ZC.profile.bots);
      ZC.saveProfile();
    });
    if (scale) scale.addEventListener("input", function () {
      ZC.profile.controlScale = Number(scale.value) / 100;
      var lab = document.getElementById("set-scale-val");
      if (lab) lab.textContent = scale.value + "%";
      ZC.saveProfile();
      if (ZC.applyControlLayout) ZC.applyControlLayout();
    });
    var edit = document.getElementById("btn-layout-edit");
    var reset = document.getElementById("btn-layout-reset-inline");
    if (edit) edit.addEventListener("click", function () {
      if (ZC.beginLayoutEdit) ZC.beginLayoutEdit();
    });
    if (reset) reset.addEventListener("click", function () {
      if (ZC.resetControlLayout) ZC.resetControlLayout();
    });
  }

  function openSheet(which) {
    ZC.lobbySheet = which;
    var sheet = document.getElementById("lobby-sheet");
    var title = document.getElementById("lobby-sheet-title");
    var body = document.getElementById("lobby-sheet-body");
    if (!sheet || !body) return;
    sheet.hidden = false;
    var titles = { inventory: "Mochila", looks: "Aspecto", map: "Mapa", settings: "Ajustes" };
    if (title) title.textContent = titles[which] || "Lobby";
    if (which === "inventory") fillInventory(body);
    else if (which === "looks") fillLooks(body);
    else if (which === "map") fillMaps(body);
    else if (which === "settings") fillSettings(body);
  }

  function closeSheet() {
    ZC.lobbySheet = null;
    var sheet = document.getElementById("lobby-sheet");
    if (sheet) sheet.hidden = true;
  }

  ZC.renderLobby = function () {
    updateChrome();
    if (ZC.lobbySheet) openSheet(ZC.lobbySheet);
    ZC.drawLobbyPreview();
  };

  ZC.drawLobbyPreview = function () {
    var canvas = document.getElementById("lobby-preview");
    if (!canvas || !canvas.getContext || !ZC.Appearance) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var w = canvas.width || 480;
    var h = canvas.height || 640;
    var prev = ZC.ctx;
    ZC.ctx = ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var p = ZC.profile || defaults();
    var t = ZC.lobbyPreviewT || 0;
    ctx.save();
    ctx.translate(w * 0.5, h - 52);
    ctx.scale(3.1, 3.1);
    ZC.Appearance.draw({
      isPlayer: true,
      look: p.look,
      color: "#c9b98a",
      grounded: true,
      vx: 40,
      walkPhase: t * 8,
      aimX: 1,
      aimY: -0.12,
      hurt: 0,
      flash: 0,
      gun: { current: p.primary || "rifle" }
    });
    ctx.restore();
    ZC.ctx = prev;
  };

  function previewTick() {
    if (!ZC.lobbyOpen) return;
    ZC.lobbyPreviewT = (ZC.lobbyPreviewT || 0) + 1 / 60;
    ZC.drawLobbyPreview();
    ZC.lobbyRaf = global.requestAnimationFrame(previewTick);
  }

  function touchChrome(show) {
    var ui = document.getElementById("touch-ui");
    if (!ui) return;
    if (show && ZC.touch && ZC.touch.enabled) {
      ui.classList.add("show");
      ui.setAttribute("aria-hidden", "false");
    } else if (!show) {
      ui.classList.remove("show");
    }
  }

  ZC.openLobby = function () {
    ZC.loadProfile();
    if (ZC.profile.mapId && ZC.Maps && ZC.Maps.all[ZC.profile.mapId]) ZC.Maps.use(ZC.profile.mapId);
    ZC.state = "title";
    ZC.lobbyOpen = true;
    if (ZC.setInMatch) ZC.setInMatch(false);
    ZC.hideOverlay("title-screen");
    ZC.hideOverlay("end-screen");
    ZC.showOverlay("lobby-screen");
    touchChrome(false);
    ZC.renderLobby();
    if (ZC.lobbyRaf) global.cancelAnimationFrame(ZC.lobbyRaf);
    ZC.lobbyRaf = global.requestAnimationFrame(previewTick);
  };

  ZC.closeLobby = function () {
    if (ZC.endLayoutEdit) ZC.endLayoutEdit();
    closeSheet();
    ZC.lobbyOpen = false;
    ZC.hideOverlay("lobby-screen");
    if (ZC.lobbyRaf) {
      global.cancelAnimationFrame(ZC.lobbyRaf);
      ZC.lobbyRaf = 0;
    }
    touchChrome(true);
  };

  ZC.startFromLobby = function () {
    var input = document.getElementById("lobby-name");
    if (input && ZC.profile) ZC.profile.name = input.value;
    ZC.saveProfile();
    if (ZC.profile.mapId && ZC.Maps.all[ZC.profile.mapId]) ZC.Maps.use(ZC.profile.mapId);
    ZC.closeLobby();
    // El toque en Iniciar es un gesto del usuario: ahí se puede pedir pantalla completa
    ZC.startMatch({ requestFullscreen: true });
  };

  function onLobbyClick(e) {
    var node = e.target;
    var look = null;
    var map = null;
    var weapon = null;
    var act = null;
    var panel = null;
    while (node && node !== e.currentTarget) {
      if (!look && node.getAttribute && node.getAttribute("data-look")) look = node.getAttribute("data-look");
      if (!map && node.getAttribute && node.getAttribute("data-map")) map = node.getAttribute("data-map");
      if (!weapon && node.getAttribute && node.getAttribute("data-weapon")) weapon = node.getAttribute("data-weapon");
      if (!act && node.getAttribute && node.getAttribute("data-act")) act = node.getAttribute("data-act");
      if (!panel && node.getAttribute && node.getAttribute("data-panel")) panel = node.getAttribute("data-panel");
      node = node.parentNode;
    }
    if (!ZC.profile) ZC.loadProfile();
    if (panel === "close") { closeSheet(); return; }
    if (panel) {
      if (ZC.layoutEditing && ZC.endLayoutEdit) ZC.endLayoutEdit();
      openSheet(panel);
      return;
    }
    if (look && ZC.Appearance.looks[look]) {
      ZC.profile.look = look;
      ZC.saveProfile();
      ZC.renderLobby();
      return;
    }
    if (map && ZC.Maps.all[map]) {
      ZC.profile.mapId = map;
      ZC.Maps.use(map);
      if (ZC.resetWorldDecor) ZC.resetWorldDecor();
      ZC.saveProfile();
      ZC.renderLobby();
      return;
    }
    if (!weapon || !ZC.WEAPONS[weapon]) return;
    if (act === "drop") {
      var has = ZC.profile.carried.indexOf(weapon) >= 0;
      if (has) {
        if (ZC.profile.carried.length <= 1) {
          var sub = document.getElementById("lobby-sub");
          if (sub) sub.textContent = "Debes llevar al menos un arma.";
          return;
        }
        ZC.profile.carried = ZC.profile.carried.filter(function (id) { return id !== weapon; });
        if (ZC.profile.primary === weapon) ZC.profile.primary = ZC.profile.carried[0];
      } else {
        ZC.profile.carried.push(weapon);
        ZC.profile.primary = weapon;
      }
    } else {
      if (ZC.profile.carried.indexOf(weapon) < 0) ZC.profile.carried.push(weapon);
      ZC.profile.primary = weapon;
    }
    ZC.saveProfile();
    ZC.renderLobby();
  }

  ZC.bindLobby = function () {
    var root = document.getElementById("lobby-screen");
    var deploy = document.getElementById("btn-deploy");
    var back = document.getElementById("btn-lobby-back");
    var name = document.getElementById("lobby-name");
    if (root && !root.__zcBound) {
      root.addEventListener("click", onLobbyClick);
      root.__zcBound = true;
    }
    if (deploy && !deploy.__zcBound) {
      deploy.addEventListener("click", function () { ZC.startFromLobby(); });
      deploy.__zcBound = true;
    }
    if (back && !back.__zcBound) {
      back.addEventListener("click", function () { ZC.goMenu(); });
      back.__zcBound = true;
    }
    if (name && !name.__zcBound) {
      name.addEventListener("input", function () {
        if (!ZC.profile) ZC.loadProfile();
        ZC.profile.name = name.value;
        ZC.saveProfile();
      });
      name.__zcBound = true;
    }
    var sheetClose = document.getElementById("btn-sheet-close");
    var done = document.getElementById("btn-layout-done");
    var reset = document.getElementById("btn-layout-reset");
    if (sheetClose && !sheetClose.__zcBound) {
      sheetClose.addEventListener("click", function () { closeSheet(); });
      sheetClose.__zcBound = true;
    }
    if (done && !done.__zcBound) {
      done.addEventListener("click", function () { if (ZC.endLayoutEdit) ZC.endLayoutEdit(); });
      done.__zcBound = true;
    }
    if (reset && !reset.__zcBound) {
      reset.addEventListener("click", function () { if (ZC.resetControlLayout) ZC.resetControlLayout(); });
      reset.__zcBound = true;
    }
  };

  ZC.loadProfile();
})(typeof window !== "undefined" ? window : globalThis);
