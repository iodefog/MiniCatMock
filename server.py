import os
# 清理系统代理环境变量，避免 curl_cffi 和 httpx 因为残留的代理设置（如已关闭的 Clash）导致连接 127.0.0.1:7890 失败
for env_key in ["http_proxy", "https_proxy", "all_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]:
    os.environ.pop(env_key, None)

import sys
import json
import time
import socket
import subprocess
import shutil
import threading
import re
import httpx
import asyncio
import lz4.block
import uuid
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="🐱 小猫Mock - 局域网 Mock & 抓包服务器")

# 前端 JS 已按模块拆分为多个文件，运行时按此顺序注入模板占位符。
# 顺序与原单文件 app.js 完全一致，拼接后等价于原文件，不影响任何功能。
JS_PLACEHOLDERS = [
    ("/* {{CORE_PLACEHOLDER}} */", "js/core.js"),
    ("/* {{LOGS_PLACEHOLDER}} */", "js/logs.js"),
    ("/* {{JSON_PLACEHOLDER}} */", "js/json-viewer.js"),
    ("/* {{MOCK_PLACEHOLDER}} */", "js/mock.js"),
    ("/* {{AI_PLACEHOLDER}} */", "js/ai.js"),
    ("/* {{PET_PLACEHOLDER}} */", "js/pet.js"),
]

# 前端 HTML 骨架已按区块拆分为多个 partial 文件，运行时按此顺序注入模板占位符。
# 顺序与原单文件 index.html 的 DOM 结构完全一致，拼接后等价于原文件，不影响任何功能。
HTML_PARTIALS = [
    ("/* {{SIDEBAR_PLACEHOLDER}} */", "html/sidebar.html"),
    ("/* {{WORKSPACE_PLACEHOLDER}} */", "html/workspace.html"),
    ("/* {{MODALS_PLACEHOLDER}} */", "html/modals.html"),
    ("/* {{AI_ASSISTANT_PLACEHOLDER}} */", "html/ai-assistant.html"),
]
# 英文版 index_en.html 对应的 partial 文件以 en- 前缀区分，占位符名称保持一致。
HTML_PARTIALS_EN = [
    ("/* {{SIDEBAR_PLACEHOLDER}} */", "html/en-sidebar.html"),
    ("/* {{WORKSPACE_PLACEHOLDER}} */", "html/en-workspace.html"),
    ("/* {{MODALS_PLACEHOLDER}} */", "html/en-modals.html"),
    ("/* {{AI_ASSISTANT_PLACEHOLDER}} */", "html/en-ai-assistant.html"),
]

# 允许所有来源跨域，确保 App 和 Web 面板均可访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确定运行和存储根目录：如果是 PyInstaller 打包后的程序，规则数据保存在可执行程序所在的同级目录下，避免保存在临时解压目录 _MEIPASS 中导致重启时丢失
IS_FROZEN = getattr(sys, 'frozen', False)
if IS_FROZEN:
    if sys.platform == "darwin":
        # macOS 下打包成 App 运行时会触发 App Translocation 并在只读目录下运行
        # 为避免 OSError: Read-only file system 且方便用户查找，数据存放在文稿目录
        BASE_DIR = os.path.expanduser("~/Documents/小猫Mock")
    else:
        BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "mock_data")
os.makedirs(DATA_DIR, exist_ok=True)

CAPTURED_DATA_PATH = os.path.join(DATA_DIR, "captured_requests.json")
MAX_CAPTURED_REQUESTS = 500  # 增大内存中抓包记录上限

