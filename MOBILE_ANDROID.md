# Gerar app Android (Google Play) para o Consulta VIP

Este guia transforma o **Consulta VIP (web)** em um app Android instalável e publicável na Play Store usando **WebView nativa** (sem dependências extras no projeto web).

## Opção recomendada: Android Studio (WebView)

### 1. Criar projeto Android

1. Abra o Android Studio.
2. `New Project` > `Empty Views Activity`.
3. Nome: `Consulta VIP`
4. Package name: `br.com.consultavip.app`
5. Language: `Kotlin`
6. Minimum SDK: API 24+

### 2. Habilitar internet

No arquivo `app/src/main/AndroidManifest.xml`, adicione:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

E dentro da tag `<application>`:

```xml
android:usesCleartextTraffic="false"
```

### 3. Layout com WebView

No arquivo `app/src/main/res/layout/activity_main.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>
```

### 4. Activity principal

No arquivo `app/src/main/java/.../MainActivity.kt`:

```kotlin
package br.com.consultavip.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false

        webView.loadUrl("https://SEU_DOMINIO_DO_CONSULTA_VIP")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

### 5. Gerar app para testes

No Android Studio:

- `Build > Build Bundle(s) / APK(s) > Build APK(s)`

### 6. Gerar para Play Store

No Android Studio:

- `Build > Generate Signed Bundle / APK` > `Android App Bundle`
- Gere o arquivo `.aab` assinado
- Faça upload no **Google Play Console**

## Checklist para aprovação no Google Play

- App com política de privacidade publicada.
- Conta de testes (se login obrigatório).
- Ícone, screenshots e descrição da loja.
- Declarações de coleta de dados no formulário `Data safety`.

---

Se você quiser, no próximo passo eu também posso gerar os arquivos Android base já prontos dentro deste repositório (`/android`) para você só abrir e compilar.
