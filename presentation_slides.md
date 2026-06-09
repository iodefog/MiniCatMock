---
marp: true
theme: gaia
_class: lead
paginate: true
backgroundColor: #0f172a
color: #e2e8f0
style: |
  section {
    font-family: 'Outfit', 'Inter', 'Helvetica Neue', Arial, sans-serif;
    padding: 40px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  }
  h1 {
    color: #38bdf8;
    font-size: 2.2em;
    margin-bottom: 20px;
    text-shadow: 0 4px 12px rgba(56, 189, 248, 0.2);
  }
  h2 {
    color: #f1f5f9;
    font-size: 1.4em;
    border-bottom: 2px solid #38bdf8;
    padding-bottom: 8px;
  }
  h3 {
    color: #38bdf8;
  }
  code {
    background-color: #1e293b;
    color: #38bdf8;
    border-radius: 6px;
    padding: 3px 6px;
    font-family: 'Fira Code', Consolas, monospace;
  }
  pre {
    background: #0b0f19 !important;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
  }
  pre code {
    background: transparent;
    color: #cbd5e1;
    font-size: 0.85em;
  }
  footer {
    font-size: 0.5em;
    color: #64748b;
  }
  .highlight {
    color: #f43f5e;
    font-weight: bold;
  }
  .accent {
    color: #10b981;
    font-weight: bold;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .badge {
    background: #38bdf8;
    color: #0f172a;
    padding: 4px 8px;
    border-radius: 20px;
    font-size: 0.7em;
    font-weight: bold;
    display: inline-block;
  }
---

# 🐱 小猫Mock (Little Cat)
### 移动端免代理调试与 AI 混沌测试实践

<br>

**主讲人**：[您的名字 / 团队]
**定位**：极速无线 Mock & 抓包调试服务器

<br>

*0 代理配置 / 0 证书信任 / 扫码直连 / AI 异常变异*

---

# 1. 移动端网络调试的日常“折磨”

在日常 App 开发与测试中，你是否经历过以下痛点？

<div class="grid-2">
<div class="card">

### 🕸️ 传统抓包地狱
- Charles/Fiddler 改代理麻烦
- 频繁切换 Wi-Fi 时需要重配
- 下班忘记关闭，导致手机断网
- iOS/Android 对根证书限制重重
</div>

<div class="card">

### 📱 手机造数困境
- 在手机小屏幕上修改 JSON 极痛苦
- 复杂的边界条件造数成本高
- 缺乏独立的本地测试沙箱
- 接口异常模拟缺乏自动化手段
</div>
</div>

---

# 2. 🐱 什么是「小猫Mock」？

专为移动端打造的**零配置、免代理、扫码即连**轻量级调试工具。

*   <span class="accent">扫码即连</span>：扫一扫 Web 二维码，一键建立数据替换通道，无需修改系统代理。
*   <span class="accent">大屏可视化</span>：电脑端 Web UI 直观编辑、一键回填、实时流观测。
*   <span class="accent">AI 智能注入</span>：集成 DeepSeek/Claude 流式生成业务数据，一键发起“混沌异常演练”。
*   <span class="accent">多语系覆盖</span>：提供 Swift, Objective-C, Kotlin, Java 标准适配器。

---

# 3. 核心价值定位

「小猫Mock」与常规后端 Mock 的本质差异：

| 维度 | 常规后端 Mock (接口模拟) | 🐱 小猫Mock (客户端直连劫持) |
| :--- | :--- | :--- |
| **解决阶段** | **从无到有** (前后端初期跑通流程) | **从有到精** (QA & 开发深度打磨及压测) |
| **测试场景** | 正常主流程分支 | 极端异常、大数据篡改、AI混沌变异 |
| **接入成本** | 需后端配合规则，容易干扰网关 | **0 代理、0 证书**，客户端扫码即用 |
| **成员干扰** | 全局生效，容易多人规则覆盖冲突 | 局域网本地服务，**每位开发者绝对独立** |

---

# 4. “免代理”重定向工作原理

小猫Mock采用**客户端 URL 动态重定向**，避开系统全局 HTTP 代理和 HTTPS 劫持。

```
[ 原始 API 请求 ] ➔ https://api.example.com/user/profile?uid=100
       ⬇
[ 客户端拦截器 ] (判断 Mock 开启，动态重组 URL)
       ⬇
[ 重定向后请求 ] ➔ http://192.168.1.5:8099/mock/api.example.com/user/profile?uid=100
       ⬇
[ 🐱 小猫服务器 ] ➔ 命中规则？ ➔ 返回 Mock JSON (PC 实时编辑)
       ⬇ 否
[ 透明代理透传 ] ➔ 转发到外网 ➔ 返回真实数据 + 捕获耗时/状态码
```

---

# 5. 客户端零侵入式接入 (iOS & Android)

只需要在网络库（如 Alamofire/Moya, OkHttp）的 **Interceptor** 中加入几行转换逻辑：

<div class="grid-2">
<div class="card">

###  iOS (Swift) 核心逻辑
```swift
static func adapt(_ req: URLRequest) -> URLRequest {
  guard UserDefaults.standard.bool(forKey: "MOCK_ENABLED"),
        let mockHost = UserDefaults.standard.string(forKey: "MOCK_SERVER") else {
      return req
  }
  let originalURL = req.url!
  let newURL = "\(mockHost)/\(originalURL.host!)\(originalURL.path)"
  var newReq = req
  newReq.url = URL(string: newURL)
  return newReq
}
```
</div>

<div class="card">

### 🤖 Android (Kotlin) 核心逻辑
```kotlin
override fun intercept(chain: Chain): Response {
  var req = chain.request()
  val mockServer = prefs.getString("MOCK_SERVER", null)
  if (mockEnabled && !mockServer.isNullOrEmpty()) {
    val origUrl = req.url
    val newUrlStr = "$mockServer/${origUrl.host}${origUrl.encodedPath}"
    req = req.newBuilder()
      .url(newUrlStr.toHttpUrl())
      .build()
  }
  return chain.proceed(req)
}
```
</div>
</div>

---

# 6. AI 智元特性：智能 Mock 与混沌演练

告别死板的静态假数据，引入 AI 实现智慧测试！

<div class="grid-2">
<div class="card">

### 🧠 AI 业务范式 Mock
- 集成 **DeepSeek / Claude**。
- 自动解析 API Path、参数和场景描述。
- **流式（SSE）** 自动生成高拟真、逻辑合理的 JSON 业务报文。
</div>

<div class="card">

### 💥 AI 混沌异常变异
- AI 自适应向报文注入数据溢出、乱码。
- 随机执行 **空值变异 (null 注入)**。
- 模拟类型冲突（如数字变字符串），高强度测试 App 防崩溃鲁棒性。
</div>
</div>

---

# 7. Web 大屏开发者驾驶舱 (Developer Cockpit)

<div class="grid-2">
<div class="card">

### 🎨  premium 视觉与交互
*   **双色主题**：极具现代感的 Light 模式与深邃 Dark 暗黑模式。
*   **JSON 树形编辑器**：可视化折叠、增删字段，杜绝拼写错误。
*   **一键回填**：历史规则一键回填编辑面板，极速微调。
</div>

<div class="card">

### ⚡ 实时流与高级解包
*   **双向 SSE 同步**：请求日志即时刷新。
*   **多维度过滤**：按 GET/POST、Mock 命中、透传进行筛选。
*   **LZ4 解压引擎**：自动识别并解密 `x-encrypt-type: 1000` 二进制 Moya 日志。
</div>
</div>

---

# 8. 单文件开箱即用与持久化设计

为了让非技术人员（如 QA）无痛使用，小猫提供了极简的打包部署架构。

*   **跨平台一键打包**：通过 PyInstaller 一键编译为 Windows `.exe` 和 macOS `.app`，内置 FastAPI、运行时与 UI 模板。
*   **双层路径持久化**：
    *   静态 UI 资源打包进 `_MEIPASS` 临时内存，启动极速。
    *   用户规则库 `mock_data/` 物理存储在**程序物理外置目录**下，软件升级或重启，配置规则绝对不丢失。

---

# 9. 降本增效成果

<div class="grid-2">
<div class="card">

### 📈 交付效率显著提升
*   **连接配置**：10分钟 ➔ **3秒扫码**。
*   **造数耗时**：15分钟手写 ➔ **10秒 AI 自动生成/大屏回填**。
*   **协作摩擦**：多人覆盖干扰 ➔ **物理隔离，人手一个独立沙盒**。
</div>

<div class="card">

### 🛡️ 客户端稳定性剧增
*   通过 **AI 异常混沌注入**，提前拦截了大量因后台返回 `null` 或数据类型不符导致的 NullPointerException / 崩溃闪退缺陷。
</div>
</div>

---

# 10. 未来展望与交流互动

*   ☁️ **规则云端中心**：支持团队规则云端一键同步、协作与共享。
*   🤖 **自动化用例反向生成**：捕获真实流量后，AI 一键转为自动化接口测试脚本。

<br>
<br>

### 🐱 祝大家开发调试愉快，远离代理折磨！
**Q & A / 交流环节**

---