TELEMETRY_CONFIG_PATH = os.path.join(DATA_DIR, "telemetry_config.json")
def get_or_create_device_id() -> str:
    if os.path.exists(TELEMETRY_CONFIG_PATH):
        try:
            with open(TELEMETRY_CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if "device_id" in cfg:
                    return cfg["device_id"]
        except Exception:
            pass
    device_id = uuid.uuid4().hex
    try:
        with open(TELEMETRY_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump({"device_id": device_id}, f, indent=4)
    except Exception:
        pass
    return device_id

telemetry_device_id = get_or_create_device_id()
new_packets_count = 0
session_packets_count = 0  # 记录本次运行抓到的总包数(仅命中的mock)
session_total_requests = 0 # 记录本次运行产生的所有代理请求数

captured_requests = []
_last_save_time = 0

def load_captured_requests():
    """从磁盘恢复历史抓包数据，确保服务器重启后数据不丢失"""
    global captured_requests
    if os.path.exists(CAPTURED_DATA_PATH):
        try:
            with open(CAPTURED_DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    # 恢复请求列表，但将所有 loading 状态重置为 False
                    for entry in data:
                        entry["loading"] = False
                        # 兼容旧数据可能缺少的字段
                        if "req_size" not in entry:
                            entry["req_size"] = 0
                        if "resp_size" not in entry:
                            entry["resp_size"] = 0
                    captured_requests = data
                    print(f"📦 已从磁盘恢复 {len(captured_requests)} 条历史抓包记录")
        except Exception as e:
            print(f"⚠️ 恢复历史抓包记录失败: {e}")
            captured_requests = []

def save_captured_requests():
    """将抓包数据写入磁盘进行持久化（同步写入，足够快）"""
    global _last_save_time
    now = time.time()
    # 防抖：1 秒内最多保存一次，避免高并发时频繁 IO
    if now - _last_save_time < 1.0:
        return
    _last_save_time = now
    try:
        # 只保存已完成（非 loading）的记录，并限制数量
        to_save = [r for r in captured_requests if not r.get("loading", False)]
        if len(to_save) > MAX_CAPTURED_REQUESTS:
            to_save = to_save[-MAX_CAPTURED_REQUESTS:]
        with open(CAPTURED_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(to_save, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ 保存抓包记录失败: {e}")


def detect_business_error(mock_response):
    """从响应体中识别业务层错误（例如 {"status":100,"message":"服务器内部错误"}）。

    这类异常的真实 HTTP 状态码通常是 200（代理透传成功），但响应体里的业务状态码
    表示失败。为了让前端能在列表中把它当作错误高亮、并出现在「错误」过滤器中，这里
    做业务层错误识别。返回 (is_error, business_status)。
    """
    if not mock_response or not isinstance(mock_response, str):
        return False, None
    try:
        data = json.loads(mock_response)
    except Exception:
        return False, None
    if not isinstance(data, dict):
        return False, None
    # 显式的 error 字段（非空字符串 / 布尔真值）
    err = data.get("error")
    if err and str(err).strip().lower() not in ("0", "false", "null", "none", "{}", "[]", ""):
        biz_status = data.get("status") if isinstance(data.get("status"), (int, float)) else None
        return True, biz_status
    # 顶层数字 status / code 字段：0 与 2xx/3xx 视为成功或重定向，其余视为业务错误
    for key in ("status", "code"):
        val = data.get(key)
        if isinstance(val, (int, float)):
            v = int(val)
            if v == 0 or (200 <= v < 400):
                return False, v
            if v < 200 or v >= 400:
                return True, v
    return False, None


# 启动时恢复历史数据
load_captured_requests()

mock_global_enabled = True

class ConfigPayload(BaseModel):
    global_enabled: bool

class MockRule(BaseModel):
    folder: str       
    name: str         
    method: str       
    url_pattern: str  
    status_code: int  
    response_body: str 
    enabled: bool = True 
    delay_ms: int = 0 
    is_stream: bool = False 
    match_params: Optional[Dict[str, str]] = None
    force_new: Optional[bool] = False
    overwrite_rule_name: Optional[str] = None
    overwrite_rule_folder: Optional[str] = None

class ReplayRequestModel(BaseModel):
    url: str
    method: str
    headers: Dict[str, str]
    body: Optional[Any] = None

def get_rule_path(folder: str, name: str) -> str:
    folder_path = os.path.join(DATA_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)
    return os.path.join(folder_path, f"{name}.json")

# 局域网 IP 获取（支持物理机和虚拟机，自动过滤 VPN/Clash 虚拟网卡）
def get_local_ip():
    EXCLUDED_PREFIXES = ("127.", "169.254.", "198.18.", "198.19.", "100.64.")
    LAN_PREFIXES = ("192.168.", "10.", "172.")

    # macOS / Linux：遍历所有接口（不再硬编码 en0，兼容虚拟机桥接网卡）
    if os.name != "nt":
        try:
            out = subprocess.check_output(["ifconfig"], stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore")
            candidates = []
            for line in out.splitlines():
                line = line.strip()
                if line.startswith("inet ") and "127." not in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        ip = parts[1]
                        if not any(ip.startswith(p) for p in EXCLUDED_PREFIXES):
                            candidates.append(ip)
            # 优先返回常见 LAN 段 IP（192.168.x / 10.x / 172.x）
            for ip in candidates:
                if any(ip.startswith(p) for p in LAN_PREFIXES):
                    return ip
            if candidates:
                return candidates[0]
        except Exception:
            pass

    # Windows 或 macOS 兜底：socket 路由探测
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not any(ip.startswith(p) for p in EXCLUDED_PREFIXES):
            return ip
    except Exception:
        pass

    # 最终兜底：hostname 解析
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if any(ip.startswith(p) for p in LAN_PREFIXES):
                return ip
    except Exception:
        pass

    return '127.0.0.1'

@app.get("/", response_class=HTMLResponse)
async def get_index():
    base_dir = os.path.join(sys._MEIPASS, "templates") if getattr(sys, 'frozen', False) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
    
    with open(os.path.join(base_dir, "html", "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
        css = f.read()
    # index-ui.js 走安全读取：若文件缺失（例如旧版打包未包含），降级为空而非抛出 500，
    # 页面其余功能仍可正常访问。
    try:
        with open(os.path.join(base_dir, "js", "index-ui.js"), "r", encoding="utf-8") as f:
            index_ui_js = f.read()
    except FileNotFoundError:
        index_ui_js = ""

    from fastapi import Response
    # 先注入样式与 UI 辅助脚本，再按模块顺序注入各业务 JS（等价于原 app.js）。
    # 任一模块文件缺失时降级为空，避免 500。
    content = html.replace("/* {{STYLE_PLACEHOLDER}} */", css).replace("/* {{INDEX_UI_PLACEHOLDER}} */", index_ui_js)
    for _placeholder, _fname in HTML_PARTIALS:
        try:
            with open(os.path.join(base_dir, _fname), "r", encoding="utf-8") as f:
                # 去掉文件末尾多余换行，保证注入后的 DOM 与原单文件 HTML 逐字节一致
                _html_part = f.read().rstrip("\n")
        except FileNotFoundError:
            _html_part = ""
        content = content.replace(_placeholder, _html_part)
    for _placeholder, _fname in JS_PLACEHOLDERS:
        try:
            with open(os.path.join(base_dir, _fname), "r", encoding="utf-8") as f:
                _js_part = f.read()
        except FileNotFoundError:
            _js_part = ""
        content = content.replace(_placeholder, _js_part)
    return Response(
        content=content,
        media_type="text/html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/en", response_class=HTMLResponse)
async def get_index_en():
    base_dir = os.path.join(sys._MEIPASS, "templates") if getattr(sys, 'frozen', False) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
    
    with open(os.path.join(base_dir, "html", "index_en.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
        css = f.read()
    # index-ui.js 走安全读取：若文件缺失（例如旧版打包未包含），降级为空而非抛出 500，
    # 页面其余功能仍可正常访问。
    try:
        with open(os.path.join(base_dir, "js", "index-ui.js"), "r", encoding="utf-8") as f:
            index_ui_js = f.read()
    except FileNotFoundError:
        index_ui_js = ""

    from fastapi import Response
    # 先注入样式与 UI 辅助脚本，再按模块顺序注入各业务 JS（等价于原 app.js）。
    # 任一模块文件缺失时降级为空，避免 500。
    content = html.replace("/* {{STYLE_PLACEHOLDER}} */", css).replace("/* {{INDEX_UI_PLACEHOLDER}} */", index_ui_js)
    for _placeholder, _fname in HTML_PARTIALS_EN:
        try:
            with open(os.path.join(base_dir, _fname), "r", encoding="utf-8") as f:
                # 去掉文件末尾多余换行，保证注入后的 DOM 与原单文件 HTML 逐字节一致
                _html_part = f.read().rstrip("\n")
        except FileNotFoundError:
            _html_part = ""
        content = content.replace(_placeholder, _html_part)
    for _placeholder, _fname in JS_PLACEHOLDERS:
        try:
            with open(os.path.join(base_dir, _fname), "r", encoding="utf-8") as f:
                _js_part = f.read()
        except FileNotFoundError:
            _js_part = ""
        content = content.replace(_placeholder, _js_part)
    return Response(
        content=content,
        media_type="text/html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/api/server-info")
async def get_server_info():
    local_ip = get_local_ip()
    port = 8099
    return {
        "ip": local_ip,
        "port": port,
        "mock_url": f"http://{local_ip}:{port}/mock",
        "os_name": os.name
    }

@app.get("/api/proxy.mobileconfig")
async def get_proxy_mobileconfig():
    """动态生成 iOS/macOS 代理配置描述文件，用户扫码安装后代理自动生效"""
    import uuid
    local_ip = get_local_ip()
    port = 8099
    profile_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{local_ip}:{port}:profile"))
    payload_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{local_ip}:{port}:payload"))

    mobileconfig = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDescription</key>
            <string>将 HTTP 代理指向「小猫Mock」抓包服务 ({local_ip}:{port})</string>
            <key>PayloadDisplayName</key>
            <string>🐱 小猫Mock HTTP 代理</string>
            <key>PayloadIdentifier</key>
            <string>com.xiaomaomock.proxy.setting</string>
            <key>PayloadOrganization</key>
            <string>小猫Mock抓包工具</string>
            <key>PayloadType</key>
            <string>com.apple.proxy.http.global</string>
            <key>PayloadUUID</key>
            <string>{payload_uuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>ProxyCaptiveLoginAllowed</key>
            <true/>
            <key>ProxyType</key>
            <string>Manual</string>
            <key>ProxyServer</key>
            <string>{local_ip}</string>
            <key>ProxyServerPort</key>
            <integer>{port}</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>安装后将自动把设备 HTTP 流量代理到「小猫Mock」抓包服务 ({local_ip}:{port})，方便抓包与 Mock 调试。卸载即可恢复正常网络。</string>
    <key>PayloadDisplayName</key>
    <string>🐱 小猫Mock抓包代理</string>
    <key>PayloadIdentifier</key>
    <string>com.xiaomaomock.proxy.profile</string>
    <key>PayloadOrganization</key>
    <string>小猫Mock抓包工具</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>{profile_uuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>"""

    return Response(
        content=mobileconfig,
        media_type="application/x-apple-aspen-config",
        headers={"Content-Disposition": "attachment; filename=xiaomaomock.mobileconfig"}
    )

@app.get("/api/config")
async def get_config():
    return {"global_enabled": mock_global_enabled}

@app.post("/api/config")
async def set_config(config: ConfigPayload):
    global mock_global_enabled
    mock_global_enabled = config.global_enabled
    return {"status": "success", "global_enabled": mock_global_enabled}

AI_CONFIG_PATH = os.path.join(DATA_DIR, "ai_config.json")

class AIConfigPayload(BaseModel):
    provider: str
    model: str
    apiKey: str
    endpoint: Optional[str] = None

@app.get("/api/ai-config")
async def get_ai_config():
    if os.path.exists(AI_CONFIG_PATH):
        try:
            with open(AI_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"error": f"Failed to load AI config: {str(e)}"}
    return {}

@app.post("/api/ai-config")
async def save_ai_config(cfg: AIConfigPayload):
    try:
        with open(AI_CONFIG_PATH, "w", encoding="utf-8") as f:
            f.write(cfg.model_dump_json(indent=4))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save AI config: {str(e)}")

@app.get("/api/logs")
async def get_logs():
    return captured_requests[::-1]

@app.delete("/api/logs")
async def clear_logs():
    captured_requests.clear()
    # 同时清除磁盘持久化文件
    try:
        if os.path.exists(CAPTURED_DATA_PATH):
            os.remove(CAPTURED_DATA_PATH)
    except Exception:
        pass
    return {"status": "cleared"}

@app.post("/api/replay-request")
async def replay_request(data: ReplayRequestModel):
    """根据 captured 参数在后台发起真实请求并返回真实数据"""
    import httpx
    # 1. 原样转发 App 所有原始请求头，只排除代理内部标记头
    # 与主代理引擎保持一致，不使用 impersonate（避免与 App 原始头冲突）
    excluded_headers = {
        "host", "x-original-url", "x-original-host", "content-length",
        "x-forwarded-proto", "x-forwarded-for", "x-forwarded-port",
        "x-forwarded-host", "x-real-ip", "x-scheme",
        "connection", "keep-alive", "x-encrypt-type",
    }
    req_headers = {k: v for k, v in data.headers.items() if k.lower() not in excluded_headers}
    
    body_data = data.body
    data_content = None
    if body_data is not None:
        if isinstance(body_data, dict) or isinstance(body_data, list):
            import json
            data_content = json.dumps(body_data).encode("utf-8")
            if "content-type" not in {k.lower() for k in req_headers.keys()}:
                req_headers["Content-Type"] = "application/json"
        else:
            data_content = str(body_data).encode("utf-8")
            
    resp = None
    try:
        # 2. 使用 curl_cffi 直连（不 impersonate），原样转发 App 请求头，proxy="" 禁用系统代理
        from curl_cffi.requests import AsyncSession
        async with AsyncSession(verify=False, proxy="") as client:
            resp = await client.request(
                method=data.method,
                url=data.url,
                headers=req_headers,
                data=data_content,
                timeout=60.0
            )
    except Exception as tls_err:
        # 3. 降级到标准 httpx 发起请求
        try:
            async with httpx.AsyncClient(verify=False, trust_env=False) as client:
                resp = await client.request(
                    method=data.method,
                    url=data.url,
                    headers=req_headers,
                    content=data_content,
                    timeout=60.0
                )
        except Exception as e:
            return {"error": f"后台发送 cURL 失败: {str(e)} (TLS伪装报错: {str(tls_err)})"}
            
    if resp is None:
        return {"error": "后台发送 cURL 失败: 响应为空"}

    # 尝试解析为 JSON，如果是 JSON 则直接返回结构，否则返回 text
    try:
        resp_json = resp.json()
        is_json = True
    except Exception:
        resp_json = resp.text
        is_json = False
        
    return {
        "status_code": resp.status_code,
        "headers": dict(resp.headers),
        "is_json": is_json,
        "data": resp_json
    }

class CurlRequestModel(BaseModel):
    path: str  # 例如 /drama-box/sf001/list

@app.post("/api/curl")
async def curl_request(data: CurlRequestModel):
    """根据已捕获的真实请求拼出一条 curl 命令并在后台执行，返回命令与真实结果。

    用于「重新请求一次某接口」这类需求：从抓包记录里找到该接口最近一次真实请求，
    原样还原 method / url / headers / body，用 subprocess 调 curl 真正打到上游，回显命令与响应。
    """
    norm = data.path.strip().lstrip("/").lower()
    target = None
    for log in reversed(captured_requests):
        lp = (log.get("path") or "").lstrip("/").lower()
        ou = (log.get("original_url") or "").lower()
        if lp == norm or (norm and (norm in ou or ou.endswith(norm) or lp.endswith(norm))):
            target = log
            break
    if not target:
        return {"found": False,
                "error": f"未找到接口 {data.path} 的已捕获请求，无法重放（请先让 App 请求过该接口，或通过 x-original-url 记录到真实目标）"}

    url = target.get("original_url") or target.get("url")
    method = target.get("method", "GET")
    excluded_headers = {
        "host", "x-original-url", "x-original-host", "content-length",
        "x-forwarded-proto", "x-forwarded-for", "x-forwarded-port",
        "x-forwarded-host", "x-real-ip", "x-scheme",
        "connection", "keep-alive", "x-encrypt-type",
    }
    headers = {k: v for k, v in (target.get("headers") or {}).items() if k.lower() not in excluded_headers}
    body = target.get("body")

    # 拼 curl 命令（列表形式执行，避免 shell 注入；display 仅用于回显）
    cmd = ["curl", "-sS", "-X", method, url]
    for k, v in headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        data_str = json.dumps(body, ensure_ascii=False) if isinstance(body, (dict, list)) else str(body)
        cmd += ["--data", data_str]
    cmd += ["-w", "\n__HTTP_STATUS__:%{http_code}"]

    display = " ".join(cmd)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        out = proc.stdout or ""
        status = None
        m = re.search(r"__HTTP_STATUS__:(\d+)", out)
        if m:
            status = int(m.group(1))
            out = out[:m.start()].rstrip()
        return {
            "found": True,
            "command": display,
            "output": out,
            "status_code": status,
            "stderr": proc.stderr or "",
        }
    except FileNotFoundError:
        return {"found": True, "command": display, "error": "服务器未安装 curl 命令，无法执行重放"}
    except Exception as e:
        return {"found": True, "command": display, "error": f"curl 执行失败: {str(e)}"}

class AIChatPayload(BaseModel):
    provider: str          # "deepseek" | "claude" | "openai" | "custom"
    model: str
    api_key: str
    endpoint: Optional[str] = None   # 自定义 Base URL
    system_prompt: str
    user_prompt: str

@app.post("/api/ai-chat")
async def ai_chat_proxy(payload: AIChatPayload):
    """
    AI 对话代理接口：将前端请求转发到各 AI 服务商，解决浏览器 CORS 限制。
    支持 SSE 流式输出。
    """
    DEFAULT_ENDPOINTS = {
        "deepseek": "https://api.deepseek.com/v1/chat/completions",
        "openai":   "https://api.openai.com/v1/chat/completions",
        "claude":   "https://api.anthropic.com/v1/messages",
    }

    is_claude = (payload.provider == "claude")

    if is_claude:
        # ── Anthropic Claude 格式 ──
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": payload.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": payload.model,
            "max_tokens": 4096,
            "stream": True,
            "system": payload.system_prompt,
            "messages": [{"role": "user", "content": payload.user_prompt}],
        }
    else:
        # ── OpenAI 兼容格式（DeepSeek / OpenAI / 自定义）──
        if payload.provider == "custom":
            base = (payload.endpoint or "").rstrip("/")
            if not base:
                raise HTTPException(status_code=400, detail="自定义模式需要填写 API Base URL")
            
            # 智能补全完整路径
            if base.endswith("/chat/completions"):
                url = base
            elif base.endswith("/v1"):
                url = base + "/chat/completions"
            else:
                url = base + "/v1/chat/completions"
        else:
            url = DEFAULT_ENDPOINTS.get(payload.provider, DEFAULT_ENDPOINTS["openai"])
        headers = {
            "Authorization": f"Bearer {payload.api_key}",
            "content-type": "application/json",
        }
        body = {
            "model": payload.model,
            "stream": True,
            "messages": [
                {"role": "system", "content": payload.system_prompt},
                {"role": "user",   "content": payload.user_prompt},
            ],
        }

    async def stream_generator():
        try:
            async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code != 200:
                        err = await resp.aread()
                        err_text = err.decode("utf-8", errors="ignore")
                        yield f"data: {json.dumps({'error': f'HTTP {resp.status_code}: {err_text}'})}\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if line:
                            yield f"{line}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.post("/api/rules")
async def save_rule(rule: MockRule):
    if not rule.name or rule.name == "undefined" or rule.name == "null":
        return {"status": "error", "message": "Invalid rule name"}
    if not rule.folder or rule.folder == "undefined" or rule.folder == "null":
        rule.folder = "未分类"
        
    if rule.url_pattern == "undefined":
        return {"status": "error", "message": "Invalid url pattern: undefined"}

    # 如果是从 prompt 点了 "覆盖"，先删除老的
    if rule.overwrite_rule_name:
        old_folder = rule.overwrite_rule_folder or rule.folder
        old_path = get_rule_path(old_folder, rule.overwrite_rule_name)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except:
                pass

    path = get_rule_path(rule.folder, rule.name)

    # 检查是否存在冲突或需要另存为2个
    if not rule.force_new and not rule.overwrite_rule_name:
        for root, dirs, files in os.walk(DATA_DIR):
            if os.path.basename(root) == "undefined":
                continue
            for file in files:
                if file.endswith(".json") and file not in ["ai_config.json", "telemetry_config.json"]:
                    file_path = os.path.join(root, file)
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            existing_rule = json.load(f)
                    except:
                        continue

                    # 跳过非对象（如数组）或非规则类的 JSON 文件，避免解析报错导致保存失败
                    if not isinstance(existing_rule, dict):
                        continue

                    if existing_rule.get("method") != rule.method:
                        continue
                        
                    # 如果path相同、但”Matching Params (Optional)“不同，保存为2个
                    if existing_rule.get("url_pattern") == rule.url_pattern and existing_rule.get("match_params") != rule.match_params:
                        if file_path == path: # 只有覆盖同名文件时，才需要改名以保存为2个
                            base_name = rule.name
                            counter = 1
                            while True:
                                new_name = f"{base_name}_{counter}"
                                new_path = get_rule_path(rule.folder, new_name)
                                if not os.path.exists(new_path):
                                    rule.name = new_name
                                    path = new_path
                                    break
                                counter += 1
                        continue
                        
                    # 如果path相同，仅仅Rule Name 不同 (meaning url_pattern same, match_params same)
                    if existing_rule.get("url_pattern") == rule.url_pattern and existing_rule.get("match_params") == rule.match_params:
                        if file_path != path:
                            rel_folder = os.path.relpath(root, DATA_DIR)
                            if rel_folder == ".": rel_folder = "未分类"
                            return {
                                "status": "prompt_conflict",
                                "conflict_name": existing_rule.get("name", file.replace(".json", "")),
                                "conflict_folder": rel_folder
                            }

    with open(path, "w", encoding="utf-8") as f:
        f.write(rule.model_dump_json(indent=4))
    return {"status": "success", "new_name": rule.name}

@app.delete("/api/rules")
async def delete_rule(folder: str, name: str):
    path = get_rule_path(folder, name)
    deleted = False
    if os.path.exists(path):
        os.remove(path)
        deleted = True
        
    # 额外清理历史遗留的、直接放在根目录下的规则文件
    if folder == "未分类" or not folder:
        legacy_path = os.path.join(DATA_DIR, f"{name}.json")
        if os.path.exists(legacy_path):
            try:
                os.remove(legacy_path)
                deleted = True
            except:
                pass
                
    if deleted:
        # 如果子文件夹空了，也删除空文件夹
        folder_dir = os.path.dirname(path)
        if os.path.exists(folder_dir) and len(os.listdir(folder_dir)) == 0:
            try:
                os.rmdir(folder_dir)
            except:
                pass
        return {"status": "success"}
    return {"status": "error", "message": "Rule file not found"}

@app.delete("/api/categories")
async def delete_category(name: str):
    if name == "未分类":
        # 删除根目录下的所有 json 规则文件
        for file in os.listdir(DATA_DIR):
            if file.endswith(".json"):
                try:
                    os.remove(os.path.join(DATA_DIR, file))
                except:
                    pass
        # 同时也删除可能存在的 '未分类' 文件夹
        unclassified_path = os.path.join(DATA_DIR, "未分类")
        if os.path.exists(unclassified_path):
            try:
                shutil.rmtree(unclassified_path)
            except:
                pass
    else:
        path = os.path.join(DATA_DIR, name)
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
            except Exception as e:
                return {"status": "error", "message": f"Failed to delete directory: {str(e)}"}
    return {"status": "success"}

@app.put("/api/categories")
async def rename_category(old_name: str, new_name: str):
    if not new_name.strip():
        return {"status": "error", "message": "New name cannot be empty"}
    if old_name == new_name:
        return {"status": "success"}
        
    old_path = os.path.join(DATA_DIR, old_name)
    new_path = os.path.join(DATA_DIR, new_name)
    
    os.makedirs(new_path, exist_ok=True)
    
    if old_name == "未分类":
        # 移动根目录下和 '未分类' 目录下的所有 json 规则文件
        for root_dir in [DATA_DIR, os.path.join(DATA_DIR, "未分类")]:
            if not os.path.exists(root_dir):
                continue
            for file in os.listdir(root_dir):
                src = os.path.join(root_dir, file)
                if file.endswith(".json") and os.path.isfile(src):
                    dest = os.path.join(new_path, file)
                    shutil.move(src, dest)
                    # 更新 rule file 中的 folder 属性
                    try:
                        with open(dest, "r+", encoding="utf-8") as f:
                            data = json.load(f)
                            data["folder"] = new_name
                            f.seek(0)
                            json.dump(data, f, indent=4, ensure_ascii=False)
                            f.truncate()
                    except:
                        pass
        # 清理空的 '未分类' 文件夹
        unclassified_path = os.path.join(DATA_DIR, "未分类")
        if os.path.exists(unclassified_path):
            try:
                os.rmdir(unclassified_path)
            except:
                pass
    else:
        if os.path.exists(old_path):
            for file in os.listdir(old_path):
                src = os.path.join(old_path, file)
                if file.endswith(".json") and os.path.isfile(src):
                    dest = os.path.join(new_path, file)
                    shutil.move(src, dest)
                    try:
                        with open(dest, "r+", encoding="utf-8") as f:
                            data = json.load(f)
                            data["folder"] = new_name
                            f.seek(0)
                            json.dump(data, f, indent=4, ensure_ascii=False)
                            f.truncate()
                    except:
                        pass
            try:
                os.rmdir(old_path)
            except:
                pass
                
    return {"status": "success"}

@app.get("/api/rules")
async def list_rules():
    rules_tree = {}
    for root, dirs, files in os.walk(DATA_DIR):
        if os.path.basename(root) == "undefined":
            continue
        for file in files:
            if file.endswith(".json") and file != "undefined.json":
                if file in ["ai_config.json", "telemetry_config.json"]:
                    continue
                
                rel_folder = os.path.relpath(root, DATA_DIR)
                if rel_folder == ".": rel_folder = "未分类"
                
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    try:
                        rule_data = json.load(f)
                        if rule_data.get("url_pattern") == "undefined":
                            try:
                                os.remove(file_path)
                            except:
                                pass
                            continue

                        if not rule_data.get("name") or rule_data.get("name") == "undefined":
                            rule_data["name"] = file.replace(".json", "")
                        if not rule_data.get("folder") or rule_data.get("folder") == "undefined":
                            rule_data["folder"] = rel_folder
                        rules_tree.setdefault(rel_folder, []).append(rule_data)
                    except:
                        pass
    return rules_tree

@app.api_route("/mock/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def handle_mock_request(path: str, request: Request):
    global session_total_requests
    session_total_requests += 1
    
    method = request.method
    full_url = str(request.url)
    request_start = time.time()  # 记录请求开始时间，用于计算耗时

    # 分离 path 和 query string
    url_path = f"/{path}"
    query_string = str(request.url.query)
    query_params = dict(request.query_params)

    # ─── 智能提取并重组真实的原始目标 URL ───
    original_url = request.headers.get("x-original-url")
    real_target_url = original_url
    if original_url:
        try:
            from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
            parsed_url = urlparse(original_url)
            original_params = parse_qsl(parsed_url.query)
            current_params = parse_qsl(query_string) if query_string else []
            
            merged_params = {}
            for k, v in original_params:
                merged_params[k] = v
            for k, v in current_params:
                merged_params[k] = v
                
            new_query = urlencode(list(merged_params.items()))
            real_target_url = urlunparse((
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                new_query,
                parsed_url.fragment
            ))
        except:
            pass

    log_entry = {
        "id": int(request_start * 1000),
        "time": time.strftime("%H:%M:%S"),
        "method": method,
        "url": full_url,
        "original_url": real_target_url or full_url,  # 真实的原始目标 URL！
        "path": url_path,
        "query_params": query_params,
        "headers": dict(request.headers),
        "body": None,          # 将在子函数中填充
        "status": None,        # 请求完成后写入
        "duration_ms": None,   # 请求完成后写入
        "loading": True,       # 请求完成前标记为 loading
        "req_size": 0,         # 将在子函数中填充
        "resp_size": 0
    }
    captured_requests.append(log_entry)
    if len(captured_requests) > MAX_CAPTURED_REQUESTS: captured_requests.pop(0)

    try:
        return await _process_mock_request(path, request, log_entry, request_start, real_target_url)
    except asyncio.CancelledError as ce:
        log_entry["status"] = 499
        log_entry["mock_status"] = 499
        log_entry["mock_response"] = "Client Disconnected / Request Cancelled"
        log_entry["loading"] = False
        log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
        save_captured_requests()
        raise ce
    except BaseException as be:
        log_entry["status"] = 500
        log_entry["mock_status"] = 500
        log_entry["mock_response"] = f"Request error: {str(be)}"
        log_entry["loading"] = False
        log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
        save_captured_requests()
        raise be
    finally:
        # 确保 loading 状态被正确重置，并补全所有关键字段（防止前端渲染异常）
        if log_entry.get("loading", True):
            log_entry["loading"] = False
            if log_entry.get("status") is None:
                log_entry["status"] = 500
            if log_entry.get("duration_ms") is None:
                log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
        # 兜底补全前端渲染必需字段，避免因字段缺失导致前端列表跳过或渲染异常
        log_entry.setdefault("mock_matched", False)
        log_entry.setdefault("mock_response", None)
        log_entry.setdefault("mock_status", log_entry.get("status", 0))
        log_entry.setdefault("resp_size", 0)
        log_entry.setdefault("req_size", 0)
        log_entry.setdefault("response_headers", {})
        # 业务层错误识别：HTTP 200 但响应体里携带着失败的业务状态码（如 status:100）
        _is_biz_err, _biz_status = detect_business_error(log_entry.get("mock_response"))
        if _is_biz_err:
            log_entry["business_error"] = True
            if _biz_status is not None:
                log_entry["business_status"] = _biz_status
            log_entry.setdefault("error", True)
        else:
            log_entry.setdefault("business_error", False)
        # 请求完成后持久化到磁盘
        save_captured_requests()

async def _process_mock_request(path: str, request: Request, log_entry: dict, request_start: float, real_target_url: str):
    method = request.method
    full_url = str(request.url)
    url_path = f"/{path}"
    query_string = str(request.url.query)
    query_params = dict(request.query_params)
    match_target = url_path

    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="ignore")
    
    # ─── 自动支持大数据 LZ4 压缩解压 ───
    is_lz4 = (request.headers.get("x-encrypt-type") == "1000" or 
              request.headers.get("content-type") == "application/octet-stream")
    raw_size_str = request.headers.get("content-raw-size")
    
    if is_lz4 and raw_size_str:
        try:
            raw_size = int(raw_size_str)
            import lz4.block
            # Moya HMBatchReportService 压缩数据不带 4 字节 header 长度，直接使用 raw_size 作为 uncompressed_size
            decompressed = lz4.block.decompress(body_bytes, uncompressed_size=raw_size)
            body_str = decompressed.decode("utf-8", errors="ignore")
        except ImportError:
            body_str = (
                "🔔 [提示] 检测到此请求是经过 LZ4 压缩的大数据埋点上报日志。\n"
                "如果需要在网页控制台查看解压后的完整 JSON 树，请在 Mac 终端运行：\n\n"
                "   pip install lz4\n\n"
                "安装完成后重启 Mock 服务即可自动解压显示！\n\n"
                f"—— 原始未解压片段 ──\n{body_str}"
            )
        except Exception as e:
            body_str = f"❌ [解压失败] LZ4 解压出错: {str(e)}\n\n—— 原始数据 ──\n{body_str}"

    body_json = None
    try:
        body_json = json.loads(body_str)
    except:
        body_json = body_str if body_str else None

    req_headers_size = sum(len(k.encode('utf-8')) + len(v.encode('utf-8')) + 4 for k, v in request.headers.items()) + len(method) + len(full_url) + 12
    req_size = req_headers_size + len(body_bytes)

    # 填充 log_entry
    log_entry["body"] = body_json
    log_entry["req_size"] = req_size

    # ─── 智能匹配引擎 ───────────────────────────────────────────
    # 规则：收集所有方法匹配的规则，优先命中配置了“Matching Params”的规则，匹配参数越多优先级越高
    # 参数数量相同时，按 url_pattern 长度降序排列
    matched_rule = None
    best_len = -1
    best_match_params_count = -1

    if mock_global_enabled:
        for root, _, files in os.walk(DATA_DIR):
            for file in files:
                if not file.endswith(".json"):
                    continue
                if file in ["ai_config.json", "telemetry_config.json", "localtunnel_config.json"]:
                    continue
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        rule = json.load(f)

                    if rule.get("method") != method:
                        continue

                    # 检查单条规则是否启用
                    if not rule.get("enabled", True):
                        continue

                    pattern = rule.get("url_pattern", "")

                    # 参数匹配逻辑
                    match_params = rule.get("match_params")
                    params_matched = True
                    if match_params:
                        for k, v in match_params.items():
                            val_in_req = query_params.get(k)
                            if val_in_req is None and isinstance(body_json, dict):
                                val_in_req = body_json.get(k)
                            if str(val_in_req) != str(v):
                                params_matched = False
                                break
                    if not params_matched:
                        continue

                    # 匹配逻辑：pattern 是 match_target 的子串即命中
                    if pattern and pattern in match_target:
                        matched_params_count = len(match_params) if match_params else 0
                        # 优先命中配置了匹配参数越多的规则
                        if matched_params_count > best_match_params_count:
                            best_match_params_count = matched_params_count
                            best_len = len(pattern)
                            matched_rule = rule
                        elif matched_params_count == best_match_params_count:
                            # 若参数数量相同，再比较 pattern 长度
                            if len(pattern) > best_len:
                                best_len = len(pattern)
                                matched_rule = rule
                except:
                    pass

    if matched_rule:
        global new_packets_count, session_packets_count
        new_packets_count += 1
        session_packets_count += 1

        # 增加 Mock 响应延迟
        delay_ms = matched_rule.get("delay_ms", 0)
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

        # 将命中结果写回日志条目
        log_entry["mock_matched"] = True
        log_entry["mock_rule_name"] = matched_rule.get("name", "")
        log_entry["mock_rule_folder"] = matched_rule.get("folder", "")
        log_entry["mock_delay"] = delay_ms
        log_entry["mock_response"] = matched_rule.get("response_body", "")
        log_entry["mock_status"] = matched_rule.get("status_code", 200)
        log_entry["mock_rule_enabled"] = matched_rule.get("enabled", True)
        log_entry["mock_match_params"] = matched_rule.get("match_params", None)
        log_entry["status"] = matched_rule.get("status_code", 200)
        log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
        log_entry["loading"] = False
        
        resp_body_str = matched_rule.get("response_body", "")
        log_entry["resp_size"] = len(resp_body_str.encode("utf-8", errors="ignore")) + 200
        
        if matched_rule.get("is_stream", False):
            stream_headers = {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "X-Mock-Engine": "XiaoMaoMockServer"
            }
            log_entry["response_headers"] = stream_headers

            async def event_generator():
                body = matched_rule.get("response_body", "")
                normalized_body = body.replace("\r\n", "\n")
                
                if "\n\n" in normalized_body:
                    blocks = normalized_body.split("\n\n")
                    for i, block in enumerate(blocks):
                        block_stripped = block.strip()
                        if not block_stripped:
                            continue
                        yield f"{block_stripped}\n\n"
                        if i < len(blocks) - 1:
                            await asyncio.sleep(0.1)
                else:
                    lines = normalized_body.split("\n")
                    for i, line in enumerate(lines):
                        yield f"{line}\n"
                        if i < len(lines) - 1:
                            await asyncio.sleep(0.05)

            return StreamingResponse(event_generator(), media_type="text/event-stream", headers=stream_headers)
        else:
            log_entry["response_headers"] = {"Content-Type": "application/json", "X-Mock-Engine": "XiaoMaoMockServer"}
            return Response(
                content=matched_rule.get("response_body", ""),
                status_code=matched_rule.get("status_code", 200),
                media_type="application/json"
            )

    # 未命中规则 (或者 Mock 开关关闭/规则关闭)，如果有 x-original-url，则进行代理透传
    log_entry["mock_matched"] = False
    original_url = request.headers.get("x-original-url")
    if original_url:
        try:
            if not original_url.startswith("http://") and not original_url.startswith("https://"):
                if "devdrama" in original_url:
                    original_url = "http://" + original_url
                else:
                    original_url = "https://" + original_url

            from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
            parsed_url = urlparse(original_url)
            original_params = parse_qsl(parsed_url.query)
            current_params = parse_qsl(query_string) if query_string else []
            
            merged_params = {}
            for k, v in original_params:
                merged_params[k] = v
            for k, v in current_params:
                merged_params[k] = v
                
            new_query = urlencode(list(merged_params.items()))
            
            scheme = parsed_url.scheme
            if "dramabox" in parsed_url.netloc:
                scheme = "https"
                
            real_url = urlunparse((
                scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                new_query,
                parsed_url.fragment
            ))

            print(f"\n✨ [MockServer Proxy] 转发请求: {method} {real_url}")
            log_entry["proxy_real_url"] = real_url

            proxy_headers = {}
            excluded_headers = {
                "host",
                "x-original-url",
                "x-original-host",
                "content-length",
                "x-forwarded-proto", "x-forwarded-for", "x-forwarded-port",
                "x-forwarded-host", "x-real-ip", "x-scheme",
                "connection", "keep-alive",
                "x-encrypt-type",
            }
            for k, v in request.headers.items():
                if k.lower() not in excluded_headers:
                    proxy_headers[k] = v
            
            forwarded_keys = list(proxy_headers.keys())
            print(f"   📋 [Proxy Headers] 共 {len(forwarded_keys)} 个头: {', '.join(forwarded_keys[:15])}{'...' if len(forwarded_keys) > 15 else ''}")
            
            is_stream_request = (
                "text/event-stream" in request.headers.get("accept", "").lower() or
                "stream" in url_path.lower()
            )

            if is_stream_request:
                async def stream_proxy():
                    accumulated = []
                    try:
                        try:
                            from curl_cffi.requests import AsyncSession
                            async with AsyncSession(verify=False, proxy="") as client:
                                async with client.stream(
                                    method=method,
                                    url=real_url,
                                    headers=proxy_headers,
                                    data=body_bytes,
                                    timeout=60.0
                                ) as resp:
                                    log_entry["mock_status"] = resp.status_code
                                    resp_headers = {}
                                    for k, v in resp.headers.items():
                                        if k.lower() not in ["content-encoding", "transfer-encoding", "content-length", "connection"]:
                                            resp_headers[k] = v
                                    log_entry["response_headers"] = resp_headers
                                    log_entry["status"] = resp.status_code
                                    
                                    async for chunk in resp.aiter_bytes():
                                        accumulated.append(chunk)
                                        log_entry["mock_response"] = b"".join(accumulated).decode("utf-8", errors="ignore")
                                        log_entry["resp_size"] = log_entry.get("resp_size", 0) + len(chunk)
                                        yield chunk
                        except Exception as stream_tls_err:
                            print(f"[Stream Proxy] curl_cffi 失败，降级 httpx: {str(stream_tls_err)}")
                            async with httpx.AsyncClient(verify=False, trust_env=False) as client:
                                async with client.stream(
                                    method=method,
                                    url=real_url,
                                    headers=proxy_headers,
                                    content=body_bytes,
                                    timeout=60.0
                                ) as resp:
                                    log_entry["mock_status"] = resp.status_code
                                    resp_headers = {}
                                    for k, v in resp.headers.items():
                                        if k.lower() not in ["content-encoding", "transfer-encoding", "content-length", "connection"]:
                                            resp_headers[k] = v
                                    log_entry["response_headers"] = resp_headers
                                    log_entry["status"] = resp.status_code
                                    
                                    async for chunk in resp.aiter_bytes():
                                        accumulated.append(chunk)
                                        log_entry["mock_response"] = b"".join(accumulated).decode("utf-8", errors="ignore")
                                        log_entry["resp_size"] = log_entry.get("resp_size", 0) + len(chunk)
                                        yield chunk
                                    
                    except Exception as e:
                        import traceback
                        err_detail = traceback.format_exc()
                        print(f"[Stream Proxy Error] {err_detail}")
                        log_entry["mock_status"] = 502
                        log_entry["status"] = 502
                        err_msg = json.dumps({"error": str(e)})
                        log_entry["mock_response"] = log_entry.get("mock_response", "") + "\n" + err_msg
                        yield err_msg.encode('utf-8')
                    finally:
                        log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
                        log_entry["loading"] = False
                        # 业务层错误识别（流式响应同样适用）
                        _is_biz_err, _biz_status = detect_business_error(log_entry.get("mock_response"))
                        if _is_biz_err:
                            log_entry["business_error"] = True
                            if _biz_status is not None:
                                log_entry["business_status"] = _biz_status
                            log_entry.setdefault("error", True)
                        else:
                            log_entry.setdefault("business_error", False)

                stream_headers = {
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                }
                return StreamingResponse(stream_proxy(), media_type="text/event-stream", headers=stream_headers)
            else:
                # ─── 非 Stream 代理请求 ───────────────────────
                resp = None
                try:
                    from curl_cffi.requests import AsyncSession
                    async with AsyncSession(verify=False, proxy="") as client:
                        resp = await client.request(
                            method=method,
                            url=real_url,
                            headers=proxy_headers,
                            data=body_bytes,
                            timeout=60.0
                        )
                except Exception as tls_err:
                    print(f"[Proxy] curl_cffi 请求失败，降级到 httpx: {str(tls_err)}")
                    try:
                        async with httpx.AsyncClient(verify=False, trust_env=False) as client:
                            resp = await client.request(
                                method=method,
                                url=real_url,
                                headers=proxy_headers,
                                content=body_bytes,
                                timeout=60.0
                            )
                    except Exception as httpx_err:
                        raise Exception(f"curl_cffi 和 httpx 均请求失败: {str(httpx_err)}") from httpx_err
                
                # ─── 安全提取响应数据（每一步独立 try/except，确保 log_entry 不会半途而废）───
                if resp is None:
                    raise Exception("Proxy response is None - both curl_cffi and httpx returned no response")
                
                resp_status = 502
                resp_text = ""
                resp_content = b""
                resp_headers = {}
                
                try:
                    resp_status = resp.status_code
                except Exception as e:
                    print(f"[Proxy WARN] 无法读取 status_code: {e}")
                
                try:
                    resp_text = resp.text if resp.text else ""
                except Exception as e:
                    print(f"[Proxy WARN] 无法读取 response text: {e}")
                    resp_text = f"[Response body decode failed: {str(e)}]"
                
                try:
                    resp_content = resp.content if resp.content else b""
                except Exception as e:
                    print(f"[Proxy WARN] 无法读取 response content: {e}")
                    resp_content = resp_text.encode("utf-8", errors="ignore") if resp_text else b""
                
                try:
                    for k, v in (resp.headers.items() if hasattr(resp, 'headers') and resp.headers else []):
                        if k.lower() not in ["content-encoding", "transfer-encoding", "content-length", "connection"]:
                            resp_headers[k] = v
                except Exception as e:
                    print(f"[Proxy WARN] 无法读取 response headers: {e}")
                
                # ─── 填充 log_entry（所有关键字段必须在此写入）───
                log_entry["mock_response"] = resp_text
                log_entry["mock_status"] = resp_status
                log_entry["response_headers"] = resp_headers
                log_entry["status"] = resp_status
                log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
                log_entry["loading"] = False
                log_entry["resp_size"] = (
                    len(resp_content) +
                    sum(len(str(k).encode('utf-8')) + len(str(v).encode('utf-8')) + 4 for k, v in resp_headers.items()) +
                    15
                )
                
                print(f"✅ [Proxy OK] {method} {real_url} → {resp_status} ({log_entry['duration_ms']}ms)")  # 诊断日志
                
                return Response(
                    content=resp_content if resp_content else resp_text,
                    status_code=resp_status,
                    headers=resp_headers
                )
        except BaseException as e:
            import traceback
            err_detail = traceback.format_exc()
            err_str = str(e).lower()
            status_code = 504 if ("timeout" in err_str or "timed out" in err_str) else 502
            log_entry["mock_response"] = f"Proxy error: {str(e)}"
            log_entry["mock_status"] = status_code
            log_entry["status"] = status_code
            log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
            log_entry["loading"] = False
            log_entry.setdefault("resp_size", 0)
            print(f"[MockServer PROXY ERROR] real_url={log_entry.get('proxy_real_url', original_url)}\n{err_detail}")
            return Response(
                content=json.dumps({"error": "MockServer Proxy Error", "details": str(e)}),
                status_code=status_code,
                media_type="application/json"
            )

    log_entry["mock_response"] = None
    log_entry["status"] = 200
    log_entry["duration_ms"] = round((time.time() - request_start) * 1000)
    log_entry["loading"] = False
    return {
        "message": "Default Mock Response — 未命中任何规则",
        "tips": "在左侧日志点击此请求，可一键填入规则并保存",
        "captured_info": {"path": url_path, "query_params": query_params, "method": method}
    }

# ─── 遥测与全局统计上报模块 ───
TELEMETRY_HEARTBEAT_URL = "https://my-mini-mock.lihongli528628.workers.dev/api/heartbeat"
TELEMETRY_STATS_URL = "https://my-mini-mock.lihongli528628.workers.dev/api/dashboard"

async def telemetry_heartbeat_loop():
    global new_packets_count
    # 1. 发送初始启动打点 (device_id 蛇形命名适配)
    startup_payload = {
        "device_id": telemetry_device_id,
        "packets": 0
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(TELEMETRY_HEARTBEAT_URL, json=startup_payload)
    except Exception:
        pass

    # 2. 定时心跳循环上报 (每60秒一次)
    while True:
        await asyncio.sleep(60)
        current_packets = new_packets_count
        new_packets_count = 0
        
        # 上报设备心跳与待递增的抓包数
        payload = {
            "device_id": telemetry_device_id,
            "packets": current_packets
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(TELEMETRY_HEARTBEAT_URL, json=payload)
        except Exception:
            pass

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_heartbeat_loop())

_stats_cache = {"data": None, "timestamp": 0}

@app.get("/api/telemetry-stats")
async def get_telemetry_stats():
    """获取 Cloudflare 上的全局在线用户、总用户、总抓包量统计数据 (5秒缓存，匹配 D1 数据库字段)"""
    global _stats_cache
    now = time.time()
    if _stats_cache["data"] and (now - _stats_cache["timestamp"] < 5.0):
        return _stats_cache["data"]
        
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(TELEMETRY_STATS_URL)
            data = resp.json()
            worker_total = data.get("total_mock_requests", 0)
            
            # 解决 Worker 没修好时全局一直为 0，以及同步延迟的问题
            # 如果 Worker 返回的值小于本次启动抓到的包，说明 Worker 没正常工作，直接显示本地统计
            if worker_total < session_packets_count:
                display_total = session_packets_count
            else:
                # 如果 Worker 正常，就加上还未上报的 new_packets_count，实现真正的实时跳动
                display_total = worker_total + new_packets_count

            # 深度对齐并映射用户的 D1 数据库字段格式
            mapped_data = {
                "online_users": data.get("online_users", 1),
                "total_users": data.get("total_users", 1),
                "total_packets": display_total,
                "session_mocked": session_packets_count,
                "session_total": session_total_requests
            }
            _stats_cache["data"] = mapped_data
            _stats_cache["timestamp"] = now
            return mapped_data
    except Exception as e:
        if _stats_cache["data"]:
            # 在缓存返回时，也保证本地未上报的数量加进去
            cached = _stats_cache["data"].copy()
            if cached["total_packets"] < session_packets_count:
                cached["total_packets"] = session_packets_count
            else:
                cached["total_packets"] += new_packets_count
            cached["session_mocked"] = session_packets_count
            cached["session_total"] = session_total_requests
            return cached
        return {
            "error": str(e), 
            "online_users": 1, 
            "total_users": 1, 
            "total_packets": session_packets_count,
            "session_mocked": session_packets_count,
            "session_total": session_total_requests
        }

if __name__ == "__main__":
    import uvicorn
    local_ip = get_local_ip()
    print(f"\n🚀 🐱「小猫Mock」抓包服务已启动")
    print(f"   本机控制台 : http://127.0.0.1:8099")
    print(f"   局域网控制台: http://{local_ip}:8099")
    print(f"   App「小猫Mock」代理前缀: http://{local_ip}:8099/mock/...\n")
    
    if os.name == "nt":
        print("="*60)
        print("⚠️  [Windows 用户注意] 若手机扫码后无法连接网络：")
        print("   1. 防火墙拦截：请检查【Windows Defender 防火墙】，必须允许「小猫Mock.exe」通过（勾选专用网络和公用网络）。")
        print("   2. 虚拟机网络：如果 Windows 运行在 Parallels Desktop/VMware 中，请在虚拟机设置中将网络模式改为【桥接模式(Bridged)】，否则手机无法访问其内网 IP。")
        print("="*60 + "\n")
        
    import threading
    import webbrowser
    import time

    def open_browser():
        time.sleep(1.5)
        try:
            webbrowser.open("http://127.0.0.1:8099")
        except:
            pass

    threading.Thread(target=open_browser, daemon=True).start()
    
    uvicorn.run(app, host="0.0.0.0", port=8099)
