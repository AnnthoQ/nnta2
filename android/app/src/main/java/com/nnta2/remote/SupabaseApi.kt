package com.nnta2.remote

import android.net.Network
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Datos de una sesión. Viven solo en memoria (ver [Session]); el PIN nunca se escribe en disco sin cifrar. */
data class Creds(val url: String, val key: String, val deck: String, val pin: String)

/** Lámina y paso actuales tal como los tiene el servidor. */
data class ServerState(val slide: Int, val step: Int, val total: Int, val stepsHere: Int)

/**
 * Cliente mínimo de Supabase (PostgREST) para el sistema de presentaciones nnta2.
 *
 * Toda la comunicación con el servidor está en esta clase: si algún día la presentación usa otro
 * servidor, solo hay que cambiar este archivo.
 *
 *  - move(delta, req): RPC nnta2_move. Avanza (+) o retrocede (−) y devuelve el estado. El identificador
 *    req hace que un reintento de la misma pulsación no se aplique dos veces.
 *  - fetch(): lee la tabla pública nnta2_state (no necesita el PIN).
 */
class SupabaseApi(private val creds: Creds, private val network: () -> Network?) {

    /** El PIN no es correcto: no tiene sentido reintentar. */
    class AuthException(message: String) : Exception(message)

    /** Falta configurar algo en el servidor o en la app (tabla, función, clave pública): no se reintenta. */
    class SetupException(message: String) : Exception(message)

    /** Fallo pasajero de red o del servidor: se reintenta. */
    class TransientException(message: String, cause: Throwable? = null) : IOException(message, cause)

    private val base: String = normalize(creds.url)

    fun move(delta: Int, req: String?): ServerState {
        val body = JSONObject()
            .put("p_deck", creds.deck)
            .put("p_pin", creds.pin)
            .put("p_delta", delta)
            .put("p_req", req ?: JSONObject.NULL)
        val rows = JSONArray(request("POST", "/rest/v1/rpc/nnta2_move", body.toString()))
        if (rows.length() == 0) throw SetupException("El servidor no devolvió la lámina actual.")
        val r = rows.getJSONObject(0)
        return ServerState(r.optInt("slide", 1), r.optInt("step", 0), r.optInt("total", 0), r.optInt("pasos", 0))
    }

    fun fetch(): ServerState {
        val deck = java.net.URLEncoder.encode(creds.deck, "UTF-8")
        val rows = JSONArray(request("GET", "/rest/v1/nnta2_state?id=eq.$deck&select=slide,step,steps", null))
        if (rows.length() == 0) throw SetupException("No existe la presentación «${creds.deck}» en el servidor.")
        val r = rows.getJSONObject(0)
        val slide = r.optInt("slide", 1)
        val steps = r.optJSONArray("steps")
        val total = steps?.length() ?: 0
        val here = if (steps != null && slide in 1..total) steps.optInt(slide - 1, 0) else 0
        return ServerState(slide, r.optInt("step", 0), total, here)
    }

    private fun request(method: String, path: String, body: String?): String {
        val url = URL(base + path)
        val net = network()
        val conn = try {
            (if (net != null) net.openConnection(url) else url.openConnection()) as HttpURLConnection
        } catch (e: IOException) {
            throw TransientException("Sin conexión", e)
        }
        try {
            conn.requestMethod = method
            conn.connectTimeout = CONNECT_TIMEOUT_MS
            conn.readTimeout = READ_TIMEOUT_MS
            conn.useCaches = false
            conn.setRequestProperty("apikey", creds.key)
            // Las claves nuevas (sb_publishable_…) no son JWT y no van en Authorization.
            if (!creds.key.startsWith("sb_")) conn.setRequestProperty("Authorization", "Bearer ${creds.key}")
            conn.setRequestProperty("Accept", "application/json")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code in 200..299) return text
            throw classify(code, text)
        } catch (e: IOException) {
            if (e is TransientException) throw e
            throw TransientException(friendly(e), e)
        } finally {
            conn.disconnect()
        }
    }

    private fun classify(http: Int, text: String): Exception {
        val json = try { JSONObject(text) } catch (_: Exception) { null }
        val code = json?.optString("code").orEmpty()
        val msg = json?.optString("message").orEmpty().ifBlank { "HTTP $http" }
        return when {
            code == "28P01" -> AuthException("Clave incorrecta")
            code in MISSING || http == 404 -> SetupException(
                "Falta configurar el servidor: ejecuta la migración de nnta2 en Supabase ($msg)."
            )
            http == 401 || (http == 403 && code.isEmpty()) ->
                SetupException("La clave pública (anon) del servidor no es válida.")
            http >= 500 || http == 408 || http == 429 -> TransientException("El servidor respondió $http")
            else -> SetupException(msg)
        }
    }

    private fun friendly(e: IOException): String = when (e) {
        is java.net.UnknownHostException -> "Sin internet"
        is java.net.SocketTimeoutException -> "El servidor tarda en responder"
        is java.net.ConnectException -> "No se pudo conectar"
        else -> "Error de red"
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 4000
        private const val READ_TIMEOUT_MS = 6000
        private val MISSING = setOf("PGRST202", "PGRST205", "42P01", "42883", "P0002")

        fun normalize(raw: String): String {
            var u = raw.trim().trimEnd('/')
            if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://$u"
            return u
        }
    }
}
