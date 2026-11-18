import java.util.Properties

plugins {
    id("com.android.application")
}

// Datos de conexión por defecto (servidor, clave pública «anon» y presentación). Se leen de
// local.properties, que no se sube al repositorio, y se pueden cambiar en la pantalla de entrada.
// El PIN del expositor NUNCA va aquí: se escribe en la app y vive solo en memoria.
val local = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun cfg(key: String): String =
    "\"" + (local.getProperty(key) ?: "").replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.nnta2.remote"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nnta2.remote"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "DEFAULT_URL", cfg("nnta2.supabaseUrl"))
        buildConfigField("String", "DEFAULT_KEY", cfg("nnta2.anonKey"))
        buildConfigField("String", "DEFAULT_DECK", cfg("nnta2.deck"))
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.media:media:1.8.0")
}
