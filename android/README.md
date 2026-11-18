# Control TA2 (Android)

Control remoto de diapositivas con los **botones de volumen** para la presentación web
[nnta2](https://github.com/AnnthoQ/nnta2). Funciona con la pantalla apagada y el teléfono en el bolsillo.

| Botón | Acción |
|---|---|
| Volumen + | Siguiente paso o lámina |
| Volumen − | Paso o lámina anterior |
| Botones de la pantalla / notificación | Respaldo de lo mismo |

Las pulsaciones no cambian el volumen del teléfono.

## Cómo funciona

- `RemoteService` es un servicio en primer plano (tipo `mediaPlayback`) con la notificación fija
  «Presentación en curso» (Anterior / Siguiente / Detener).
- Mantiene una `MediaSessionCompat` en reproducción remota con un `VolumeProviderCompat`
  (`VOLUME_CONTROL_RELATIVE`). Por eso Android le entrega las teclas de volumen aunque la pantalla esté apagada
  o la app en segundo plano, y el volumen real no cambia.
- Cada pulsación entra a una cola. Un hilo propio la envía a Supabase (`rpc/nnta2_move`) con un identificador
  único. Si se cae la red, se reintenta (0,5 s → 8 s, o apenas vuelve la red). El servidor ignora un reintento que
  ya se aplicó, así que no se pierden ni se duplican pasos.
- Antirrebote de 300 ms. Si se mantiene apretada una tecla, la autorrepetición se ignora.
- Una vibración corta = llegó al servidor. Dos = falló (se sigue reintentando solo).
- `SupabaseApi.kt` es la única clase que habla con el servidor.

## Credenciales

- El PIN del expositor se escribe en la app y vive solo en memoria. Al pulsar **Detener** se borra.
- Con «Recordar en este teléfono» se guarda cifrado (AES-GCM con una llave del Android Keystore que no sale del
  teléfono). Si se desactiva, se borra.
- La URL, la clave pública `anon` y el id de la presentación vienen de `local.properties` (no se sube a git) y se
  pueden cambiar en la pantalla de entrada:

  ```properties
  sdk.dir=C:/Users/<usuario>/Android/sdk
  nnta2.supabaseUrl=https://<proyecto>.supabase.co
  nnta2.anonKey=<clave anon>
  nnta2.deck=ta2-caso4
  ```

## Servidor

Necesita la migración de nnta2 (`supabase/migrations/20261118000000_nnta2_state.sql`) con la función `nnta2_move`
y el PIN definido en `nnta2_secret`.

## Compilar

Requiere JDK 17 y el SDK de Android (plataforma 37).

```bash
./gradlew assembleDebug
```

La APK queda en `app/build/outputs/apk/debug/app-debug.apk`. Para instalarla con el teléfono conectado por USB:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Honor / MagicOS

La pantalla **Ayuda Honor** abre «Inicio de aplicaciones» y explica cómo pasar la app a «gestionar manualmente»
con inicio automático, inicio secundario y ejecución en segundo plano.
