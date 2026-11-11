# Changelog

## 1.6.0 — ZCero: videos de entrada e íconos en los botones (11 nov 2026, America/Lima)

Construida sobre la versión que editó Amilthon: se mantienen su nombre «ZCero», su logo nuevo («Logo Multitemporal»), «Battle royale», «©Amilthon company», «Último superviviente» (con tilde), «Fin de la partida», el texto corto del menú e «Inventario» en lugar de «Mochila». Lobby, caída 3-2-1, HUD de celular, mapas con imagen y balas desde el cañón quedan igual.

- Nombre del juego en un solo lugar: `ZC.BRAND` en `js/zc.js` (nombre, línea, compañía y firma del creador). `ZC.applyBrand` lo copia a todo lo que tenga `data-brand` en `index.html` y al título de la pestaña. Para renombrar el juego cuando elijas la temática, se cambia ahí.
- Nueva entrada (`js/boot.js`): primero el video del creador (`assets/creadorAmilthon.mp4`) con la firma «Creado por AMILTHON» pequeña abajo, que aparece suave a los 3 s bajo el murciélago; luego la animación de intro (`assets/intro.mp4`, cuadrada, centrada sobre negro); después la barra de carga con el logo, «Toca para entrar» y el lobby. La presentación vieja de 1,4 s con el logo se quitó (el logo sigue en la carga).
- Los videos arrancan sin sonido (los navegadores no dejan otra cosa). El primer toque activa el sonido, también para la intro; el botón de parlante lo apaga o prende y «Saltar» pasa al siguiente. Si el juego está en silencio (M), los videos siguen callados.
- La entrada nunca se cuelga: si un video da error, falta, no arranca en 6 s, se traba 3,5 s o el navegador lo bloquea (ahorro de batería), se salta solo. Si el navegador lo bloquea, se ve un botón de play por si quieres verlo.
- Los mapas se siguen bajando mientras corren los videos, así la carga suele ser corta. La intro se empieza a bajar mientras corre el video del creador.
- Íconos en lugar de texto (SVG dibujados dentro de `index.html`, sin internet, sin emojis ni fuentes de íconos): Inventario, Aspecto y Ajustes del lobby (con un rótulo pequeño debajo), Iniciar (triángulo de play grande), atrás, engranaje (ya no puede salir como emoji), cerrar panel (X), silencio (parlante que se tacha en rojo), pantalla completa, Jugar y Controles del menú, Otra vez y Menú al final, Listo y Restaurar al mover controles, Mover y Restaurar en Ajustes, Dejar/Llevar (menos/más) en Inventario, y Salto (doble flecha), Recargar y Cambiar arma en la partida. Todos con `aria-label` y `title`.
- Lobby más pulido: esquinas redondeadas, sombra suave, el botón del panel abierto se marca en ámbar, estados al pasar el dedo o el ratón y al presionar, deslizadores en ámbar y miniatura de fondo en cada mapa de la lista. Se corrigieron estilos de letra que el navegador ignoraba (`font: … inherit`).
- Arreglado: en el celular, al tocar el lobby se veían los joysticks y botones de la partida detrás de la sala. Ahora solo aparecen al empezar la partida.
- Barra del navegador en Android: verde oliva del logo (`#4f5c42`) en lugar de «green».
- `index.html` pide todo con `?v=1.6.0`.
- Pruebas: 329 de humo (`node tests/smoke.js`: videos en orden, sonido tras el toque, Saltar, video bloqueado, trabado, con error o ausente, íconos con nombre accesible, joysticks ocultos en el lobby) y 84 en navegador (`tests/browser.py`: los dos videos se reproducen, firma bien ubicada en 1280x720, 844x390 y 390x844, flujo completo sin tocar, íconos del lobby y panel).

## 1.5.0 — entrada tipo PUBG Mobile y balas desde el cañón (10 nov 2026, America/Lima)

Primera tanda del camino hacia un PUBG Mobile en 2D: la entrada al juego. Lobby, aspectos, mapas con imagen, HUD de celular, caída 3-2-1 y controles arrastrables de la 1.2 a la 1.4 quedan igual. La agresividad de los bots no cambia.

