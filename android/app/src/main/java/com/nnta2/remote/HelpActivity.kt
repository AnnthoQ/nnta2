package com.nnta2.remote

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.core.view.WindowCompat

/** Cómo evitar que MagicOS (Honor) cierre la app con la pantalla apagada. */
class HelpActivity : Activity() {

    private lateinit var checkBattery: TextView
    private lateinit var checkNotif: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_help)
        findViewById<View>(R.id.root).padForSystemBars()

        checkBattery = findViewById(R.id.checkBattery)
        checkNotif = findViewById(R.id.checkNotif)

        findViewById<TextView>(R.id.device).text = getString(
            if (Battery.isHonorLike) R.string.help_device_honor else R.string.help_device_other,
            Build.MANUFACTURER.replaceFirstChar { it.uppercase() }, Build.MODEL,
        )

        findViewById<View>(R.id.back).setOnClickListener { finish() }
        findViewById<View>(R.id.openStartup).setOnClickListener { Battery.openStartupManager(this) }
        findViewById<View>(R.id.openExempt).setOnClickListener { Battery.requestExemption(this) }
        findViewById<View>(R.id.openBattery).setOnClickListener { Battery.openBatterySettings(this) }
        findViewById<View>(R.id.openNotif).setOnClickListener { Battery.openNotificationSettings(this) }
        findViewById<View>(R.id.openApp).setOnClickListener { Battery.openAppDetails(this) }
    }

    override fun onResume() {
        super.onResume()
        val exempt = Battery.isExempt(this)
        checkBattery.text = getString(if (exempt) R.string.check_battery_ok else R.string.check_battery_bad)
        checkBattery.setTextColor(getColor(if (exempt) R.color.green else R.color.orange))
        val notif = Battery.notificationsAllowed(this)
        checkNotif.text = getString(if (notif) R.string.check_notif_ok else R.string.check_notif_bad)
        checkNotif.setTextColor(getColor(if (notif) R.color.green else R.color.orange))
    }
}
