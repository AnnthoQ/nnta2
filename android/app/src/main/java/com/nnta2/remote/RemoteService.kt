package com.nnta2.remote

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.VolumeProviderCompat
import java.util.UUID
import java.util.concurrent.LinkedBlockingDeque
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min
import androidx.media.app.NotificationCompat as MediaNotificationCompat

/**
 * Modo bolsillo. Servicio en primer plano que:
 *  - mantiene una MediaSession "remota" con un VolumeProviderCompat relativo: así Android le entrega las
 *    teclas de volumen aunque la pantalla esté apagada o la app en segundo plano, y el volumen real del
 *    teléfono no cambia;
 *  - envía cada pulsación al servidor desde un hilo propio, con cola, reintentos y sin duplicados;
 *  - muestra la notificación fija "Presentación en curso" con Anterior / Siguiente / Detener.
 */
class RemoteService : Service() {

    companion object {
        const val ACTION_START = "com.nnta2.remote.START"
        const val ACTION_NEXT = "com.nnta2.remote.NEXT"
        const val ACTION_PREV = "com.nnta2.remote.PREV"
        const val ACTION_STOP = "com.nnta2.remote.STOP"

        private const val CHANNEL = "presentacion"
        private const val NOTIF_ID = 13
        private const val CUSTOM_STOP = "detener"
        private const val DEBOUNCE_MS = 300L
        /** Eventos de la misma tecla más seguidos que esto (sin soltarla) son autorrepetición. */
        private const val REPEAT_GAP_MS = 600L
        private const val WAKELOCK_MS = 4 * 60 * 60 * 1000L

        @Volatile
        private var instance: RemoteService? = null

        val isRunning get() = instance != null

        fun start(ctx: Context) =
            ContextCompat.startForegroundService(ctx, Intent(ctx, RemoteService::class.java).setAction(ACTION_START))

        fun stop() {
            val s = instance
            if (s != null) s.shutdown() else {
                Session.creds = null
                RemoteBus.update { RemoteBus.State() }
            }
        }

        /** Pulsación desde la pantalla o una tecla. Devuelve false si se ignoró (antirrebote). */
        fun press(delta: Int): Boolean = instance?.onPress(delta) ?: false

        /** Pide al servicio que consulte el estado ya (por ejemplo, al volver a la app). */
        fun refreshSoon() { instance?.worker?.wake() }
    }

    private lateinit var session: MediaSessionCompat
    private lateinit var volume: VolumeProviderCompat
    private lateinit var feedback: Feedback
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var netCallback: ConnectivityManager.NetworkCallback? = null

    @Volatile
    private var currentNetwork: Network? = null

    @Volatile
    private var worker: Sender? = null

    private var inForeground = false
    private var lastAccepted = 0L
    private var heldDir = 0
    private var lastRaw = 0L
    private var lastNotifText: String? = null

    private val busListener: (RemoteBus.State) -> Unit = { s -> if (s.running) refreshNotification(s) }

    // ---------------------------------------------------------------- ciclo de vida

    override fun onCreate() {
        super.onCreate()
        instance = this
        feedback = Feedback(this)
        NotificationManagerCompat.from(this).createNotificationChannel(
            NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_LOW)
                .setName(getString(R.string.channel_name))
                .setDescription(getString(R.string.channel_desc))
                .setShowBadge(false)
                .setVibrationEnabled(false)
                .build()
        )
        setupSession()
        setupNetwork()
        RemoteBus.listen(busListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        goForeground()
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        if (!inForeground) {
            // Sin primer plano Android cerraría el servicio en segundos: mejor detenerse y avisar.
            shutdown()
            RemoteBus.update { it.copy(message = "Android no permitió iniciar el modo bolsillo. Abre la app y vuelve a conectar.") }
            return START_NOT_STICKY
        }
        // Si Android reinicia el servicio tras cerrar el proceso, solo puede seguir si el expositor
        // eligió "recordar" (credenciales cifradas); si no, se detiene.
        val creds = Session.creds ?: PinVault.load(this)?.also { Session.creds = it }
        if (creds == null) {
            shutdown()
            return START_NOT_STICKY
        }
        begin(creds)
        when (intent?.action) {
            ACTION_NEXT -> onPress(+1)
            ACTION_PREV -> onPress(-1)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        RemoteBus.unlisten(busListener)
        worker?.quit()
        worker = null
        try {
            session.isActive = false
            session.release()
        } catch (_: Exception) {
        }
        netCallback?.let {
            try {
                getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(it)
            } catch (_: Exception) {
            }
        }
        releaseLocks()
        instance = null
        RemoteBus.update { it.copy(running = false) }
        super.onDestroy()
    }

    private fun goForeground() {
        if (inForeground) return
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
        try {
            ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(RemoteBus.state), type)
            inForeground = true
        } catch (_: Exception) {
            // Android no deja pasar a primer plano desde segundo plano (lo maneja onStartCommand).
        }
    }