- Nueva entrada (`js/boot.js`, `#boot-screen`): al abrir la página sale una presentación con el logo de Zona Cero, luego una pantalla de carga y después el lobby. Ya no se pasa por el menú viejo.
- La carga es real: espera el logo y la imagen de fondo de cada mapa. La barra sube suave pero nunca muestra más de lo que de verdad cargó. Si algo tarda más de 9 s entra igual con el porcentaje real y lo dice («Algunos fondos siguen cargando»); no se queda colgada.
- Un toque (o Enter) acorta la presentación; con todo listo sale «Toca para entrar» y, si no tocas, pasa sola en menos de un segundo.
- En retrato, el aviso de girar el celular espera a que termine la entrada en lugar de taparla.
- Logo propio (`assets/logo.svg`): anillo de zona ámbar, mira y una Z de plantilla sobre oliva. Es la insignia del lobby y el favicon (antes era un favicon vacío). `assets/logo-192.png` queda como ícono del celular.
- Lobby más cuidado: el personaje está quieto con el arma en la mano (antes caminaba en el sitio) y cada pocos segundos hace un disparo de muestra con fogonazo y estela desde la boca del arma. Junto a él, una ficha «En mano» con el arma, su munición y lo que llevas en la mochila (tocarla abre Mochila). La ficha del mapa lleva de fondo la miniatura del mapa. Mochila, Aspecto, Ajustes e Iniciar siguen donde estaban.
- El menú con los controles sigue disponible desde la flecha del lobby.
- Arreglado: las balas salían de la cintura. Ahora salen de la boca del arma, con el jugador y con los bots, con fusil y escopeta y con los tres aspectos. Hay una sola geometría para dibujar el arma y para disparar (`ZC.GUN_RIG` / `ZC.gunRig` en `js/weapons.js`); el fogonazo, la estela y las chispas nacen en el mismo punto.
- El personaje se voltea hacia donde apunta (antes, al apuntar a la izquierda, el arma cruzaba el cuerpo). El arma va a la altura del pecho y la puntería del ratón se mide desde ahí, así la bala pasa por el cursor.
- Las balas golpean el cuerpo como se dibuja (de los pies al casco, `ZC.CFG.hurtH`); antes solo contaban las piernas y el torso bajo. Moverse y saltar no cambia. Una caja delante sigue frenando un disparo recto.
- `index.html` pide todo con `?v=1.5.0`.
- Pruebas: 326 de humo (`node tests/smoke.js`, 49 nuevas sobre la entrada, el logo y el origen de las balas) y 62 en navegador (`tests/browser.py`, 17 nuevas: presentación, carga sin mentir, paso al lobby, retrato, bala desde el cañón en PC y celular, lobby sin solapes en 844x390).

## 1.4.0 — pantalla de celular ordenada y caída con cuenta regresiva (10 nov 2026, America/Lima)

Primer paso hacia un PUBG Mobile en 2D. Lobby, aspectos, mapas con imagen, ajustes y controles arrastrables de la 1.2 y la 1.3 quedan igual.

- HUD reordenado para celular horizontal (`ZC.hudLayout` en `js/render.js`): minimapa arriba a la derecha con el TOP 3 debajo (ya no se pisan), tiempo y vivos arriba al centro, registro de bajas arriba a la izquierda y vida, arma y munición abajo al centro, entre los joysticks. Antes el joystick izquierdo tapaba la caja de vida.
- La vida muestra el número y la munición se lee más grande (cargador en grande, reserva al lado). El aviso de zona pasa bajo el cronómetro.
- En partida, el botón de silencio pasa arriba a la izquierda (antes tapaba la esquina del TOP 3). Ya no usa emoji: el mismo ♪ se tacha cuando está en silencio.
- Nuevo botón de pantalla completa junto al silencio, y el juego la pide solo al tocar Iniciar en el celular (Android/Chrome; iPhone Safari no la permite).
- Controles táctiles en pantallas bajas (`@media (max-height: 500px)`): joysticks en las esquinas y Salto (más grande), Rec y Arma en arco junto al joystick derecho, respetando los bordes de la muesca (`env(safe-area-inset-*)`).
- Cámara: en celular horizontal los pies del jugador quedan al 58 % de la altura (antes casi abajo del todo), así el que está en el suelo ya no queda bajo los joysticks. La cámara puede bajar un poco más allá del mundo y esa franja se pinta como tierra.
- Nueva caída al empezar (`js/drop.js`): todos bajan en paracaídas sobre el mapa con una cuenta 3-2-1 grande, anillo de progreso, altímetro y franjas de cine. Con el joystick izquierdo (o A / D) guías la caída. Durante la caída no hay disparos, ni zona, ni reloj. Cada uno toca tierra justo en el 0, aparece «A COMBATIR» y los bots esperan ese instante antes de disparar.
- Sonidos nuevos: tic de la cuenta y golpe de aterrizaje.
- `ZC.CFG.dropTime` (3 s) controla la caída; con 0 se vuelve al arranque de antes.
- `index.html` pide CSS y JS con `?v=1.4.0` para que el celular no se quede con la versión anterior en caché.
- Pruebas: 277 de humo (`node tests/smoke.js`, 86 nuevas sobre HUD, cámara y caída) y 45 en navegador (`tests/browser.py`, 15 nuevas: HUD sin solaparse en 844x390, caída, aterrizaje y los 3 mapas).

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
