package com.nnta2.remote

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.net.ConnectivityManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import androidx.core.view.WindowCompat

class MainActivity : Activity() {

    // Entrada
    private lateinit var login: View
    private lateinit var pin: EditText
    private lateinit var remember: Switch
    private lateinit var url: EditText
    private lateinit var key: EditText
    private lateinit var deck: EditText
    private lateinit var connBox: View
    private lateinit var connToggle: TextView
    private lateinit var loginError: TextView
    private lateinit var connect: Button

    // Control
    private lateinit var control: View
    private lateinit var statusDot: View
    private lateinit var statusText: TextView
    private lateinit var slideNum: TextView
    private lateinit var slideOf: TextView
    private lateinit var stepText: TextView
    private lateinit var stepDots: LinearLayout
    private lateinit var queueText: TextView
    private lateinit var message: TextView
    private lateinit var timer: TextView
    private lateinit var timerToggle: Button
    private lateinit var batteryCard: View

    private val ui = Handler(Looper.getMainLooper())
    private var connecting = false
    private var askedBattery = false
    private var last = RemoteBus.State()

    private val busListener: (RemoteBus.State) -> Unit = { render(it) }
    private val tick = object : Runnable {
        override fun run() {
            renderTimer(last)
            ui.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)
        findViewById<View>(R.id.root).padForSystemBars()

        login = findViewById(R.id.login)
        pin = findViewById(R.id.pin)
        remember = findViewById(R.id.remember)
        url = findViewById(R.id.url)
        key = findViewById(R.id.key)
        deck = findViewById(R.id.deck)
        connBox = findViewById(R.id.connBox)
        connToggle = findViewById(R.id.connToggle)
        loginError = findViewById(R.id.loginError)
        connect = findViewById(R.id.connect)

        control = findViewById(R.id.control)
        statusDot = findViewById(R.id.statusDot)
        statusText = findViewById(R.id.statusText)
        slideNum = findViewById(R.id.slideNum)
        slideOf = findViewById(R.id.slideOf)
        stepText = findViewById(R.id.stepText)
        stepDots = findViewById(R.id.stepDots)
        queueText = findViewById(R.id.queueText)
        message = findViewById(R.id.message)
        timer = findViewById(R.id.timer)
        timerToggle = findViewById(R.id.timerToggle)
        batteryCard = findViewById(R.id.batteryCard)

        prefill()

        connToggle.setOnClickListener { setConnVisible(connBox.visibility != View.VISIBLE) }
        connect.setOnClickListener { connect() }
        pin.setOnEditorActionListener { _, _, _ -> connect(); true }
        findViewById<View>(R.id.helpLink).setOnClickListener { openHelp() }

        findViewById<View>(R.id.prev).setOnClickListener { RemoteService.press(-1) }
        findViewById<View>(R.id.next).setOnClickListener { RemoteService.press(+1) }
        timerToggle.setOnClickListener { RemoteBus.toggleTimer() }
        findViewById<View>(R.id.timerReset).setOnClickListener { RemoteBus.resetTimer() }
        findViewById<View>(R.id.batteryAllow).setOnClickListener { Battery.requestExemption(this) }
        findViewById<View>(R.id.help).setOnClickListener { openHelp() }
        findViewById<View>(R.id.stop).setOnClickListener { confirmStop() }

        askNotifications()
    }

    override fun onStart() {
        super.onStart()
        RemoteBus.listen(busListener)
        ui.post(tick)
    }

    override fun onResume() {
        super.onResume()
        RemoteBus.uiVisible = true
        RemoteService.refreshSoon()
        batteryCard.visibility = if (Battery.isExempt(this)) View.GONE else View.VISIBLE
    }

    override fun onPause() {
        RemoteBus.uiVisible = false
        super.onPause()
    }

    override fun onStop() {
        RemoteBus.unlisten(busListener)
        ui.removeCallbacks(tick)
        super.onStop()
    }

