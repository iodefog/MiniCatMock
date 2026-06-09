# 🐱 小猫Mock — 单机私有部署的移动端 AI 调试服务器

> 100% 数据本地化的移动端极速无线抓包与 Mock 工具。专为 iOS/Android 研发打造，AI 智能驱动，扫码直连免代理，让移动端联调安全、高效、纯净。

![功能示意图](小猫Mock截图/小猫mock-功能.png)

---

## 1. 📅 背景 (Background)

* **手机修改造数痛苦**：移动端联调测试时，涉及大量复杂的 Mock 数据注入与修改（如超长 JSON、临界分支状态），在手机小屏幕上修改极其痛苦且效率低下。
* **传统抓包“折磨”繁多**：配置 Charles/Fiddler 等工具的代理十分繁琐、换网络需重配；HTTPS 抓包需要下载并信任根证书，遇到双向认证或 SSL Pinning 更是无解；下班忘记关代理易导致手机无法正常上网。
* **日志分析不够端到端**：QA 团队目前主要依赖分析后端服务的请求日志，无法实现全链路、所见即所得的“端到端”极速观测与响应篡改。
* **公司基建缺失**：各大一线厂均有专属 AppMock 基建，但很多团队内部尚缺乏统一、开箱即用的移动端一站式 Mock/抓包调试工具。

## 2. 🎯 目标 (Objectives)

基于以上痛点，我们希望打造一款**极简高效**的研发测试协同工具：
* **0 配置免代理**：手机扫码即连，实现 **“0 系统代理、0 证书配置”**，彻底摆脱 Wi-Fi 代理设置与 HTTPS 证书信任噩梦。
* **高效大屏可视化**：在电脑端大屏 Web UI 上直观管理、一键回填、实时编辑 Mock 数据，秒级同步到真机。
* **智能混沌演练**：深度集成 **DeepSeek、Claude 等 AI 大模型**，由 AI 实时生成高拟真业务响应并自动注入异常，全自动进行异常混沌测试。
* **全平台多语系覆盖**：提供 Swift、Objective-C、Kotlin、Java 的标准拦截适配，一份代码零改动接入。

## 3. 🔍 调研：大厂是如何做 App Mock 的？(Research)

在立项初期，我们深入调研了**美团、字节跳动、京东**等一线大厂内部优秀的 AppMock 落地实践。虽然各家叫法不同，但他们在解决移动端深层联调痛点时，**架构演进方向惊人地一致**：

| 大厂名称 | 内部实践与核心机制 |
| :--- | :--- |
| **美团 (Meituan)** | **端侧拦截 + 动态路由**：摒弃传统的系统代理（Charles），在统一网络库层（如基于 OkHttp/NSURLProtocol 的定制 SDK）进行收口。测试时扫码下发配置，网络库自动将匹配的请求“重定向”至内部统一的 Mock 平台，实现**零侵入**抓包与造数。 |
| **字节跳动 (ByteDance)** | **控制台大屏 + 网关分流**：依赖内部强大的研发协同平台。App 连上调试环境后，TTNetwork 等网络层会把请求发到 Mock 网关。研发在 Web 控制台上通过可视化界面编排 JSON，网关根据设备标识，精准拦截并返回 Mock 数据，其余请求透传真实环境。 |
| **京东 (JD)** | **配置动态下发 + 场景化变异**：JDNetwork 同样支持通过“摇一摇”或扫码唤起调试面板，拉取云端 Mock 规则。除了静态替换，他们还非常注重**边缘场景测试**，可以在后台配下发“延时”、“空值”、“报错”等指令，用来做客户端的容灾防御演练。 |

**大厂方案的共性与启发**：
1. **去代理化**：彻底抛弃 Charles/Fiddler，不配系统代理，不装 HTTPS 证书（绕过 SSL Pinning）。
2. **控制平面分离**：客户端只做极其轻量的“请求转发”，复杂的 JSON 修改、抓包查看、规则判定全部交由电脑大屏（Web 平台）处理。
3. **隔离与提效**：一人一个 Mock 环境，互不干扰，即改即生效。

