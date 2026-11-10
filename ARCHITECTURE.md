# Arquitectura de Zona Cero (modular)

## Decisión: scripts clásicos, no ES modules

Se usa el namespace global `window.ZC` (también `window.ZonaCero`) y etiquetas `<script src>` en orden. Así el juego abre con `file://` sin servidor y sin errores CORS de `import`. No hay bundler ni dependencias de red.

## Namespace y estado compartido

`js/zc.js` crea el objeto y **no debe sustituirse**. El resto de archivos añaden funciones o tablas:

| Campo | Tipo | Quién lo muta |
| --- | --- | --- |
| `ZC.state` | `"title" \| "playing" \| "over"` | `game.js`, `ui.js`, `lobby.js` |
| `ZC.profile` | nombre, aspecto, mapa, mochila, ajustes | `lobby.js` (`loadProfile` / `saveProfile`) |
| `ZC.actors`, `ZC.player` | combatientes | `game.js`, `player.js`, `entities.js` |
| `ZC.bullets`, `ZC.loots`, `ZC.particles` | listas | `combat.js`, `entities.js` |
| `ZC.zone` | círculo seguro | `zone.js` |
| `ZC.input`, `ZC.keys`, `ZC.touch` | controles | `input.js` |
| `ZC.map` | mapa activo | `maps.js` (`Maps.use`) |
| `ZC.CFG`, `ZC.WEAPONS` | datos | `config.js`, `weapons.js` |
| `ZC.Appearance` | aspectos y dibujo del personaje | `appearance.js` |
| `ZC.canvas`, `ZC.ctx` | render | `game.js` (mount), `render.js`, `appearance.js`, `lobby.js` (vista previa) |
| `ZC.muted`, `ZC.audioCtx` | audio | `audio.js` |

No reemplaces los arrays (`ZC.actors = []`): vacíalos con `.length = 0` (así lo hace `clearSim`). `ZC.player` sí se reasigna al empezar una partida.

## Contratos por módulo

- **config:** solo datos numéricos.
- **weapons:** fichas y `registerWeapon` / `copyLoadout`. El disparo vive en combat.
- **maps:** `ZC.Maps.register(id, def)` y `ZC.Maps.use(id)`. Un mapa trae `platforms`, `crates`, `spawns`, `silos`, `lootSpots`, `backgroundImage`, `bgFallback` y, si se quiere, `blurb`. Mapas actuales: `arena-industrial`, `muelle`, `azoteas`. `ZC.Maps.preload()` y `ZC.Maps.imageFor(def)` manejan las imágenes de fondo.
- **entities:** fábricas (`makeActor`, `spawnLoot`, partículas).
- **physics:** `collideWorld`, `tryJump`, `controlActor` (esta última dispara/recarga llamando a combat).
- **combat:** proyectiles, daño, muerte (suelta loot) y `pickLoot`. Llama `ZC.checkWinner` al matar.
- **zone:** script de fases e `inZone`. El daño lo aplica `game.update` leyendo `ZC.zone.dps`.
- **bots:** `thinkBot`; no pinta ni cambia reglas de daño.
- **player:** `spawnPlayer`, `updatePlayer`. Aplica `ZC.applyProfile` al nacer el jugador.
- **drop:** `ZC.Drop.start(dur)`, `update(dt, moveX)`, `active()`, `count()`, `skip()`, `surfaceBelow(x, y)`, más `ZC.drawDropWorld` (paracaídas) y `ZC.drawDropHUD` (cuenta 3-2-1 y «A COMBATIR»). No decide daño ni toca la zona.
- **input:** `bindInput`, `readPlayerInput`, `ZC.Input.bindings`. También layout táctil (`applyControlLayout`, `beginLayoutEdit`).
- **audio:** `sfx`, `toggleMute`, `unlockAudio`.
- **appearance:** forma del personaje (`ZC.Appearance.draw`, `register`, `get`, `list`). No decide daño ni input.
- **render:** cámara (`camFeetRatio`, `camMaxY`), escenario, proyectiles, zona y HUD (`hudLayout`). Llama a `ZC.Appearance.draw` para el cuerpo y a `drawDropWorld` / `drawDropHUD` durante la caída.
- **ui:** overlays DOM (`hidden` + clase `active`). `ZC.UI.screens` incluye `title`, `lobby` y `result`. También `setInMatch` (clase `#app.in-match`) y la pantalla completa (`requestFullscreen`, `toggleFullscreen`).
- **lobby:** perfil, sala, paneles (mochila, aspecto, mapa, ajustes) y `startFromLobby`.
- **game:** `startMatch`, `endMatch`, `update`, `loop`, `mount`, API pública y `ZC.__test`.

## Puntos de extensión

1. **Nueva pantalla:** crear el overlay en `index.html` (con `hidden`), registrarlo en `ZC.UI.screens` y mostrarlo con `ZC.UI.show("id")`. El arreglo CSS `[hidden] { display: none !important; }` tiene que seguir ahí.
2. **Nuevo mapa:** `ZC.Maps.register` + listarlo en el lobby con `ZC.Maps.list()`. Cada mapa tiene una imagen de fondo (ver «Fondos con imagen» más abajo). Las cajas y plataformas siguen siendo datos para la física y se dibujan encima.
3. **Nueva arma:** `ZC.registerWeapon` y entregarla por loot, loadout o la mochila del lobby.
4. **Nuevo aspecto:** `ZC.Appearance.register` en `js/appearance.js`. El lobby lo lista solo.
5. **Controles:** `ZC.Input.bindings` para teclado. El layout táctil se guarda en `ZC.profile.layout`.

