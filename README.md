# Zona Cero

Prototipo jugable de shooter táctico en vista lateral, estilo battle royale local. La zona se cierra, gana el último superviviente. Al abrirlo se ve el logo, una carga corta y luego el lobby. Hay lobby (mochila, aspecto, mapas y ajustes), fusil y escopeta, bots, cobertura y controles de PC y celular.

**Cómo jugar en el celular:** abre el enlace del juego y gira el teléfono a horizontal. En un computador, también puedes abrir `index.html` con doble clic (Firefox, Chrome o Edge). No hace falta instalar nada.

## Mapa de archivos

| Archivo | Responsabilidad | Qué editar ahí |
| --- | --- | --- |
| `index.html` | Cáscara: canvas, menú, lobby, resultado, joysticks | Textos de las pantallas |
| `css/style.css` | Colores de UI (paleta tierra en `:root`), lobby, overlays, táctil, regla `[hidden]` | Diseño de menús y botones |
| `js/zc.js` | Namespace `ZC` / `ZonaCero`, utilidades, estado compartido | Casi nunca (es el cimiento) |
| `js/config.js` | Números: gravedad, salto, velocidad, cantidad de bots | Sensación de movimiento |
| `js/weapons.js` | Fichas del fusil y la escopeta; dónde va el arma en la mano (`ZC.GUN_RIG`) | Daño, cadencia, cargador, largo del cañón |
| `js/maps.js` | Mapas (plataformas, cajas, spawns, loot, imagen de fondo) | Diseñar o añadir un mapa |
| `js/entities.js` | Crear jugadores, bots, partículas y botín | Cómo nace un personaje o un item |
| `js/physics.js` | Suelo, cajas, plataformas, salto y doble salto | Colisiones y salto |
| `js/combat.js` | Disparo, recarga, balas, daño, muerte | Reglas de combate |
| `js/zone.js` | Fases y radio de la zona | Ritmo del cierre |
| `js/bots.js` | Inteligencia local (pelean entre sí y huyen de la zona) | Dificultad de los bots |
| `js/player.js` | Crear al jugador y aplicar su perfil | Spawn del jugador |
| `js/drop.js` | Caída en paracaídas con cuenta 3-2-1 al empezar | Duración, altura y aspecto de la caída |
| `js/input.js` | Teclado, ratón, joysticks y layout táctil | Cambiar teclas o arrastre de botones |
| `js/audio.js` | Sonidos sintéticos y silencio | Tonos |
| `js/appearance.js` | Forma y aspectos del personaje | Casco, torso, un aspecto nuevo |
| `js/render.js` | Cámara, fondo con imagen, mundo y HUD (`ZC.PALETTE`, `ZC.hudLayout`) | Estética del escenario y dónde va cada panel |
| `js/ui.js` | Mostrar/ocultar menú, lobby y resultado; pantalla completa | Registrar pantallas |
| `js/lobby.js` | Sala, perfil, mochila, mapa y ajustes; vista del personaje con su arma | Flujo del lobby |
| `js/boot.js` | Entrada: logo, carga real de mapas y paso al lobby | Duración de la presentación y la carga |
| `js/game.js` | Partida: inicio, victoria/derrota, bucle | Flujo general |
| `assets/maps/` | Imágenes de fondo de cada mapa (WebP) | Cambiar el paisaje de un mapa |
| `assets/logo.svg` | Logo de Zona Cero (entrada, lobby y favicon); `logo-192.png` es el ícono del celular | Cambiar el logo |

Más detalle técnico en `ARCHITECTURE.md`.

## Cómo abrir y jugar

### PC
Doble clic en `index.html`, o visita la página publicada. Primero sale el logo y una carga corta (un clic o Enter la acorta) y luego el lobby. La flecha del lobby abre el menú con los controles. Controles: WASD o flechas, espacio/W/↑ para saltar (doble salto), ratón para apuntar y disparar, R recarga, 1/2 (o Q) cambia el arma, M silencio.

### Celular
Horizontal. Joystick izquierdo: mover. Derecho: apuntar y disparar. Botones Salto, Rec y Arma junto al joystick derecho. En el lobby, Ajustes permite mover y cambiar el tamaño de esos controles.