### 💡 破局与演进：「小猫Mock」的核心差异优势

「小猫Mock」并非简单的模仿，而是在保留了大厂最精髓的**“端侧局部劫持 + 电脑大屏可视化”**架构之上，针对中小型团队的痛点做了跨越式创新，**形成了与重型内建平台的三大核心差异**：

1. **去中心化：重型云端 SaaS ➡️ 极轻量本地独立沙盒**
   大厂平台是全公司共用的中心化网关，极易发生“环境污染”和配置冲突；小猫Mock 使用单文件即可在开发者本机的局域网内跑起，数据以 JSON 持久化在本地，**一人一个独立的 Mock 宇宙，实现开发测试环境 100% 隔离**。
2. **零侵入：深度定制框架绑定 ➡️ 普适标准无缝接入**
   大厂方案深度绑定了自研且不开源的私有网络栈（如 TTNetwork, Mtop）；小猫Mock 采用普适的标准 HTTP 拦截，只需几十行拦截代码配合原生 `NSURLSession`/`OkHttp`，完美兼容任何开源生态，**极其适合中小型团队极速落地**。
3. **AI 赋能：静态人力编排造数 ➡️ AI 智元动态驱动 (最大亮点)**
   大厂平台虽然规则丰富，但仍依赖海量 QA 和研发人工捏造、复制枯燥的 JSON 响应体；小猫Mock 生于 AI 时代，深度集成 DeepSeek / Claude 等大模型，能够根据 API 参数**动态生成**合理业务数据，并**自动随机注入混沌异常**（乱码、空值、溢出），完成了从“静态字典响应”到“动态智能数据引擎”的代际跨越！

## 4. 🛠 技术方案实现 (Implementation)

「小猫Mock」在手机端**不需要设置任何系统代理**，也不需要信任证书，其核心机制为**免代理直连与智能路由分流**。

![架构时序图](小猫Mock截图/小猫mock-时序图.png)

### 核心运作流程：
1. **扫码下发地址**：App 扫码获取「小猫Mock」启动时分配的本机局域网 IP（例如 `http://192.168.1.5:8099/mock`）并持久化。
2. **端内局部劫持**：当开启 Mock 模式时，App 底层的拦截器（Interceptor/NSURLProtocol）会将原本发往真实后端的 URL，替换为指向小猫 Mock 服务器的局域网 URL。
3. **真实端点透传**：拦截器会将原 URL 与原 Host 以 HTTP Header (`X-Original-URL`, `X-Original-Host`) 的形式携带过去。
4. **小猫智能分流**：小猫接收到请求后：
   * 若命中 Mock 规则，则返回用户配置的定制 JSON 数据或由 AI 动态生成的数据。
   * 若未命中规则，则作为透明代理，利用 `X-Original-URL` 向上游真实服务器发起请求，并回传真实结果，顺便在 Web 控制台记录日志，实现抓包功能。