## Fondos con imagen (v1.3)

- Archivos en `assets/maps/` (WebP 1636×920, unos 80 KB). La imagen es solo decorado: no tiene colisiones.
- En `js/maps.js` cada mapa declara `backgroundImage: "assets/maps/<nombre>.webp"` y `bgFallback: [cielo, medio, suelo]`.
- `ZC.Maps.preload()` corre al cargar `maps.js` y crea un `Image` por mapa (guardadas en `ZC.Maps.images`). Así, al pulsar Iniciar la imagen ya está lista y no parpadea.
- `render.js` → `ZC.drawBackdrop()`: pinta el degradado `bgFallback`, luego la imagen con `ZC.backdropRect(img)` y una sombra leve (`ZC.PALETTE.shadeImage`) para que los personajes se lean. Después `drawWorld()` pinta suelo, pasarelas y cajas.
- Parallax: la imagen mide el alto del mundo (920) y se desplaza más lento que la cámara. Con la cámara a la izquierda se ve el borde izquierdo de la imagen; a la derecha, el borde derecho. Una imagen 16:9 basta para el mundo de 2600 de ancho.
- Para un mapa nuevo: genera o dibuja una imagen 16:9 en vista lateral, sin texto, con el suelo en la franja de abajo, expórtala a WebP y ponla en `backgroundImage`.
- Los colores del escenario (suelo, acero, franjas) están juntos en `ZC.PALETTE`, al principio de `render.js`.

## HUD y cámara en celular horizontal (v1.4)

- `ZC.hudLayout()` (en `js/render.js`) devuelve el rectángulo de cada panel en px CSS: `timer`, `minimap`, `top3`, `vitals`, `feed` y `warnY`. `drawHUD` dibuja solo con esos números y las pruebas los comparan con los botones táctiles. Si mueves un panel, cámbialo ahí.
- Modo compacto cuando el alto es menor de 500 px (celular en horizontal). Los botones DOM tienen su propio bloque `@media (max-height: 500px)` en `css/style.css`. Si cambias el tamaño de los botones de la derecha, ajusta también el hueco reservado en `hudLayout` (266 px desde el borde derecho en compacto).
- Márgenes de la muesca: el div `#safe-probe` lleva `padding: env(safe-area-inset-*)`; `ZC.readSafeArea()` lo lee en cada `resize` y guarda `ZC.safe`.
- `#app.in-match` (lo pone `ZC.setInMatch`) mueve silencio y pantalla completa arriba a la izquierda durante la partida; en el menú y el lobby el silencio sigue arriba a la derecha.
- Cámara: `ZC.camFeetRatio()` dice a qué altura de pantalla van los pies del jugador (0.58 en compacto, 0.64 en PC, 0.8 durante la caída). `ZC.camMaxY()` deja que la cámara baje más que el mundo para lograrlo; `drawWorld` pinta la tierra hasta el borde de la vista.

## Caída con cuenta regresiva (v1.4)

- `startMatch` crea a todos como antes y llama `ZC.Drop.start(ZC.CFG.dropTime)`. Cada actor sube a lo alto (`TOP_Y` en `js/drop.js`) sobre su punto de aparición y cae a velocidad fija calculada con `surfaceBelow`, para tocar tierra justo en el 0.
- Mientras `ZC.Drop.active()`, `game.update` solo mueve la caída, las partículas y la cámara: no corre el reloj, ni la zona, ni piensan los bots, y nadie dispara. El jugador puede guiarse en horizontal.
- Al terminar, `ZC.Drop.state.go` (0.9 s) muestra «A COMBATIR». En ese rato el jugador ya juega y los bots esperan quietos.
- `ZC.state` sigue siendo `"playing"` durante la caída (las pruebas y el resto del código no cambian). `getState().drop` informa `on`, `count`, `t` y `dur`. `ZC.__test.skipDrop()` la salta. Con `ZC.CFG.dropTime = 0` no hay caída.

## Dependencias de carga

`zc` → `config` → `weapons` / `maps` → `entities` → `physics` / `combat` / `zone` → `bots` / `player` → `drop` → `input` / `audio` → `appearance` → `render` / `ui` → `lobby` → `game`.

Las llamadas entre módulos (por ejemplo physics → `ZC.fireWeapon`) ocurren en runtime, cuando todos los scripts ya cargaron. Por eso `game.js` va al final.

## API pública (pruebas y consola)

`ZonaCero.mount`, `startMatch`, `goMenu`, `openLobby`, `startFromLobby`, `update`, `draw`, `getState`, `utils`, `cfg`, `weapons`, `__test`. Compatible con las pruebas de lógica de la v1.

## Overlays

`.overlay { display: flex }` pisa el `[hidden]` del navegador. Por eso `css/style.css` fuerza `[hidden] { display: none !important; }`. `hideOverlay` pone `hidden = true` y quita `.active`. El lobby usa además `#lobby-screen.lobby-shell { display: block }` cuando no está `hidden`.
