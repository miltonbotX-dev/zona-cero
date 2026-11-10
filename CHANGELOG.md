# Changelog

## 1.3.0 — estilo tierra/militar y mapas con imagen (10 nov 2026, America/Lima)

Cambio solo visual: la jugabilidad, el lobby y los ajustes de la 1.2 quedan igual.

- Fuera el tema neón. La interfaz (menú, lobby, resultado, botones, joysticks y HUD) pasa a una paleta tierra: fondos marrón oscuro, texto crema, acentos ámbar apagado y oliva. Sin brillos cian, sin `text-shadow` neón.
- Cada mapa tiene su imagen de fondo en `assets/maps/` (WebP, unos 80 KB cada una): `industrial.webp` (planta al atardecer), `muelle.webp` (puerto nublado) y `azoteas.webp` (ciudad en ruinas al atardecer).
- `js/maps.js`: cada mapa declara `backgroundImage` y `bgFallback` (tres tonos tierra). `ZC.Maps.preload()` carga las imágenes al abrir la página y `ZC.Maps.imageFor()` solo devuelve la imagen cuando ya cargó.
- `js/render.js`: el fondo se dibuja primero, con un poco de parallax para que una imagen 16:9 cubra todo el mundo. Mientras carga se ve un degradado tierra (ya no el cielo nocturno). Se quitan la luna, las estrellas, las ventanas encendidas y la niebla fría. Suelo, pasarelas y cajas se repintan en tonos acero gastado y madera, sin la línea cian.
- La zona, el minimapa y los nombres usan crema y ámbar en lugar de cian. El exterior de la zona se oscurece en marrón rojizo.
- Aspectos: Operativo pasa a oliva con visor ámbar, Sombra a gris carbón, Pesado se mantiene terroso. Sin glow en los visores. Colores de bots, armas y botín más apagados.
- Pruebas: 191 de humo (`node tests/smoke.js`, 35 nuevas sobre fondos y paleta) y 30 en navegador (`tests/browser.py`).


## 1.2.0 — lobby, aspectos y mapas (9 nov 2026, America/Lima)

Cambios de Amilthon sobre la edición modular, más un arreglo mínimo para que el lobby se anime.

- Se añade un lobby al pulsar Jugar: nombre, mochila, aspecto, mapa, vida, rivales y tamaño de los controles táctiles. El perfil se guarda en el celular (`localStorage`).
- Nueva pantalla de sala (`index.html` + `css/style.css` + `js/lobby.js`) y `ZC.UI.screens.lobby`.
- La forma del personaje sale de `js/appearance.js` (`ZC.Appearance.draw`). Tres aspectos: Operativo, Sombra y Pesado.
- Dos mapas nuevos en `js/maps.js`: Muelle norte y Azoteas, eligibles desde el lobby. El mapa industrial se mantiene.
- Los controles táctiles se pueden mover y redimensionar. El salto táctil ya no consume el doble salto al mantener pulsado.
- Arreglo: la vista previa del lobby usaba el tiempo de una partida anterior, así que el personaje se quedaba quieto. Ahora usa su propio reloj (`ZC.lobbyPreviewT`).
- Pruebas de humo actualizadas (156 ok), incluyendo lobby, aspectos y mapas.

## 1.1.0 — edición modular (7 nov 2026, America/Lima)

- El prototipo jugable se separa en `index.html`, `css/style.css` y 15 scripts clásicos bajo el namespace `ZC`.
- Se conserva la jugabilidad de la v1: arena lateral, salto/doble salto, bots, dos armas, loot, zona que se cierra, último superviviente, PC y táctil, audio silenciable.
- Se mantiene el arreglo del overlay de derrota: `[hidden] { display: none !important; }`.
- Puntos de extensión documentados (sin pantallas a medias) para lobby, inventario, mapas extra y controles: `ZC.UI.screens`, `ZC.Maps.register`, `ZC.registerWeapon`, `ZC.Input.bindings`.
- La v1 de un solo archivo permanece intacta en `/workspace/battle2d-prototype/`.

## 1.0.0 — prototipo standalone

- HTML único autocontenido con combate completo y pantalla inicial en español.
- Corrección posterior: el panel de resultado se quedaba visible porque `display: flex` de `.overlay` anulaba el atributo `hidden`.
