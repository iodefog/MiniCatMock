# 🐱 Little Cat Mock — AI-Driven · Standalone Private · Ultra-fast Mobile Debugging Server

[English](README.md) | [简体中文](README_zh.md)

> A 100% data-localized mobile wireless packet capture & mock tool. Tailor-made for iOS/Android R&D — AI-driven, proxy-free via QR-code scan, making mobile debugging secure, efficient, and pristine.

---

## 1. 📅 Background

During mobile app development and testing, we often hit these pain points:

1. **Proxy environment nightmare**: Traditional capture tools (Charles, Fiddler, Proxyman) require configuring Wi-Fi proxies on the device and installing/trusting root certificates — cumbersome, error-prone, and polluting the device network.
2. **Cumbersome mock data**: Manually copying/pasting large JSON blobs lacks dynamic realism.
3. **Hard-to-reproduce edge cases**: Simulating anomalies (missing fields, overflow, corruption) needs complex scripts — low efficiency for chaos testing.

## 2. 🎯 Objectives

Build an **ultra-minimal, highly efficient** R&D collaboration tool:

* **Zero-config & proxy-free**: Scan a QR code to connect instantly — **0 system proxies, 0 certificate config**.
* **Efficient large-screen visualization**: Manage, auto-fill, and edit mock data in real time on a Web UI, synced to the device in sub-second.
* **Intelligent chaos testing**: Deeply integrated with **LLMs (DeepSeek, Claude)** to generate realistic responses and auto-inject anomalies for fully automated chaos testing.
* **Cross-platform**: Standard interception adapters for Swift, Objective-C, Kotlin, and Java — integrate with zero changes to your core codebase.

## 3. 🔍 Research: How Big Tech Does App Mocking

Top companies typically use a "client-side interception + centralized config platform" architecture:

* **Meituan Shark**: Client-side library injects interception rules, dynamically syncing mock data from an internal platform.
* **ByteDance TTMock**: Intercepts the network layer internally, combined with an internal config center, down to specific API paths.
* **JD Aura / Network Library**: Extends the unified network library, switching endpoints and injecting mock config via remote debug panels or QR scan.

### 💡 Little Cat Mock's Core Advantages

It keeps the essence of "client-side hijacking + PC large-screen visualization" while introducing leaps tailored for small/medium teams:

1. **Decentralized Standalone Sandbox (100% Data Localization)**
   Each developer's machine is an independent mock universe. Sandbox data is fully isolated — local privacy guaranteed, zero rule pollution.
2. **Zero Intrusion & Transparent Proxy Routing**
   The App only forwards requests to the local mock server. The server acts as a transparent proxy — if no mock rule matches, it seamlessly forwards upstream to the real server. Mock exactly what you need, zero pollution to unmocked logic.
3. **AI Intelligent Chaos Engine**
   Integrates LLMs (DeepSeek / Claude) to **dynamically generate** realistic business data from API params and **auto-inject** random chaos (garbage, nulls, overflows) — a generational leap from "static dictionary" to "dynamic intelligent data engine".

## 4. 🛠 Technical Implementation

Little Cat Mock **requires no system proxies** or certificate trust on the device. The core mechanism is **proxy-free direct connection & smart routing**.

### Core Workflow
1. **QR-code address distribution**: On launch, the console detects the LAN IP and shows a QR code (`http://<LAN-IP>:8099/mock`). Scan it with the App to persist the address.
2. **Local client hijacking**: When mock mode is on, the App's interceptor (NSURLProtocol / OkHttp Interceptor) redirects the original backend URL to the LAN mock server URL.
3. **Real-endpoint passthrough**: The interceptor carries the original URL and Host via headers (`X-Original-URL`, `X-Original-Host`).
4. **Smart routing**: On receiving a request:
   * **Match** → return user-configured or AI-generated JSON.
   * **No match** → transparent proxy to the real upstream via `X-Original-URL`, log it on the Web console (works as a packet capture tool).

