# iOS App & Mac 🐱「小猫Mock」抓包与 Mock 服务系统

This system enables real-time HTTP traffic capture, global controls, rule-based mocking, and seamless transparent proxying for the `DramaBox` app using a local Mac 🐱「小猫Mock」抓包服务.

---

## 1. System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Developer as iOS Developer
    participant App as DramaBox App (iOS)
    participant Server as Local Mac 🐱「小猫Mock」抓包服务
    participant Remote as Real Remote Server

    Note over Developer, Server: Phase 1: Connection Establishment
    Server->>Server: Start server.py (🐱「小猫Mock」) on Port 8099
    Server->>Developer: Display Connection Guide & QR Code
    Developer->>App: Open DoKit Debug -> Mock服务
    Developer->>App: Click "扫一扫建立连接"
    App->>Server: Scan QR code containing Server URL
    App->>App: Save 🐱「小猫Mock」 address & enable Mocking

    Note over App, Remote: Phase 2: Intercepted Request Lifecycle
    App->>App: DRBEndPoint intercepts outgoing network request
    alt Mock Enabled
        App->>App: Rewrite request destination to local 🐱「小猫Mock」
        App->>App: Inject headers X-Original-URL & X-Original-Host
        App->>Server: Send HTTP request to http://<MAC_IP>:8099/mock/...
        Server->>Server: Log request details to Live Dashboard
        alt Global Mock ON & Matching Enabled Rule Found
            Server-->>App: Return mock JSON payload
        else Global Mock OFF OR Rule Disabled OR No Rule Matches
            Server->>Remote: Async proxy request using httpx (SSL bypass)
            Remote-->>Server: Return real response data
            Server->>Server: Log real response details to Live Dashboard
            Server-->>App: Return transparent response data
        end
    else Mock Disabled
        App->>Remote: Send normal request to Real Remote Server
        Remote-->>App: Return real response data
    end
```

---

## 2. Completed Implementations

### A. Client-Side (iOS App)

1. **Native QR Code Scanner & Debug Panel (`DRBDebugMockPlugin.swift`):**
   * Registered a custom `@objc` class conforming to DoKit's `DoraemonPluginProtocol`.
   * Created a settings controller `DRBDebugMockViewController` with:
     * A Doraemon-styled `DoraemonCellSwitch` to toggle global client-side Mocking.
     * A cell button to trigger the scanner.
     * A label displaying the current server address.
   * Built a full-screen high-performance `DRBQRScannerViewController` powered by native `AVFoundation` (`AVCaptureSession` and `AVCaptureMetadataOutputObjectsDelegate`) with auto-vibration feedback, a custom navigation bar, and automatic IP parsing logic.
2. **Plugin Registration (`DRBDebugManager.swift`):**
   * Registered the new `Mock服务` plugin under both `#if DEBUG || HOT` and `#elseif !TAG` conditions, ensuring availability across debug builds and internal testing releases.
3. **URL Interception & Redirection (`DRBEndPoint.swift`):**
   * Modified the convenience initializer of `DRBEndPoint` (Moya's sub-component) to check `DRB_MOCK_ENABLED` and `DRB_MOCK_SERVER_ADDRESS` from `UserDefaults`.
   * Automatically rewrites target URLs to destination `http://<MAC_IP>:8099/mock/<path>` and injects headers:
     * `X-Original-URL` (e.g. `https://api.dianzhong.com/video/index/1234/home`)
     * `X-Original-Host` (e.g. `https://api.dianzhong.com`)

### B. Server-Side (Mac MockServer)

1. **Routing and Async Proxy fallback (`server.py`):**
   * Added `mock_global_enabled = True` in-memory flag.
   * Added `/api/config` (`GET` & `POST`) endpoints to read/write global settings.
   * Expanded `MockRule` Pydantic schema to support the optional `enabled: bool = True` field.
   * In `handle_mock_request`, if Mock is Globally ON and a rule is matched & enabled, it serves the Mock JSON.
   * If not mocked, it extracts the custom `X-Original-URL` header and performs an async, non-blocking transparent proxy using `httpx.AsyncClient(verify=False)`, stripping conflicting headers and safely logging real responses onto the dashboard without interrupting the app flow.
2. **Premium Dashboard Control UI & Dual-Theme System (`templates/index.html`):**
   * Designed a responsive global toggle switch in the dashboard's header next to the tab navigation that reflects and updates the server's global mock configuration live.
   * Added the "是否启用此规则" toggle switch inside the rules configuration editor.
   * Added highly interactive **inline toggle switches** directly on each card in the rules library list view. Users can enable/disable rules with a single click. Rules that are disabled dynamically decrease opacity and show a red left-border indicator.
   * **Dual-Theme Design System (Light & Dark):** Integrated a beautiful HSL-curated stylesheet supporting a bright **Light Mode (Default)** and a premium **Dark Mode**. Designed a theme toggle button `🌙` / `☀️` on the left header pane that saves the theme state to `localStorage` and synchronizes styles instantly before rendering to prevent visual flashing.
   * **Real-time Log Search & Filtering:** Implemented a highly responsive filtering and search bar directly inside the left panel. Supports real-time text-based search (matching URL paths, HTTP methods, headers, query parameters, and request body content) coupled with high-contrast tab filters for `GET`, `POST`, `🟢 Mock`, and `⚡ 透传` status flags, using an optimized local in-memory log cache.
3. **LZ4 Automatic Decompression Engine (`server.py`):**
   * Decodes Hive Batch tracking logs (`x-encrypt-type: 1000` / `Content-Type: application/octet-stream`) on-the-fly.
   * Automatically decompresses Moya-sent binary tracking requests using the fast native `lz4.block` decoder and the `content-raw-size` header size limit.
   * Displays the fully decompressed JSON data structurally inside the Collapsible JSON tree viewer, completely resolving payload garbling.

---

## 3. Cross-Platform Standalone Tool Compilation (macOS & Windows)

To distribute the `小猫Mock` server as a standalone executable tool that runs on other computers (both Windows and macOS) without requiring Python or manual package installation, we have provided an automated packaging script [`package.py`](file:///Users/lhl/Documents/coding/drama_ios_副本2/MockServer/package.py).

### How to Compile:

1. **On macOS (to generate macOS binary):**
   * Open your terminal, navigate to the `MockServer` folder, and run:
     ```bash
     python3 package.py
     ```
   * The standalone executable binary file `小猫Mock` will be created inside the `dist/` directory.

2. **On Windows (to generate Windows `.exe` binary):**
   * Open Command Prompt (`cmd`) or PowerShell in the `MockServer` folder, and run:
     ```cmd
     python package.py
     ```
   * The standalone executable file `小猫Mock.exe` will be created inside the `dist/` directory.

### Persistent Rule Storage Architecture:
When compiled with PyInstaller, all HTML static assets and templates are automatically compressed and embedded inside the binary. They are extracted to a temporary memory directory `_MEIPASS` when executed.
To prevent user rules from being lost when the application is closed, we implemented a **persistent runtime storage check**:
* It automatically identifies if it is running inside a PyInstaller frozen environment.
* If frozen, it sets `DATA_DIR` to the *actual physical folder* where the executable is launched (`mock_data/` next to the executable), rather than inside `_MEIPASS`. This ensures all mock rules remain safely persistent on the user's disk across restarts.

