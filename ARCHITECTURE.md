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
- **maps:** `ZC.Maps.register(id, def)` y `ZC.Maps.use(id)`. Un mapa trae `platforms`, `crates`, `spawns`, `silos`, `lootSpots` y, si se quiere, `blurb`. Mapas actuales: `arena-industrial`, `muelle`, `azoteas`.
- **entities:** fábricas (`makeActor`, `spawnLoot`, partículas).
- **physics:** `collideWorld`, `tryJump`, `controlActor` (esta última dispara/recarga llamando a combat).
- **combat:** proyectiles, daño, muerte (suelta loot) y `pickLoot`. Llama `ZC.checkWinner` al matar.
- **zone:** script de fases e `inZone`. El daño lo aplica `game.update` leyendo `ZC.zone.dps`.
- **bots:** `thinkBot`; no pinta ni cambia reglas de daño.
- **player:** `spawnPlayer`, `updatePlayer`. Aplica `ZC.applyProfile` al nacer el jugador.
- **input:** `bindInput`, `readPlayerInput`, `ZC.Input.bindings`. También layout táctil (`applyControlLayout`, `beginLayoutEdit`).
- **audio:** `sfx`, `toggleMute`, `unlockAudio`.
- **appearance:** forma del personaje (`ZC.Appearance.draw`, `register`, `get`, `list`). No decide daño ni input.
- **render:** cámara, escenario, proyectiles, zona y HUD. Llama a `ZC.Appearance.draw` para el cuerpo.
- **ui:** overlays DOM (`hidden` + clase `active`). `ZC.UI.screens` incluye `title`, `lobby` y `result`.
- **lobby:** perfil, sala, paneles (mochila, aspecto, mapa, ajustes) y `startFromLobby`.
- **game:** `startMatch`, `endMatch`, `update`, `loop`, `mount`, API pública y `ZC.__test`.

## Puntos de extensión

1. **Nueva pantalla:** crear el overlay en `index.html` (con `hidden`), registrarlo en `ZC.UI.screens` y mostrarlo con `ZC.UI.show("id")`. El arreglo CSS `[hidden] { display: none !important; }` tiene que seguir ahí.
2. **Nuevo mapa:** `ZC.Maps.register` + listarlo en el lobby con `ZC.Maps.list()`. Los mapas de hoy se dibujan con formas en `render.js` (plataformas, cajas, silos). Más adelante se puede poner una imagen de fondo o teselas: añade `backgroundImage` (o un atlas) en la definición del mapa y, en `render.js`, `ctx.drawImage` detrás de las colisiones. Las cajas y plataformas pueden seguir siendo datos, o una capa de colisión aparte. Así se ahorra código de decorado sin cambiar la física.
3. **Nueva arma:** `ZC.registerWeapon` y entregarla por loot, loadout o la mochila del lobby.
4. **Nuevo aspecto:** `ZC.Appearance.register` en `js/appearance.js`. El lobby lo lista solo.
5. **Controles:** `ZC.Input.bindings` para teclado. El layout táctil se guarda en `ZC.profile.layout`.

## Dependencias de carga

`zc` → `config` → `weapons` / `maps` → `entities` → `physics` / `combat` / `zone` → `bots` / `player` → `input` / `audio` → `appearance` → `render` / `ui` → `lobby` → `game`.

Las llamadas entre módulos (por ejemplo physics → `ZC.fireWeapon`) ocurren en runtime, cuando todos los scripts ya cargaron. Por eso `game.js` va al final.

## API pública (pruebas y consola)

`ZonaCero.mount`, `startMatch`, `goMenu`, `openLobby`, `startFromLobby`, `update`, `draw`, `getState`, `utils`, `cfg`, `weapons`, `__test`. Compatible con las pruebas de lógica de la v1.

## Overlays

`.overlay { display: flex }` pisa el `[hidden]` del navegador. Por eso `css/style.css` fuerza `[hidden] { display: none !important; }`. `hideOverlay` pone `hidden = true` y quita `.active`. El lobby usa además `#lobby-screen.lobby-shell { display: block }` cuando no está `hidden`.