### 🍎 iOS (Swift) Integration Example
```swift
class LittleCatMockAdapter {
    static func adapt(_ originalRequest: URLRequest) -> URLRequest {
        guard UserDefaults.standard.bool(forKey: "DRB_MOCK_ENABLED"),
              let mockAddress = UserDefaults.standard.string(forKey: "DRB_MOCK_SERVER_ADDRESS"),
              let originalURL = originalRequest.url else { return originalRequest }

        let host = originalURL.host ?? "default_host"
        let path = originalURL.path
        let query = originalURL.query ?? ""

        let cleanAddress = mockAddress.hasSuffix("/") ? String(mockAddress.dropLast()) : mockAddress
        let safePath = path.hasPrefix("/") ? path : "/\(path)"

        var newURLString = "\(cleanAddress)\(safePath)"
        if !query.isEmpty { newURLString += "?\(query)" }

        guard let finalURL = URL(string: newURLString) else { return originalRequest }

        var newRequest = originalRequest
        newRequest.url = finalURL
        newRequest.setValue("iOS-Swift-Client", forHTTPHeaderField: "X-LittleCat-Client")
        newRequest.setValue(originalURL.absoluteString, forHTTPHeaderField: "X-Original-URL")
        newRequest.setValue(host, forHTTPHeaderField: "X-Original-Host")
        return newRequest
    }
}
```

### 🤖 Android (Kotlin) Integration Example
```kotlin
class LittleCatMockInterceptor(private val context: Context) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        val mockEnabled = sharedPrefs.getBoolean("DRB_MOCK_ENABLED", false)
        val mockAddress = sharedPrefs.getString("DRB_MOCK_SERVER_ADDRESS", null)

        if (mockEnabled && !mockAddress.isNullOrEmpty()) {
            val originalUrl = request.url
            val host = originalUrl.host
            val path = originalUrl.encodedPath
            val query = originalUrl.query

            val cleanAddress = mockAddress.trim().removeSuffix("/")
            val safePath = if (path.startsWith("/")) path else "/$path"
            var newUrlString = "$cleanAddress$safePath"
            if (!query.isNullOrEmpty()) { newUrlString += "?$query" }

            newUrlString.toHttpUrlOrNull()?.let { newUrl ->
                request = request.newBuilder()
                    .url(newUrl)
                    .addHeader("X-LittleCat-Client", "Android-Kotlin-Client")
                    .addHeader("X-Original-URL", originalUrl.toString())
                    .addHeader("X-Original-Host", host ?: "")
                    .build()
            }
        }
        return chain.proceed(request)
    }
}
```

## 5. 📖 Tutorial

### Step 01: Proxy-free Direct Connection via QR Scan
On launch, the console auto-detects the LAN IP. Scan the QR code with your phone to connect instantly — 0 config, no HTTP proxy, no certificate trust.

### Step 02: Geek-Chic Visual Dashboard
The Web console controls the master mock switch, intercepted-request stats, AI LLM status, and connected device details.

### Step 03: Real-Device Packet Capture & One-Click cURL
Real-time filtering/monitoring of all phone requests, with sequence diagrams, latency tracking, and status tracing. Right-click to extract standard cURL commands — a perfect Charles substitute.

### Step 04: Visual Rule Library & JSON Tree Editor
Category grouping and card-based archiving for mock rules. JSON tree editor prevents syntax errors; one-click autofill tunes historical mock payloads.

### Step 05: AI-Driven Dynamic Mock
Enable AI dynamic responses; the system matches the API path and streams contextually appropriate business data via DeepSeek / Claude, and can inject missing/overflow values for crash chaos tests.

### Step 06: Rapid Multi-Platform SDK Integration
Built-in integration guides. Client URL rewriting only happens when mocking is enabled **and** a scanned connection exists — production logic stays untouched.

## 6. 🚀 Run & Startup Guide

### Method A: Run the Pre-packaged Standalone App (Recommended 👍)
* **🖥️ macOS**: Double-click `start.command` in the project root (it bootstraps the venv, installs deps, and launches). The bundled `.app` can also be opened directly.
* **💻 Windows**: Run the packaged executable (see Build section) or `package_win.bat`.

