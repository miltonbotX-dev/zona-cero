/* ============================================================================
   Zona Cero — mapas
   Contrato: Registro ZC.Maps y mapa activo ZC.map (platforms, crates, spawns, silos, lootSpots, blurb). El lobby lista ZC.Maps.list() y startMatch usa el mapa del perfil.
   Depende de: js/zc.js, js/config.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/maps.js");

function crate(x, y, w, h) { return { x: x, y: y, w: w || 40, h: h || 40 }; }

  var gy = ZC.CFG.groundY;
  var arenaIndustrial = {
    id: "arena-industrial",
    name: "Nave industrial",
    blurb: "Cajas, pasarelas y tres alturas. El mapa de siempre.",
    platforms: [
      { x: 140, y: 680, w: 260, h: 20 },
      { x: 470, y: 540, w: 230, h: 20 },
      { x: 220, y: 400, w: 190, h: 20 },
      { x: 720, y: 700, w: 300, h: 20 },
      { x: 980, y: 560, w: 280, h: 20 },
      { x: 1080, y: 400, w: 260, h: 20 },
      { x: 1180, y: 250, w: 220, h: 20 },
      { x: 1480, y: 660, w: 280, h: 20 },
      { x: 1760, y: 520, w: 250, h: 20 },
      { x: 1980, y: 370, w: 230, h: 20 },
      { x: 2140, y: 680, w: 250, h: 20 },
      { x: 1620, y: 280, w: 180, h: 20 },
      { x: 780, y: 280, w: 170, h: 20 }
    ],
    crates: [
      crate(310, gy - 40), crate(350, gy - 40), crate(330, gy - 80),
      crate(880, gy - 40), crate(920, gy - 40),
      crate(1240, gy - 40), crate(1240, gy - 80),
      crate(1680, gy - 40), crate(1720, gy - 40), crate(1700, gy - 80),
      crate(2280, gy - 40), crate(2320, gy - 40),
      crate(180, 680 - 40), crate(760, 700 - 40), crate(1100, 560 - 40), crate(1160, 560 - 40),
      crate(1540, 660 - 40), crate(1860, 520 - 40), crate(2040, 370 - 40),
      crate(1220, 400 - 40), crate(2200, 680 - 40)
    ],
    spawns: [
      { x: 220, y: 760 }, { x: 620, y: 760 }, { x: 1100, y: 760 }, { x: 1500, y: 760 },
      { x: 2000, y: 760 }, { x: 2400, y: 760 }, { x: 560, y: 500 }, { x: 1280, y: 210 },
      { x: 1880, y: 470 }, { x: 230, y: 360 }
    ],
    silos: [
      { x: 80, w: 90, h: 260 }, { x: 430, w: 70, h: 180 }, { x: 900, w: 110, h: 300 },
      { x: 1400, w: 80, h: 220 }, { x: 1900, w: 120, h: 280 }, { x: 2380, w: 90, h: 240 }
    ],
    lootSpots: [
      [300, 640], [500, 500], [250, 360], [860, 660], [1080, 520],
      [1180, 360], [1260, 210], [1580, 620], [1860, 480], [2080, 330],
      [2220, 640], [860, 240], [1700, 240], [640, gy - 20],
      [1320, gy - 20], [1960, gy - 20]
    ]
  };

  ZC.Maps = {
    all: {},
    currentId: null,
    crate: crate,
    register: function (id, def) {
      def = def || {};
      def.id = id;
      this.all[id] = def;
      return def;
    },
    use: function (id) {
      var def = this.all[id];
      if (!def) throw new Error("Mapa desconocido: " + id);
      this.currentId = id;
      ZC.map = def;
      return def;
    },
    list: function () { return Object.keys(this.all); }
  };
  var muelle = {
    id: "muelle",
    name: "Muelle norte",
    blurb: "Pasarelas bajas y cajas en fila. Poca altura, mucho cruce.",
    platforms: [
      { x: 60, y: 700, w: 480, h: 18 },
      { x: 620, y: 620, w: 260, h: 18 },
      { x: 960, y: 700, w: 380, h: 18 },
      { x: 1420, y: 600, w: 300, h: 18 },
      { x: 1780, y: 500, w: 240, h: 18 },
      { x: 2060, y: 680, w: 420, h: 18 },
      { x: 360, y: 500, w: 200, h: 18 },
      { x: 1280, y: 430, w: 180, h: 18 }
    ],
    crates: [
      crate(180, gy - 40), crate(220, gy - 40), crate(200, gy - 80),
      crate(700, gy - 40), crate(1040, gy - 40), crate(1080, gy - 40),
      crate(1500, gy - 40), crate(1900, gy - 40), crate(1940, gy - 40), crate(1920, gy - 80),
      crate(2300, gy - 40),
      crate(120, 700 - 40), crate(400, 700 - 40), crate(1100, 700 - 40),
      crate(1560, 600 - 40), crate(2140, 680 - 40), crate(420, 500 - 40)
    ],
    spawns: [
      { x: 140, y: 760 }, { x: 480, y: 760 }, { x: 860, y: 760 }, { x: 1280, y: 760 },
      { x: 1680, y: 760 }, { x: 2200, y: 760 }, { x: 240, y: 660 }, { x: 1100, y: 660 },
      { x: 1600, y: 560 }, { x: 2140, y: 640 }
    ],
    silos: [
      { x: 40, w: 54, h: 200 }, { x: 520, w: 48, h: 160 }, { x: 880, w: 70, h: 240 },
      { x: 1360, w: 50, h: 180 }, { x: 1880, w: 80, h: 220 }, { x: 2460, w: 60, h: 200 }
    ],
    lootSpots: [
      [200, 660], [700, 580], [400, 460], [1100, 660], [1500, 560],
      [1860, 460], [2200, 640], [500, gy - 20], [1400, gy - 20], [2000, gy - 20],
      [1320, 390], [240, 760]
    ]
  };

  var azoteas = {
    id: "azoteas",
    name: "Azoteas",
    blurb: "Tres torres y puentes altos. Quien tiene la altura dispara primero.",
    platforms: [
      { x: 140, y: 640, w: 200, h: 18 },
      { x: 180, y: 480, w: 170, h: 18 },
      { x: 160, y: 320, w: 150, h: 18 },
      { x: 520, y: 560, w: 280, h: 18 },
      { x: 860, y: 420, w: 220, h: 18 },
      { x: 1140, y: 280, w: 200, h: 18 },
      { x: 1500, y: 620, w: 240, h: 18 },
      { x: 1760, y: 460, w: 200, h: 18 },
      { x: 1980, y: 300, w: 180, h: 18 },
      { x: 2140, y: 640, w: 220, h: 18 },
      { x: 700, y: 240, w: 160, h: 18 },
      { x: 1320, y: 180, w: 140, h: 18 }
    ],
    crates: [
      crate(260, gy - 40), crate(900, gy - 40), crate(940, gy - 40),
      crate(1600, gy - 40), crate(2200, gy - 40), crate(2240, gy - 40),
      crate(200, 640 - 40), crate(600, 560 - 40), crate(920, 420 - 40),
      crate(1200, 280 - 40), crate(1580, 620 - 40), crate(1820, 460 - 40),
      crate(2040, 300 - 40), crate(2200, 640 - 40)
    ],
    spawns: [
      { x: 200, y: 760 }, { x: 700, y: 760 }, { x: 1200, y: 760 }, { x: 1700, y: 760 },
      { x: 2300, y: 760 }, { x: 240, y: 600 }, { x: 640, y: 520 }, { x: 960, y: 380 },
      { x: 1600, y: 580 }, { x: 2060, y: 260 }
    ],
    silos: [
      { x: 70, w: 100, h: 340 }, { x: 480, w: 80, h: 260 }, { x: 1080, w: 90, h: 300 },
      { x: 1560, w: 70, h: 240 }, { x: 2080, w: 110, h: 320 }, { x: 2420, w: 70, h: 200 }
    ],
    lootSpots: [
      [220, 600], [250, 440], [200, 280], [640, 520], [940, 380],
      [1220, 240], [760, 200], [1380, 140], [1600, 580], [1840, 420],
      [2060, 260], [2220, 600], [400, gy - 20], [1100, gy - 20], [1900, gy - 20]
    ]
  };

  ZC.Maps.register(arenaIndustrial.id, arenaIndustrial);
  ZC.Maps.register(muelle.id, muelle);
  ZC.Maps.register(azoteas.id, azoteas);
  ZC.Maps.use("arena-industrial");
})(typeof window !== "undefined" ? window : globalThis);
