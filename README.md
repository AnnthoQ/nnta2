# Parada de planta · TA2 Negociación y Narrativa

Presentación web del **caso 4** (Grupo 13, sección 25181) con control remoto desde el celular.
Estilo iOS: fondo negro, tarjetas de vidrio y cada elemento aparece paso a paso.

| Página | Para qué sirve |
|---|---|
| `index.html` | Pantalla del proyector. Muestra la lámina y el paso actuales. |
| `control.html` | Panel para el celular (o la laptop): vista previa, guion de cada paso, láminas y preguntas probables. |

`index.html?admin` redirige al panel, igual que en AI-EXPO.

## Cómo se usa en clase

1. Abre `index.html` en la computadora del proyector y pulsa **F** para pantalla completa.
2. En el celular abre `control.html`, escribe la clave del grupo y usa **Siguiente / Anterior**.
   También puedes deslizar sobre la vista previa.
3. Los dos celulares (Roy y Jhefferson) pueden controlar a la vez; ambos ven el mismo estado.

**Teclado del proyector** (respaldo si falla el celular): → o Espacio avanza, ← retrocede, **A** muestra toda la lámina,
**B** pone la pantalla en negro, **F** pantalla completa, **H** ayuda. Los clickers de presentación también funcionan.

### Modo local (sin internet ni Supabase)

Agrega `?local` a ambas páginas (`index.html?local` y `control.html?local`) y ábrelas en el **mismo navegador**,
por ejemplo el proyector en la pantalla extendida y el panel en la laptop.

## Puesta en marcha de Supabase

El control entre dispositivos usa Supabase Realtime. Mientras no exista la tabla, las páginas funcionan en modo local.

1. En el SQL Editor del proyecto ejecuta [`supabase/migrations/20261118000000_nnta2_state.sql`](supabase/migrations/20261118000000_nnta2_state.sql).
   Crea `nnta2_state` (lectura pública), `nnta2_secret` (sin acceso desde la API) y las funciones `nnta2_check`, `nnta2_set`
   y `nnta2_move` (avanza o retrocede un paso; la usa la app Android y no repite una pulsación reintentada).
2. Define la clave del panel ejecutando, con tu propia clave (no la subas al repositorio):

   ```sql
   insert into public.nnta2_secret (id, pin_hash)
   values ('ta2-caso4', extensions.crypt('TU_CLAVE', extensions.gen_salt('bf')))
   on conflict (id) do update set pin_hash = excluded.pin_hash;
   ```

La URL y la clave `anon` de `js/config.js` son públicas por diseño: solo permiten leer el estado y llamar a las funciones,
que exigen la clave del panel para cambiar de lámina.

## App Android (botones de volumen)

La app nativa **Control TA2** (proyecto aparte, `nnta2-remote`) mueve la presentación con los botones de volumen del
celular, incluso con la pantalla apagada: Volumen + avanza y Volumen − retrocede. Usa la función `nnta2_move` con la
misma clave del panel. Si cambias el número de pasos de una lámina en `js/deck.js`, actualiza también el arreglo
`steps` del final de la migración y vuelve a ejecutar ese `insert`.

## Estructura

```
css/ios.css        sistema visual (colores de iOS, vidrio, cápsulas, luces de fondo)
css/stage.css      escenario de 1920×1080, láminas y animaciones de revelado
css/control.css    panel del celular
js/deck.js         contenido: 12 láminas, pasos, guion por paso y preguntas probables
js/stage.js        dibuja las láminas y aplica {lámina, paso}
js/sync.js         sincronización (Supabase Realtime o BroadcastChannel en modo local)
js/proyector.js    lógica de la pantalla del proyector
js/control.js      lógica del panel
js/icons.js        íconos Ionicons 5 (MIT) en SVG
```

`respaldo/TA2_Caso4_respaldo.pptx` es la misma presentación en PowerPoint (estilo oscuro) por si falla la web.

Para editar el contenido, cambia `js/deck.js`: los elementos con `data-step="n"` aparecen en el paso *n* y
cada lámina necesita una nota de guion por paso (de 0 al último). Después sube el número `?v=` de los enlaces en
`index.html` y `control.html` para que GitHub Pages no sirva archivos viejos.

Basado en la idea de control remoto de [AI-EXPO](https://github.com/AnnthoQ/AI-EXPO).
Íconos: [Ionicons](https://ionic.io/ionicons) (MIT). Tipografía: SF Pro en dispositivos Apple; Inter en el resto.