Al tocar Iniciar el juego pide pantalla completa (Android/Chrome; en iPhone Safari no existe para páginas web) y empieza la caída: todos bajan en paracaídas con una cuenta 3-2-1. Con el joystick izquierdo guías la caída hacia los lados. Al llegar a 0 aterrizas, aparece «A COMBATIR» y ya puedes disparar.

HUD en horizontal, como PUBG Mobile: arriba a la izquierda silencio, pantalla completa y el registro de bajas; arriba al centro tiempo y vivos; arriba a la derecha minimapa y TOP 3; abajo al centro vida, arma y munición, entre los dos joysticks.

Los scripts son clásicos (`<script src="js/...">`), no módulos ES, precisamente para que `file://` funcione sin CORS y sin empaquetar.

## Orden de los scripts (no lo cambies a la ligera)

El orden está en `index.html` y también en `ZC.SCRIPT_ORDER` (`js/zc.js`):

`zc` → `config` → `weapons` → `maps` → `entities` → `physics` → `combat` → `zone` → `bots` → `player` → `drop` → `input` → `audio` → `appearance` → `render` → `ui` → `lobby` → `boot` → `game`

`zc.js` tiene que ir primero. `game.js` el último (monta el juego y publica la API).

## Qué cambiar según lo que quieras

- **Armas:** `js/weapons.js`. Para añadir un arma: `ZC.registerWeapon(...)` (con `barrel`, el largo hasta la boca) y ponla en la mochila del lobby o en el loot. Las balas salen solas de la boca del arma (`ZC.gunRig`).
- **Mapas:** `js/maps.js`. Copia un mapa existente (`platforms`, `crates`, `spawns`, `silos`, `lootSpots`, `blurb`, `backgroundImage`, `bgFallback`), `ZC.Maps.register("otro", def)`. El lobby lo lista solo. El paisaje es una imagen en `assets/maps/`; las pasarelas y cajas se dibujan encima (ver `ARCHITECTURE.md`).
- **Aspectos:** `js/appearance.js` → `ZC.Appearance.register`.
- **Controles de teclado:** `js/input.js` → `ZC.Input.bindings`. El layout táctil se guarda con el perfil.
- **Diseño / HUD:** `css/style.css` (variables de color en `:root`) y `js/render.js` (`ZC.PALETTE`). Estilo actual: tierra, oliva, óxido y arena, sin neón. No quites `[hidden] { display: none !important; }`: si no, el panel de derrota se queda encima del juego.
- **Bots y zona:** `js/bots.js`, `js/config.js` (`botCount`), `js/zone.js`. En el lobby también se elige cuántos rivales hay.

## Trabajo en paralelo

Regla práctica: **cada persona un módulo**. Ejemplo: uno en `weapons.js`, otro en `maps.js`, otro en `appearance.js`. No editen `js/zc.js` a la vez. Los contratos de cada archivo están al principio (bloque «Contrato» / «Depende de»).

## Pruebas

```bash
node tests/smoke.js
```

Comprueban el orden de los archivos, que cada JS parsea, que no hay CDN, el arreglo de overlays `[hidden]`, la lógica de salto, disparo, cobertura, zona, victoria/derrota y reinicio, el lobby (aspectos y mapas), que cada mapa tiene su imagen de fondo, que ya no queda el cian neón, que los paneles del HUD no se pisan en pantallas de celular horizontal (844x390 y otras), la caída con cuenta 3-2-1, la entrada (logo → carga → lobby, sin colgarse ni fingir 100 %) y que las balas salen de la boca del arma (todas las armas y aspectos, jugador y bots).

La prueba de navegador también recorre la entrada (logo, carga y lobby), comprueba que la bala nace en el cañón, abre el juego como un celular horizontal de 844x390 y comprueba que joysticks, botones y paneles no se solapan, que en la caída no se dispara y que se aterriza al llegar a 0.

En navegador real (opcional, necesita `uv` y Chrome):

```bash
python3 -m http.server 8765 --bind 127.0.0.1 &
uv run --with playwright python tests/browser.py
```

## Limitaciones

- Un jugador, bots locales, sin red y sin anuncios.
- Audio sintético.
- Los personajes y las pasarelas se dibujan con código; solo el paisaje de fondo es imagen. La carpeta sigue viajando sola (las imágenes van en `assets/maps/`).
- No hay empaquetador.

---

Prototipo offline. Sin multijugador. Sin anuncios. Nombre provisional: Zona Cero.