    private fun begin(creds: Creds) {
        if (worker?.creds == creds) return
        worker?.quit()
        acquireLocks()
        session.isActive = true
        RemoteBus.update {
            it.copy(
                running = true,
                conn = if (it.conn == RemoteBus.Conn.ONLINE) it.conn else RemoteBus.Conn.CONNECTING,
                message = null,
                timerBase = if (it.timerBase == 0L) SystemClock.elapsedRealtime() else it.timerBase,
            )
        }
        worker = Sender(creds).also { it.start() }
    }

    fun shutdown() {
        worker?.quit()
        worker = null
        Session.creds = null
        RemoteBus.update { RemoteBus.State() }
        try {
            session.isActive = false
        } catch (_: Exception) {
        }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        inForeground = false
        releaseLocks()
        stopSelf()
    }

    // ---------------------------------------------------------------- teclas y pulsaciones

    private fun setupSession() {
        volume = object : VolumeProviderCompat(VolumeProviderCompat.VOLUME_CONTROL_RELATIVE, 100, 50) {
            override fun onAdjustVolume(direction: Int) = onVolumeKey(direction)
        }
        session = MediaSessionCompat(this, "nnta2-remote").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onSkipToNext() { onPress(+1) }
                override fun onSkipToPrevious() { onPress(-1) }
                override fun onCustomAction(action: String?, extras: Bundle?) {
                    if (action == CUSTOM_STOP) shutdown()
                }
            })
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setActions(PlaybackStateCompat.ACTION_SKIP_TO_NEXT or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
                    .addCustomAction(CUSTOM_STOP, getString(R.string.stop), R.drawable.ic_stop)
                    // "Reproduciendo" es lo que hace que Android elija esta sesión para las teclas de volumen.
                    .setState(PlaybackStateCompat.STATE_PLAYING, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 0f)
                    .build()
            )
            setPlaybackToRemote(volume)
            setSessionActivity(openAppIntent())
        }
    }

    /**
     * direction: +1 subir, −1 bajar, 0 = la tecla se soltó. Al mantener la tecla, Android repite el evento;
     * esas repeticiones se ignoran para que una pulsación larga no salte varias láminas.
     */
    @Synchronized
    private fun onVolumeKey(direction: Int) {
        val now = SystemClock.elapsedRealtime()
        if (direction == 0) {
            heldDir = 0
            return
        }
        if (direction != 1 && direction != -1) return
        val repeat = heldDir == direction && now - lastRaw < REPEAT_GAP_MS
        lastRaw = now
        heldDir = direction
        volume.currentVolume = 50 // el control "remoto" nunca llega a un tope
        if (!repeat) onPress(direction)
    }

    @Synchronized
    fun onPress(delta: Int): Boolean {
        val w = worker ?: return false
        val now = SystemClock.elapsedRealtime()
        if (now - lastAccepted < DEBOUNCE_MS) return false
        lastAccepted = now
        w.press(delta)
        return true
    }

    // ---------------------------------------------------------------- red y energía

    private fun setupNetwork() {
        val cm = getSystemService(ConnectivityManager::class.java)
        currentNetwork = cm.activeNetwork
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                currentNetwork = network
                worker?.wake() // volvió la red (o cambió de Wi-Fi a datos): reintenta ya
            }

            override fun onLost(network: Network) {
                if (currentNetwork == network) currentNetwork = null
            }
        }
        try {
            cm.registerDefaultNetworkCallback(cb)
            netCallback = cb
        } catch (_: Exception) {
        }
    }

    private fun acquireLocks() {
        if (wakeLock == null) {
            wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nnta2:remote").apply {
                    setReferenceCounted(false)
                    acquire(WAKELOCK_MS)
                }
        }
        if (wifiLock == null) {
            try {
                val wm = applicationContext.getSystemService(WifiManager::class.java)
                @Suppress("DEPRECATION")
                val mode = if (Build.VERSION.SDK_INT >= 34) WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                else WifiManager.WIFI_MODE_FULL_HIGH_PERF
                wifiLock = wm.createWifiLock(mode, "nnta2:remote").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun releaseLocks() {
        try { wakeLock?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
        try { wifiLock?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
        wakeLock = null
        wifiLock = null
    }

    // ---------------------------------------------------------------- notificación

    private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(
        this, 0,
        Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun actionIntent(action: String, code: Int): PendingIntent = PendingIntent.getService(
        this, code, Intent(this, RemoteService::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun statusText(s: RemoteBus.State): String {
        val where = if (s.total > 0) "Lámina ${s.slide} de ${s.total}" else "Lámina ${s.slide.coerceAtLeast(1)}"
        val conn = when (s.conn) {
            RemoteBus.Conn.ONLINE -> "Conectado"
            RemoteBus.Conn.CONNECTING, RemoteBus.Conn.IDLE -> "Conectando…"
            RemoteBus.Conn.RETRYING -> if (s.queued > 0) "Sin conexión · ${s.queued} en cola" else "Sin conexión · reintentando"
            RemoteBus.Conn.AUTH_ERROR -> "Clave incorrecta"
            RemoteBus.Conn.SETUP_ERROR -> "Error del servidor"
        }
        return "$where · $conn"
    }

    private fun buildNotification(s: RemoteBus.State): Notification {
        val text = statusText(s)
        session.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, getString(R.string.notif_title))
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, text)
                .build()
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent())
            .addAction(R.drawable.ic_prev, getString(R.string.prev), actionIntent(ACTION_PREV, 1))
            .addAction(R.drawable.ic_next, getString(R.string.next), actionIntent(ACTION_NEXT, 2))
            .addAction(R.drawable.ic_stop, getString(R.string.stop), actionIntent(ACTION_STOP, 3))
            .setStyle(
                MediaNotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build()
    }

    private fun refreshNotification(s: RemoteBus.State) {
        if (!inForeground) return
        val text = statusText(s)
        if (text == lastNotifText) return
        lastNotifText = text
        try {
            NotificationManagerCompat.from(this).notify(NOTIF_ID, buildNotification(s))
        } catch (_: SecurityException) {
            // Sin permiso de notificaciones: el servicio sigue funcionando igual.
        }
    }

    // ---------------------------------------------------------------- envío al servidor

    /** Una o varias pulsaciones juntadas en un solo envío, con un identificador fijo hasta que llegue. */
    private class Pending(val delta: Int, val req: String, val count: Int)

    private inner class Sender(val creds: Creds) : Thread("nnta2-envio") {
        private val api = SupabaseApi(creds) { currentNetwork }
        private val presses = LinkedBlockingDeque<Int>()
        private val kick = Semaphore(0)
        private val unannounced = AtomicInteger(0) // pulsaciones de las que aún no se avisó un fallo

        @Volatile
        private var pending: Pending? = null

        @Volatile
        private var quit = false
        private var failures = 0

        fun press(delta: Int) {
            presses.offer(delta)
            unannounced.incrementAndGet()
            RemoteBus.update { it.copy(queued = queuedCount()) }
            kick.release()
        }

        fun wake() = kick.release()

        fun quit() {
            quit = true
            interrupt()
        }

        private fun queuedCount() = presses.size + (pending?.count ?: 0)

        override fun run() {
            refresh()
            var nextPoll = SystemClock.elapsedRealtime() + pollInterval()
            while (!quit) {
                try {
                    if (pending == null && presses.isEmpty()) {
                        val wait = nextPoll - SystemClock.elapsedRealtime()
                        if (wait > 0) {
                            kick.tryAcquire(wait, TimeUnit.MILLISECONDS)
                            kick.drainPermits()
                        }
                        if (quit) break
                        if (presses.isEmpty()) {
                            refresh() // tocaba consultar, volvió la red o se abrió la app
                            nextPoll = SystemClock.elapsedRealtime() + pollInterval()
                            continue
                        }
                    }
                    val p = pending ?: takeBatch() ?: continue
                    pending = p
                    if (deliver(p)) {
                        pending = null
                        RemoteBus.update { it.copy(queued = queuedCount()) }
                        nextPoll = SystemClock.elapsedRealtime() + pollInterval()
                    } else {
                        failures++
                        val wait = min(500L shl min(failures - 1, 4), 8000L)
                        kick.tryAcquire(wait, TimeUnit.MILLISECONDS) // una pulsación nueva o la red adelantan el reintento
                        kick.drainPermits()
                    }
                } catch (_: InterruptedException) {
                    if (quit) break
                }
            }
        }

        private fun takeBatch(): Pending? {
            var delta = 0
            var n = 0
            while (true) {
                val d = presses.poll() ?: break
                delta += d
                n++
            }
            return if (n == 0) null else Pending(delta, UUID.randomUUID().toString(), n)
        }

        /** true si el envío terminó (llegó o no tiene arreglo); false si hay que reintentar. */
        private fun deliver(p: Pending): Boolean {
            if (quit) return true
            return try {
                val st = api.move(p.delta, p.req)
                if (quit) return true
                failures = 0
                if (presses.isEmpty()) unannounced.set(0)
                feedback.ok()
                RemoteBus.update {
                    it.copy(
                        conn = RemoteBus.Conn.ONLINE, message = null,
                        slide = st.slide, step = st.step, total = st.total, stepsHere = st.stepsHere,
                    )
                }
                true
            } catch (e: SupabaseApi.AuthException) {
                dropAll()
                feedback.failed()
                RemoteBus.update {
                    it.copy(conn = RemoteBus.Conn.AUTH_ERROR, queued = 0, message = "Clave incorrecta. Pulsa Detener y vuelve a entrar.")
                }
                true
            } catch (e: SupabaseApi.SetupException) {
                dropAll()
                feedback.failed()
                RemoteBus.update { it.copy(conn = RemoteBus.Conn.SETUP_ERROR, queued = 0, message = e.message) }
                true
            } catch (e: Exception) {
                if (quit) return true
                if (unannounced.getAndSet(0) > 0) feedback.failed()
                RemoteBus.update {
                    it.copy(conn = RemoteBus.Conn.RETRYING, queued = queuedCount(), message = e.message ?: "Sin conexión")
                }
                false
            }
        }

        private fun dropAll() {
            presses.clear()
            pending = null
            unannounced.set(0)
        }

        private fun refresh() {
            try {
                val st = api.fetch()
                if (quit || pending != null || presses.isNotEmpty()) return
                RemoteBus.update {
                    val keep = it.conn == RemoteBus.Conn.AUTH_ERROR
                    it.copy(
                        conn = if (keep) it.conn else RemoteBus.Conn.ONLINE,
                        message = if (keep) it.message else null,
                        slide = st.slide, step = st.step, total = st.total, stepsHere = st.stepsHere,
                    )
                }
            } catch (e: SupabaseApi.SetupException) {
                RemoteBus.update { it.copy(conn = RemoteBus.Conn.SETUP_ERROR, message = e.message) }
            } catch (e: Exception) {
                if (quit) return
                RemoteBus.update {
                    if (it.conn == RemoteBus.Conn.AUTH_ERROR || it.conn == RemoteBus.Conn.SETUP_ERROR) it
                    else it.copy(conn = RemoteBus.Conn.RETRYING, message = e.message ?: "Sin conexión")
                }
            }
        }

        private fun pollInterval() = if (RemoteBus.uiVisible) 3000L else 15000L
    }
}
