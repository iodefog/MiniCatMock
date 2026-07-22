---
name: 埋点校验面板
overview: 新增「埋点校验」子系统：用户维护埋点清单（事件名+属性+参数，多条、持久化、可配置），开始录制→结束期间，自动校验命中 ioslog 等上报接口的请求体（JSON 事件数组），严格校验必填+值正确+类型正确，面板逐条打勾，参数缺失/错误/类型不符标红，可查看命中明细。
design:
  architecture:
    framework: html
  styleKeywords:
    - Dashboard
    - Dark/Light 双主题
    - 状态徽章
    - 绿勾/红叉校验
    - 即时反馈
    - 信息密度高
  fontSystem:
    fontFamily: PingFang SC, system-ui, -apple-system, sans-serif
    heading:
      size: 18px
      weight: 700
    subheading:
      size: 13px
      weight: 600
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#A855F7"
      - "#3B82F6"
    background:
      - "#0F1117"
      - "#171A21"
      - "#FFFFFF"
    text:
      - "#E5E7EB"
      - "#9CA3AF"
    functional:
      - "#10B981"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: server-tracking-backend
    content: server.py 增加埋点规则/配置持久化、校验引擎、录制状态，并在捕获链路接入校验聚合与写回 log_entry
    status: completed
  - id: server-tracking-api
    content: server.py 新增埋点规则 CRUD、来源配置、开始/结束录制、结果查询 API，并注册 tracking.js 占位符
    status: completed
    dependencies:
      - server-tracking-backend
  - id: tracking-ui-html
    content: workspace.html/en-workspace.html 新增「埋点校验」选项卡与布局容器，index.html/index_en.html 注入占位符
    status: completed
  - id: tracking-ui-js
    content: core.js 扩展 switchSubTab，新建 tracking.js 实现清单编辑、来源配置、录制控制与结果渲染
    status: completed
    dependencies:
      - server-tracking-api
      - tracking-ui-html
  - id: verify-tracking-e2e
    content: 用捕获数据验证 ioslog 事件命中打勾、参数缺失/值错/类型错标红与明细展示
    status: completed
    dependencies:
      - tracking-ui-js
---

## 用户需求概述

在「小猫Mock」局域网抓包工具中新增一个「埋点校验」子系统，用于验证客户端上报的埋点（Tracking）是否完整、参数是否正确。上报接口为 `https://log.drdrab.com/ioslog`，其请求体为 LZ4 压缩的 JSON 事件数组，每个元素是一个事件对象，包含 `"event"` 字段及若干参数（如 `buttton_name`、`device_name`、`is_success`）。

## 核心功能

- 埋点清单管理：用户可维护多条埋点规则，每条规则由「事件名 + 场景说明 + 参数约束（参数名、是否必填、期望值、类型）」组成，支持新增、编辑、删除，并持久化保存。
- 来源接口可配置：默认匹配 `ioslog` 等上报域名，用户可在界面增删匹配关键字（按 original_url / path 包含匹配）。
- 录制控制：提供「开始录制 / 结束录制」按钮；点击开始即清空聚合命中状态，录制期间自动对命中的上报请求做校验。
- 命中与校验展示：面板逐条罗列埋点规则，命中的打勾，未命中或参数存在「缺失 / 值错误 / 类型错误」的标红，并展示具体错误项与命中明细（来自哪条上报请求、实际参数值）。
- 严格校验：对每条参数做「必填 + 值正确 + 类型正确（string / number / bool）」三合一校验；期望值为空时仅校验存在性与类型。

## 预置示例

- 投屏按钮曝光：event=buttonShow，buttton_name=cast
- 投屏按钮点击：event=buttonClick，buttton_name=cast
- 投屏设备点击：event=buttonClick，buttton_name=cast、device_name=设备名称、is_success(bool)

## 技术栈

- 后端：Python + FastAPI（复用现有 server.py，无需新增依赖）
- 前端：原生 HTML + CSS（复用 style.css 的 CSS 变量设计令牌）+ 原生 JS 模块（复用现有 subtab 机制与模块化注入方式）
- 持久化：本地 JSON 文件（mock_data/tracking_rules.json、mock_data/tracking_config.json），沿用现有 ai_config.json 读写模式

## 实现方案

复用现有「请求捕获 → body 自动 LZ4 解压 → json.loads 存入 log_entry」链路：在 `_process_mock_request` 解析出 body 后，若请求命中「来源接口」关键字，则遍历 body 事件数组，按 `event` 名匹配埋点清单，对每条规则逐参数执行严格校验，并把结果写回 `log_entry["tracking_validation"]`；同时维护进程内聚合字典 `tracking_hits`（按 rule_id 累计命中/错误/样本）。「开始录制」重置聚合状态。前端通过新增 API 拉取聚合结果并按 2 秒轮询刷新。

### 关键决策

- 校验放在服务端而非前端：服务端已持有解压后的 body，且上报请求会持续到达，聚合状态需跨请求累积，服务端天然适合承担。前端只负责展示与编辑，避免重复解析大体积 body。
- 聚合状态放进程内存（非落盘）：录制是临时性会话，重启即清空，符合「开始→结束」语义；清单与来源配置才落盘，保证可复用。
- 参数类型校验：bool 既接受原生 bool，也接受字符串 `"true"/"false"`（兼容部分客户端序列化），其余类型按 typeof 判定；期望值以字符串比较（json 标量 toString）。

## 架构设计