###  iOS (Swift) 核心接入示例
```swift
class LittleCatMockAdapter {
    static func adapt(_ originalRequest: URLRequest) -> URLRequest {
        guard UserDefaults.standard.bool(forKey: "DRB_MOCK_ENABLED"),
              let mockAddress = UserDefaults.standard.string(forKey: "DRB_MOCK_SERVER_ADDRESS"),
              let originalURL = originalRequest.url else { return originalRequest }
        
        let host = originalURL.host ?? "default_host"
        let path = originalURL.path
        let query = originalURL.query ?? ""
        
        // 重写 URL 前缀，直连局域网小猫 PC 服务器 (剥离原 Host)
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

### 🤖 Android (Kotlin) 核心接入示例
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

## 5. 📖 使用教程 (Tutorial)

### 步骤 01：扫码建立免代理直连通道
启动程序后，控制台会自动探测局域网 IP。只需用手机直接扫描二维码，即可完成 0 配置、免 HTTP 代理及证书信任的极速直连通道建立。
![首次启动扫码](小猫Mock截图/小猫mock-首次启动页面.png)

### 步骤 02：极客风可视化设备大屏
Web 控制台主页能够直观掌控 Mock 总开关状态、拦截请求统计大屏、AI 大模型状态以及当前连接的 App 真机设备型号详情。
![控制台主页](小猫Mock截图/小猫mock-主页.png)

### 步骤 03：真机抓包过滤与一键 cURL
实时过滤和监测手机发送的所有网络请求，支持时序图、耗时及状态追踪，右键一键提取标准 cURL 命令，完美替代 Charles 抓包体验。
![流量抓包](小猫Mock截图/小猫mock-logs.png)

### 步骤 04：可视化规则库 JSON 树状编辑
支持 Mock 规则的分类分组卡片式归档，提供 JSON 树状编辑器防语法错误，并支持历史 Mock 报文的一键高保真快速回填微调。
![规则库管理](小猫Mock截图/小猫mock-规则库.png)

### 步骤 05：AI 范式动态 Mock
开启 AI 动态返回，系统自适应匹配 API 路径，由 DeepSeek / Claude 流式生成逻辑贴切的业务数据，并能注入缺失/溢出值进行崩溃混沌演练。
![AI动态Mock](小猫Mock截图/小猫mock-aigc-生成完成.png)

### 步骤 06：多端 SDK 极速集成
控制台内置标准的一键集成代码指引。只有在开启 Mock 且存在扫码连接时，才会进行端内的局部 URL 重定向，不影响生产环境，对原本业务零污染。
![多端集成代码](小猫Mock截图/小猫mock-接入教程和常见问题.png)

## 6. 🚀 运行与启动教程

### 方式 A：直接运行打包好的单文件程序（推荐 👍）
* **🖥️ macOS 平台**：直接运行 `dist/小猫Mock` 或双击项目根目录下的 `start.command`。
* **💻 Windows 平台**：直接运行 `dist/小猫Mock.exe` 或双击运行项目根目录下的 `start.bat`。

启动后，系统会自动打开默认浏览器进入 Web 主面板：`http://127.0.0.1:8099`。

### 方式 B：从源码与虚拟环境启动（开发者模式）
1. **安装依赖**：
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install fastapi uvicorn pydantic httpx lz4
   ```
2. **启动服务**：
   * macOS: `bash build.sh`
   * Windows: `package.bat`

## 7. 📦 打包编译
如果您修改了底层引擎逻辑或前端界面，可使用内置脚本重新打包出纯净的可执行文件：
* **macOS 平台**：执行 `sh package_mac.sh`，将输出 `dist/小猫Mock.app`
* **Windows 平台**：执行 `package_win.bat`，将输出 `dist/小猫Mock.exe`

## 8. 🛠️ 常见异常与网络排障指南 (FAQ)

如果您在局域网直连后发现 App 无法连接到「小猫Mock」服务器（请求一直 loading 或超时），请排查：

1. **防火墙拦截**：
   * **macOS**：检查“系统偏好设置” -> “防火墙”，确保允许 `Python` 或 `小猫Mock` 的传入连接。
   * **Windows**：首次启动弹出的安全警报，务必勾选“专用网络”和“公用网络”允许访问。
2. **AP 隔离 / 访客网络限制**：
   部分公司或咖啡厅的 Wi-Fi 开启了 AP 隔离，导致局域网设备无法互相通信。**解决方案**：手机开启个人热点，让电脑连接该热点，在纯净的小局域网内工作。
3. **VPN / 代理软件冲突**：
   请确保手机端和电脑端没有开启 Clash / Surge 等全局代理，这些软件会接管路由规则，导致 `192.168.x.x:8099` 无法正常直连。

---
💡 **祝您开发调试愉快！如果有任何使用建议，欢迎随时反馈！** 🐱
