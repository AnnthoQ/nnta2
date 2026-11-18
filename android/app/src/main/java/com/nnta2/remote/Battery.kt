package com.nnta2.remote

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/** Ajustes de batería y de segundo plano (incluye los de Honor / MagicOS). */
object Battery {

    /** Pantallas de "Inicio de aplicaciones" de MagicOS (Honor) y EMUI (Huawei), de la más nueva a la más vieja. */
    private val STARTUP_SCREENS = listOf(
        ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"),
        ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.power.ui.HwPowerManagerActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.power.ui.HwPowerManagerActivity"),
    )

    val isHonorLike: Boolean
        get() = Build.MANUFACTURER.equals("HONOR", true) || Build.MANUFACTURER.equals("HUAWEI", true) ||
            Build.BRAND.equals("HONOR", true) || Build.BRAND.equals("HUAWEI", true)

    fun isExempt(ctx: Context): Boolean =
        ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName)

    fun notificationsAllowed(ctx: Context): Boolean =
        if (Build.VERSION.SDK_INT >= 33) {
            ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            androidx.core.app.NotificationManagerCompat.from(ctx).areNotificationsEnabled()
        }

    /** Muestra el diálogo del sistema "¿Permitir que la app se ejecute en segundo plano?". */
    @SuppressLint("BatteryLife")
    fun requestExemption(a: Activity) {
        val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, "package:${a.packageName}".toUri())
        if (!tryStart(a, direct) && !tryStart(a, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) {
            openAppDetails(a)
        }
    }

    /** Abre "Inicio de aplicaciones" en Honor/Huawei; si no existe, la batería del sistema o los datos de la app. */
    fun openStartupManager(a: Activity): Boolean {
        for (c in STARTUP_SCREENS) {
            if (tryStart(a, Intent().setComponent(c))) return true
        }
        if (tryStart(a, Intent(Intent.ACTION_POWER_USAGE_SUMMARY))) return false
        openAppDetails(a)
        return false
    }

    fun openBatterySettings(a: Activity) {
        if (!tryStart(a, Intent(Intent.ACTION_POWER_USAGE_SUMMARY))) openAppDetails(a)
    }

    fun openAppDetails(a: Activity) {
        tryStart(a, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:${a.packageName}".toUri()))
    }

    fun openNotificationSettings(a: Activity) {
        val i = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.packageName)
        if (!tryStart(a, i)) openAppDetails(a)
    }

    private fun tryStart(a: Activity, i: Intent): Boolean = try {
        a.startActivity(i)
        true
    } catch (_: Exception) {
        false
    }
}

/** Deja espacio para la barra de estado, la de navegación y el teclado (la app dibuja de borde a borde). */
fun View.padForSystemBars() {
    val l = paddingLeft
    val t = paddingTop
    val r = paddingRight
    val b = paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(this) { v, insets ->
        val bars = insets.getInsets(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
        )
        v.setPadding(l + bars.left, t + bars.top, r + bars.right, b + bars.bottom)
        WindowInsetsCompat.CONSUMED
    }
}