After starting, the default browser opens the Web panel automatically: `http://127.0.0.1:8099`.

### Method B: Start from Source (Developer Mode)
1. **Create & activate a virtual environment, install dependencies**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install fastapi uvicorn pydantic httpx lz4 curl_cffi
   ```
2. **Launch the service** (macOS):
   ```bash
   bash build.sh
   ```
   This activates the venv, auto-installs any missing deps, opens the browser, and runs `server.py` on port `8099`.

## 6.5 🌐 Cross-Network Connectivity (Ngrok)

When the phone and Mac are on **different networks** (4G/5G, cross-segment, or unable to join the same Wi-Fi), LAN direct connection fails. The "Cross-Network Connectivity (Ngrok)" mode opens a secure public tunnel so the phone can reach your local mock server from anywhere.

### Install Ngrok (macOS, via Homebrew)
```bash
brew install ngrok/ngrok/ngrok
```

### Configure the Authtoken (free, required for stable tunnels)
Sign up at [ngrok.com](https://ngrok.com), copy your authtoken, then:
```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```
> Without an authtoken the tunnel still works but is subject to Ngrok's free-tier session/time limits.

### How the secure tunnel works
1. Each time you enable the mode, the server **generates a random 16-character password** and starts Ngrok with `--basic-auth mockuser:<random-password>`. Unauthenticated requests are rejected with `401`.
2. The public URL **plus the random credentials** are encoded into the **QR code on the Web panel**. Scanning it with your phone connects directly — **the password never goes through chat tools, email, or a shared link**.
3. Because each developer runs their own Mac and the QR is scanned locally (Mac ↔ your own phone), the random password **never leaves your device ecosystem**, making leakage practically impossible in this local closed-loop usage.

### Security notes
* **LAN vs Ngrok**: Switching between "LAN Direct" and "Ngrok" only opens/tears down the public tunnel — the local mock service keeps running.
* Traffic is relayed through Ngrok's servers (TLS terminates at Ngrok), so **do not transmit core confidential data** over this channel.
* The free-tier subdomain auto-reuses and may be reclaimed or conflict with others — **do not treat it as a permanent address**; a new random password is generated on every launch.
* This is a **temporary, non-sensitive cross-network debugging** solution, **not production-grade**.
* Follow "open when needed, close when done": switch back to "LAN Direct" after debugging to tear down the public tunnel.

## 7. 📦 Build & Package

If you modify the engine or frontend, use the built-in scripts to repackage a clean executable:

* **macOS** (outputs `dist/小猫Mock.app`):
  ```bash
  bash package_mac.sh
  ```
* **Windows** (outputs a standalone `.exe`):
  ```bat
  package_win.bat
  ```
* Packaging logic lives in `package.py` (PyInstaller-based, one-file bundle with `templates` embedded).

## 8. 🛠️ FAQ & Troubleshooting

If the App fails to connect after a LAN connection (requests stuck loading / timing out):

1. **Firewall Blocks**
   * **macOS**: System Settings → Firewall — allow incoming connections for `Python` / the app.
   * **Windows**: On first-launch security alert, check both "Private" and "Public" networks.
2. **AP Isolation / Guest Network**
   Some corporate/cafe Wi-Fi enable AP isolation, blocking LAN device-to-device traffic. **Fix**: turn on your phone's personal hotspot and connect the computer to it, forming a clean mini-LAN.
3. **VPN / Proxy Software Conflicts**
   Ensure no global proxy (Clash, Surge) runs on phone or computer — they hijack routing and break `192.168.x.x:8099`.
4. **Ngrok tunnel stuck on "initializing"**
   Ensure `ngrok` is installed and an authtoken is configured. If a previous `ngrok` process is stuck, the launcher auto-cleans it on next start. Check the Web panel's tunnel error text for `ERR_NGROK_*` details.

---

💡 **Happy debugging! Feel free to share feedback.** 🐱