```mermaid
flowchart LR
  A[客户端上报 ioslog 请求] --> B[/mock 代理捕获]
  B --> C[LZ4 解压 + json.loads]
  C --> D{命中来源关键字?}
  D -- 否 --> E[普通捕获]
  D -- 是 --> F[遍历 body 事件数组]
  F --> G[按 event 匹配埋点清单]
  G --> H[逐参数校验: 必填/值/类型]
  H --> I[写回 log_entry.tracking_validation]
  H --> J[更新聚合 tracking_hits]
  J --> K[前端轮询 /api/tracking/results]
  K --> L[埋点校验面板: 打勾/标红/明细]
```

## 目录结构与文件清单

```
MockServer/
├── server.py                       # [MODIFY] 新增埋点规则/配置持久化、校验引擎、录制状态，在捕获链路接入校验，并注册 tracking.js 占位符与新增 API
├── templates/
│   ├── index.html                  # [MODIFY] 在 JS 注入区增加 /* {{TRACKING_PLACEHOLDER}} */ 占位符
│   ├── index_en.html               # [MODIFY] 同上（英文版占位符）
│   ├── html/
│   │   ├── workspace.html          # [MODIFY] 新增「埋点校验」子选项卡按钮 + 右侧埋点校验布局容器
│   │   └── en-workspace.html       # [MODIFY] 同上（英文标签）
│   └── js/
│       ├── core.js                 # [MODIFY] switchSubTab 增加 tracking 分支，控制布局显隐
│       └── tracking.js             # [NEW] 埋点校验面板全部前端逻辑（清单 CRUD、来源配置、录制控制、结果渲染、明细）
└── mock_data/                      # [NEW 运行时生成] tracking_rules.json、tracking_config.json
```

## 关键数据结构

```python
# 单条埋点规则（tracking_rules.json 为规则数组）
TrackingRule = {
    "id": str,            # 稳定唯一标识
    "event": str,         # 事件名，如 buttonShow
    "scenario": str,      # 场景说明，如 投屏按钮曝光
    "params": [           # 期望参数约束列表
        {"name": str, "required": bool, "value": str, "type": str}  # type ∈ {string,number,bool}; value 为空仅校验存在/类型
    ]
}

# 来源接口配置（tracking_config.json）
TrackingConfig = {"sources": [str, ...]}   # 关键字列表，默认 ["ioslog"]

# 服务端聚合结果（进程内存，不落盘）
TrackHit = {
    "hit": bool,                       # 是否存在一条满足全部约束的事件
    "errors": [{"param": str, "kind": "missing|value|type", "message": str}],
    "samples": [{"log_id": int, "event": str, "params": dict}]  # 命中的上报样本（最多保留最近若干条）
}
```

## 实现要点

- server.py 复用 `DATA_DIR` 与现有 json 读写容错模式；新增 `tracking_rules.json`/`tracking_config.json` 加载与保存函数。
- 在 `_process_mock_request` 解压 body 后调用 `validate_tracking(body, rules, config)`，仅当 `config.sources` 任一关键字命中 `original_url` 或 `path` 时执行，避免对无关请求做无谓解析。
- body 可能为数组、单对象或非 JSON 文本：数组逐元素校验，单对象直接校验，非 JSON 跳过并记一条解析错误。
- 新增 API（均加在 server.py，沿用现有路由风格）：
- GET/POST `/api/tracking/rules`：读取 / 整体保存规则列表
- GET/POST `/api/tracking/config`：读取 / 保存来源关键字
- POST `/api/tracking/start`：recording=True 并清空 `tracking_hits`
- POST `/api/tracking/stop`：recording=False
- GET `/api/tracking/results`：返回 {recording, total, hit_count, error_count, hits:{rule_id:TrackHit}}
- 性能：校验复杂度 O(事件数 × 参数数)，单次请求体通常在 KB~MB 级、事件数十~数百，开销可忽略；前端仅在埋点校验面板激活时轮询。
- 向后兼容：默认 `tracking_hits` 为空、清单为空时不干扰现有日志/代理/ Mock 功能；新增占位符缺失时（旧打包）安全降级为空。

## 设计风格

在现有「小猫Mock」暗/亮双主题框架内新增「埋点校验」面板，沿用既有的 CSS 变量设计令牌（--purple / --surface / --green / --red / --border 等），保证视觉一致。采用现代仪表盘风格：顶部为录制控制条（开始/结束 + 来源配置入口 + 进度统计），下方为埋点规则卡片列表，每条规则以状态徽章呈现「已命中(绿勾) / 未命中(灰) / 参数异常(红)」，点击可展开命中明细（实际参数、错误项高亮）。整体干净、信息密度高、操作反馈即时，避免引入与现有风格割裂的外部组件库。

## 页面区块（埋点校验布局）

1. 顶部控制条：标题「埋点校验」+ 来源关键字标签 + 「开始录制 / 结束录制」按钮 + 实时进度（命中 X / 共 Y，异常 Z）。
2. 进度概览卡：总规则数、已命中数、异常数三块统计，命中/异常用绿/红强调色。
3. 埋点规则列表：每条规则卡片含事件名、场景、参数约束摘要；右侧状态徽章（绿勾/灰圈/红叉）；点击展开校验明细（每个参数的 期望值 / 实际值 / 状态，错误行红底高亮）。
4. 清单管理区：新增规则、编辑（事件名、场景、参数名/必填/期望值/类型）、删除；来源关键字增删编辑弹层或内联区。
5. 空状态：清单为空时给出「导入示例（3 条投屏埋点）」引导，降低上手成本。

交互：录制中按钮脉冲动画；状态变化即时刷新（2s 轮询）；错误明细红框微动效提示；hover 行高亮。