    /** Con la app abierta, las teclas de volumen las atiende la pantalla y no llegan a cambiar el volumen. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (RemoteService.isRunning && (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                RemoteService.press(if (code == KeyEvent.KEYCODE_VOLUME_UP) +1 else -1)
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    // ---------------------------------------------------------------- entrada

    private fun prefill() {
        val saved = PinVault.load(this)
        val c = saved ?: Session.creds
        url.setText(c?.url ?: BuildConfig.DEFAULT_URL)
        key.setText(c?.key ?: BuildConfig.DEFAULT_KEY)
        deck.setText(c?.deck ?: BuildConfig.DEFAULT_DECK)
        if (saved != null) pin.setText(saved.pin)
        remember.isChecked = saved != null
        // Si faltan datos de conexión, se muestran para completarlos.
        setConnVisible(url.text.isBlank() || key.text.isBlank() || deck.text.isBlank())
    }

    private fun setConnVisible(show: Boolean) {
        connBox.visibility = if (show) View.VISIBLE else View.GONE
        connToggle.setText(if (show) R.string.conn_hide else R.string.conn_show)
    }

    private fun connect() {
        if (connecting) return
        val c = Creds(
            url = SupabaseApi.normalize(url.text.toString()),
            key = key.text.toString().trim(),
            deck = deck.text.toString().trim(),
            pin = pin.text.toString(),
        )
        when {
            c.pin.isEmpty() -> return showLoginError(getString(R.string.err_pin_empty))
            c.url.length < 12 || c.key.isEmpty() || c.deck.isEmpty() -> {
                setConnVisible(true)
                return showLoginError(getString(R.string.err_conn_empty))
            }
        }
        connecting = true
        loginError.visibility = View.GONE
        connect.isEnabled = false
        connect.alpha = 0.6f
        connect.setText(R.string.connecting)
        val net = getSystemService(ConnectivityManager::class.java).activeNetwork
        Thread {
            // p_delta = 0: comprueba el PIN, que el servidor tenga la función y lee la lámina actual.
            val result = runCatching { SupabaseApi(c) { net }.move(0, null) }
            runOnUiThread { onConnectResult(c, result) }
        }.start()
    }

    private fun onConnectResult(c: Creds, result: Result<ServerState>) {
        connecting = false
        connect.isEnabled = true
        connect.alpha = 1f
        connect.setText(R.string.connect)
        if (isFinishing) return
        result.onSuccess { st ->
            try {
                if (remember.isChecked) PinVault.save(this, c) else PinVault.clear(this)
            } catch (_: Exception) {
                remember.isChecked = false
            }
            Session.creds = c
            if (!remember.isChecked) pin.setText("")
            RemoteBus.update {
                it.copy(
                    conn = RemoteBus.Conn.ONLINE, message = null, queued = 0,
                    slide = st.slide, step = st.step, total = st.total, stepsHere = st.stepsHere,
                    timerBase = SystemClock.elapsedRealtime(), timerPausedAt = 0L,
                )
            }
            RemoteService.start(this)
            if (!askedBattery && !Battery.isExempt(this)) {
                askedBattery = true
                ui.postDelayed({ if (!isFinishing) Battery.requestExemption(this) }, 600)
            }
        }.onFailure { e ->
            showLoginError(
                when (e) {
                    is SupabaseApi.AuthException -> getString(R.string.err_pin_wrong)
                    is SupabaseApi.SetupException -> e.message ?: getString(R.string.err_server)
                    else -> getString(R.string.err_offline)
                }
            )
        }
    }

    private fun showLoginError(text: String) {
        loginError.text = text
        loginError.visibility = View.VISIBLE
    }

    // ---------------------------------------------------------------- control

    private fun render(s: RemoteBus.State) {
        last = s
        val active = s.running || RemoteService.isRunning
        login.visibility = if (active) View.GONE else View.VISIBLE
        control.visibility = if (active) View.VISIBLE else View.GONE
        if (!active) {
            if (s.message != null && !connecting) showLoginError(s.message)
            return
        }

        val (color, label) = when (s.conn) {
            RemoteBus.Conn.ONLINE -> R.color.green to getString(R.string.st_online)
            RemoteBus.Conn.CONNECTING, RemoteBus.Conn.IDLE -> R.color.orange to getString(R.string.st_connecting)
            RemoteBus.Conn.RETRYING -> R.color.orange to getString(R.string.st_retrying)
            RemoteBus.Conn.AUTH_ERROR -> R.color.red to getString(R.string.st_auth)
            RemoteBus.Conn.SETUP_ERROR -> R.color.red to getString(R.string.st_setup)
        }
        statusDot.backgroundTintList = ColorStateList.valueOf(getColor(color))
        statusText.text = label

        slideNum.text = if (s.slide > 0) s.slide.toString() else "–"
        slideOf.text = if (s.total > 0) getString(R.string.slide_of, s.total) else ""
        stepText.text = when {
            s.stepsHere > 0 -> getString(R.string.step_of, s.step, s.stepsHere)
            else -> getString(R.string.step_only, s.step)
        }
        renderDots(s.step, s.stepsHere)

        queueText.visibility = if (s.queued > 0) View.VISIBLE else View.GONE
        queueText.text = resources.getQuantityString(R.plurals.queued, s.queued, s.queued)
        message.visibility = if (s.message.isNullOrBlank() || s.conn == RemoteBus.Conn.ONLINE) View.GONE else View.VISIBLE
        message.text = s.message
        renderTimer(s)
    }

    private fun renderDots(step: Int, total: Int) {
        val n = total.coerceIn(0, 12)
        if (stepDots.childCount != n) {
            stepDots.removeAllViews()
            val size = (8 * resources.displayMetrics.density).toInt()
            val gap = (6 * resources.displayMetrics.density).toInt()
            repeat(n) {
                stepDots.addView(View(this).apply {
                    setBackgroundResource(R.drawable.dot)
                    layoutParams = LinearLayout.LayoutParams(size, size).apply { marginEnd = gap }
                })
            }
        }
        for (i in 0 until stepDots.childCount) {
            val on = i < step
            stepDots.getChildAt(i).backgroundTintList =
                ColorStateList.valueOf(getColor(if (on) R.color.blue else R.color.fill3))
        }
        stepDots.visibility = if (n > 0) View.VISIBLE else View.GONE
    }

    private fun renderTimer(s: RemoteBus.State) {
        val total = s.elapsedMs() / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val sec = total % 60
        timer.text = if (h > 0) "%d:%02d:%02d".format(h, m, sec) else "%02d:%02d".format(m, sec)
        val paused = s.timerPausedAt != 0L
        timer.alpha = if (paused) 0.5f else 1f
        timerToggle.setText(if (paused) R.string.timer_resume else R.string.timer_pause)
    }

    private fun confirmStop() {
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(R.string.stop_title)
            .setMessage(R.string.stop_msg)
            .setPositiveButton(R.string.stop) { _, _ -> RemoteService.stop() }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun openHelp() = startActivity(Intent(this, HelpActivity::class.java))

    private fun askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !Battery.notificationsAllowed(this)) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }
}
