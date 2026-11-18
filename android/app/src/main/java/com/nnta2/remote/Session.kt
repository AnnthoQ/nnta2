package com.nnta2.remote

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import org.json.JSONObject
import java.security.KeyStore
import java.util.concurrent.CopyOnWriteArraySet
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Credenciales de la sesión actual, solo en memoria. Se borran al pulsar Detener o al cerrar el proceso. */
object Session {
    @Volatile
    var creds: Creds? = null
}

/** Estado compartido entre el servicio y la pantalla. Los avisos llegan siempre en el hilo principal. */
object RemoteBus {

    enum class Conn { IDLE, CONNECTING, ONLINE, RETRYING, AUTH_ERROR, SETUP_ERROR }

    data class State(
        val running: Boolean = false,
        val conn: Conn = Conn.IDLE,
        val slide: Int = 0,
        val step: Int = 0,
        val total: Int = 0,
        val stepsHere: Int = 0,
        val queued: Int = 0,
        val message: String? = null,
        val timerBase: Long = 0L,      // elapsedRealtime en que empezó (ajustado por las pausas)
        val timerPausedAt: Long = 0L,  // 0 = corriendo
    ) {
        fun elapsedMs(now: Long = SystemClock.elapsedRealtime()): Long = when {
            timerBase == 0L -> 0L
            timerPausedAt != 0L -> timerPausedAt - timerBase
            else -> now - timerBase
        }
    }

    @Volatile
    var state = State()
        private set

    /** La pantalla está visible: el servicio consulta el estado más seguido. */
    @Volatile
    var uiVisible = false

    private val listeners = CopyOnWriteArraySet<(State) -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    fun update(change: (State) -> State) {
        val s = synchronized(this) { change(state).also { state = it } }
        main.post { listeners.forEach { it(s) } }
    }

    fun listen(l: (State) -> Unit) { listeners += l; l(state) }
    fun unlisten(l: (State) -> Unit) { listeners -= l }

    fun toggleTimer() = update {
        val now = SystemClock.elapsedRealtime()
        when {
            it.timerBase == 0L -> it.copy(timerBase = now, timerPausedAt = 0L)
            it.timerPausedAt == 0L -> it.copy(timerPausedAt = now)
            else -> it.copy(timerBase = it.timerBase + (now - it.timerPausedAt), timerPausedAt = 0L)
        }
    }

    fun resetTimer() = update {
        val now = SystemClock.elapsedRealtime()
        it.copy(timerBase = now, timerPausedAt = if (it.timerPausedAt != 0L) now else 0L)
    }
}

/**
 * "Recordar en este teléfono": guarda los datos de conexión y el PIN cifrados con AES-GCM. La llave se
 * genera dentro del Android Keystore y no se puede extraer del teléfono. Sin "recordar" no se guarda nada.
 */
object PinVault {
    private const val ALIAS = "nnta2_remote_vault"
    private const val PREFS = "vault"
    private const val BLOB = "blob"

    fun save(ctx: Context, c: Creds) {
        val plain = JSONObject().put("url", c.url).put("key", c.key).put("deck", c.deck).put("pin", c.pin)
            .toString().toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val out = enc(cipher.iv) + ":" + enc(cipher.doFinal(plain))
        prefs(ctx).edit { putString(BLOB, out) }
    }

    fun load(ctx: Context): Creds? {
        val blob = prefs(ctx).getString(BLOB, null) ?: return null
        return try {
            val (iv, data) = blob.split(":").let { dec(it[0]) to dec(it[1]) }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            val j = JSONObject(String(cipher.doFinal(data), Charsets.UTF_8))
            Creds(j.getString("url"), j.getString("key"), j.getString("deck"), j.getString("pin"))
        } catch (_: Exception) {
            clear(ctx)
            null
        }
    }

    fun has(ctx: Context) = prefs(ctx).contains(BLOB)

    fun clear(ctx: Context) {
        prefs(ctx).edit { remove(BLOB) }
        try {
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(ALIAS)
        } catch (_: Exception) {
        }
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun enc(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun dec(s: String) = Base64.decode(s, Base64.NO_WRAP)
}
