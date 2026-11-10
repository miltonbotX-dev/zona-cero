# Zona Cero

Prototipo jugable de shooter táctico en vista lateral, estilo battle royale local. La zona se cierra, gana el último superviviente. Hay lobby (mochila, aspecto, mapas y ajustes), fusil y escopeta, bots, cobertura y controles de PC y celular.

**Cómo jugar en el celular:** abre el enlace del juego y gira el teléfono a horizontal. En un computador, también puedes abrir `index.html` con doble clic (Firefox, Chrome o Edge). No hace falta instalar nada.

## Mapa de archivos

| Archivo | Responsabilidad | Qué editar ahí |
| --- | --- | --- |
| `index.html` | Cáscara: canvas, menú, lobby, resultado, joysticks | Textos de las pantallas |
| `css/style.css` | Colores de UI, lobby, overlays, táctil, regla `[hidden]` | Diseño de menús y botones |
| `js/zc.js` | Namespace `ZC` / `ZonaCero`, utilidades, estado compartido | Casi nunca (es el cimiento) |
| `js/config.js` | Números: gravedad, salto, velocidad, cantidad de bots | Sensación de movimiento |
| `js/weapons.js` | Fichas del fusil y la escopeta | Daño, cadencia, cargador |
| `js/maps.js` | Mapas (plataformas, cajas, spawns, loot) | Diseñar o añadir un mapa |
| `js/entities.js` | Crear jugadores, bots, partículas y botín | Cómo nace un personaje o un item |
| `js/physics.js` | Suelo, cajas, plataformas, salto y doble salto | Colisiones y salto |
| `js/combat.js` | Disparo, recarga, balas, daño, muerte | Reglas de combate |
| `js/zone.js` | Fases y radio de la zona | Ritmo del cierre |
| `js/bots.js` | Inteligencia local (pelean entre sí y huyen de la zona) | Dificultad de los bots |
| `js/player.js` | Crear al jugador y aplicar su perfil | Spawn del jugador |
| `js/input.js` | Teclado, ratón, joysticks y layout táctil | Cambiar teclas o arrastre de botones |
| `js/audio.js` | Sonidos sintéticos y silencio | Tonos |
| `js/appearance.js` | Forma y aspectos del personaje | Casco, torso, un aspecto nuevo |
| `js/render.js` | Dibujo del mundo y del HUD | Estética del escenario |
| `js/ui.js` | Mostrar/ocultar menú, lobby y resultado | Registrar pantallas |
| `js/lobby.js` | Sala, perfil, mochila, mapa y ajustes | Flujo del lobby |
| `js/game.js` | Partida: inicio, victoria/derrota, bucle | Flujo general |

Más detalle técnico en `ARCHITECTURE.md`.

## Cómo abrir y jugar

### PC
Doble clic en `index.html`, o visita la página publicada. Jugar abre el lobby. Controles: WASD o flechas, espacio/W/↑ para saltar (doble salto), ratón para apuntar y disparar, R recarga, 1/2 (o Q) cambia el arma, M silencio.

### Celular
Horizontal. Joystick izquierdo: mover. Derecho: apuntar y disparar. Botones Salto, Rec y Arma. En el lobby, Ajustes permite mover y cambiar el tamaño de esos controles.

Los scripts son clásicos (`<script src="js/...">`), no módulos ES, precisamente para que `file://` funcione sin CORS y sin empaquetar.

## Orden de los scripts (no lo cambies a la ligera)

El orden está en `index.html` y también en `ZC.SCRIPT_ORDER` (`js/zc.js`):

`zc` → `config` → `weapons` → `maps` → `entities` → `physics` → `combat` → `zone` → `bots` → `player` → `input` → `audio` → `appearance` → `render` → `ui` → `lobby` → `game`

`zc.js` tiene que ir primero. `game.js` el último (monta el juego y publica la API).

## Qué cambiar según lo que quieras

- **Armas:** `js/weapons.js`. Para añadir un arma: `ZC.registerWeapon(...)` y ponla en la mochila del lobby o en el loot.
- **Mapas:** `js/maps.js`. Copia un mapa existente (`platforms`, `crates`, `spawns`, `silos`, `lootSpots`, `blurb`), `ZC.Maps.register("otro", def)`. El lobby lo lista solo. Hoy el decorado es dibujado a mano; más adelante se pueden usar imágenes de fondo o teselas (ver `ARCHITECTURE.md`).
- **Aspectos:** `js/appearance.js` → `ZC.Appearance.register`.
- **Controles de teclado:** `js/input.js` → `ZC.Input.bindings`. El layout táctil se guarda con el perfil.
- **Diseño / HUD:** `css/style.css` y `js/render.js`. No quites `[hidden] { display: none !important; }`: si no, el panel de derrota se queda encima del juego.
- **Bots y zona:** `js/bots.js`, `js/config.js` (`botCount`), `js/zone.js`. En el lobby también se elige cuántos rivales hay.

## Trabajo en paralelo

Regla práctica: **cada persona un módulo**. Ejemplo: uno en `weapons.js`, otro en `maps.js`, otro en `appearance.js`. No editen `js/zc.js` a la vez. Los contratos de cada archivo están al principio (bloque «Contrato» / «Depende de»).

## Pruebas

```bash
node tests/smoke.js
```

Comprueban el orden de los archivos, que cada JS parsea, que no hay CDN, el arreglo de overlays `[hidden]`, la lógica de salto, disparo, cobertura, zona, victoria/derrota y reinicio, y el lobby (aspectos y mapas).

## Limitaciones

- Un jugador, bots locales, sin red y sin anuncios.
- Audio sintético.
- El escenario se dibuja con código (aún no hay sprites ni imágenes de mapa) para que la carpeta viaje sola.
- No hay empaquetador.

---

Prototipo offline. Sin multijugador. Sin anuncios. Nombre provisional: Zona Cero.
