import os
# 清理系统代理环境变量，避免 pip install 因为残留的代理设置导致连接 127.0.0.1:7890 失败
for env_key in ["http_proxy", "https_proxy", "all_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]:
    os.environ.pop(env_key, None)

import sys
import shutil
import subprocess
import re


def _get_app_version():
    """从 server.py 读取 APP_VERSION，作为唯一版本源"""
    try:
        with open("server.py", "r", encoding="utf-8") as f:
            content = f.read()
        m = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', content)
        if m:
            return m.group(1)
    except Exception:
        pass
    return "1.0.0"


_APP_VERSION = _get_app_version()
_APP_VERSION_SHORT = ".".join(_APP_VERSION.split(".")[:2])  # major.minor

def clean_builds():
    print("🧹 Cleaning up old build artifacts...")
    dirs_to_clean = ["build", "dist"]
    files_to_clean = ["server.spec", "小猫Mock.spec", "MockServer.spec"]
    for d in dirs_to_clean:
        if os.path.exists(d):
            try:
                shutil.rmtree(d)
            except Exception as e:
                print(f"⚠️ Warning: Could not remove folder {d}: {e}")
    for f in files_to_clean:
        if os.path.exists(f):
            try:
                os.remove(f)
            except Exception as e:
                print(f"⚠️ Warning: Could not remove file {f}: {e}")

def package():
    clean_builds()
    print("📦 Bootstrapping PyInstaller compilation...")

    # 1. 确保安装了 pyinstaller
    try:
        import PyInstaller
    except ImportError:
        print("📦 Installing PyInstaller dependency...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller", "--break-system-packages"])

    # 1.5 预检 ngrok 二进制以支持跨网联通功能
    print("⚡ Checking ngrok availability for cross-network tunneling...")
    ngrok_cmd = None
    if shutil.which("ngrok"):
        ngrok_cmd = "ngrok"
    else:
        # 探测常见路径以给出准确警告
        if os.name == "nt":
            app_data = os.environ.get("APPDATA", "")
            program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
            fallback_paths = []
            if app_data:
                fallback_paths.append(os.path.join(app_data, "ngrok", "ngrok.exe"))
            fallback_paths.append(os.path.join(program_files, "ngrok", "ngrok.exe"))
            for path in fallback_paths:
                if os.path.exists(path):
                    ngrok_cmd = path
                    break
        else:
            home = os.path.expanduser("~")
            fallback_paths = [
                "/opt/homebrew/bin/ngrok",
                "/usr/local/bin/ngrok",
                "/usr/bin/ngrok",
                os.path.join(home, ".local/bin/ngrok"),
            ]
            for path in fallback_paths:
                if os.path.exists(path):
                    ngrok_cmd = path
                    break
    if ngrok_cmd:
        print(f"✅ ngrok verified at: {ngrok_cmd}")
    else:
        print("="*60)
        print("⚠️  [警告] 未在当前打包机检测到 ngrok 环境！")
        print("   跨网联通（Ngrok）功能在运行时依赖 ngrok 二进制，")
        print("   请在使用该功能的目标机器上先安装：brew install ngrok/ngrok/ngrok")
        print("   若目标机器没有安装 ngrok，该功能将无法开启。")
        print("="*60)

    # 2. 确保安装了运行所需的一切依赖
    dependencies = ["fastapi", "uvicorn", "pydantic", "httpx", "lz4", "curl_cffi"]
    for dep in dependencies:
        try:
            __import__(dep)
        except ImportError:
            print(f"📦 Installing missing runtime dependency: {dep}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep, "--break-system-packages"])

    # 3. 构造 PyInstaller 命令
    # --add-data 参数在 Windows 和 Mac/Linux 上的分隔符不同：Windows 为分号 ; ，Mac/Linux 为冒号 :
    sep = ";" if os.name == "nt" else ":"

    # macOS 下将二进制命名为纯 ASCII 的 xmm_server，避免中文名在 shell 中引发引号转义问题
    binary_name = "小猫Mock" if os.name == "nt" else "xmm_server"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--clean",
        f"--name={binary_name}",
        "--onefile",  # 打包成单文件可执行程序
        f"--add-data=templates{sep}templates",  # 将 HTML 模板打包进可执行文件
        "--hidden-import=lz4.block",
    ]
    
    icon_ext = "ico" if os.name == "nt" else "icns"
    icon_path = f"icon.{icon_ext}"
    if os.path.exists(icon_path):
        cmd.append(f"--icon={icon_path}")
        
    cmd.append("server.py")

    print(f"🚀 Running command: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    print("\n🎉 Packaging completed successfully!")

    dist_dir = "dist"
    if "--distpath" in sys.argv:
        idx = sys.argv.index("--distpath")
        if idx + 1 < len(sys.argv):
            dist_dir = sys.argv[idx + 1]

    if sys.platform == "darwin":
        print("🍏 Packing into macOS .app bundle...")
        app_name = "小猫Mock.app"
        app_path = os.path.abspath(os.path.join(dist_dir, app_name))

        # ── 手动构建标准 macOS .app 目录结构 ──
        macos_dir = os.path.join(app_path, "Contents", "MacOS")
        res_dir   = os.path.join(app_path, "Contents", "Resources")
        os.makedirs(macos_dir, exist_ok=True)
        os.makedirs(res_dir, exist_ok=True)

        # ── 写入 Info.plist ──
        info_plist = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>小猫Mock</string>
    <key>CFBundleDisplayName</key>
    <string>小猫Mock</string>
    <key>CFBundleIdentifier</key>
    <string>com.xiaomaomock.server</string>
    <key>CFBundleShortVersionString</key>
    <string>{_APP_VERSION}</string>
    <key>CFBundleVersion</key>
    <string>{_APP_VERSION_SHORT}</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
"""
        plist_path = os.path.join(app_path, "Contents", "Info.plist")
        with open(plist_path, "w", encoding="utf-8") as f:
            f.write(info_plist)

        # ── 写入 Shell 启动脚本（Contents/MacOS/launcher）──
        # 核心策略：二进制已重命名为纯 ASCII 的 xmm_server，
        # launcher 脚本路径和二进制路径全为 ASCII，
        # 通过 TTY 检测决定：已在 Terminal → 直接 exec；否则 → open -a Terminal 打开自身。
        # 全程不向任何 shell/AppleScript 传递含中文的路径参数，彻底消灭引号转义 bug。
        launcher_script = """\
#!/bin/bash
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
BINARY="$(cd "$(dirname "$0")" && pwd)/../Resources/xmm_server"
chmod +x "$BINARY"

# 若已在 Terminal 的交互式 shell 里，直接启动服务
if [ -t 1 ]; then
    echo ""
    echo "🚀 🐱 小猫Mock 抓包服务启动中..."
    exec "$BINARY"
else
    # 避免 open -a Terminal 在某些情况 (如 Parallels 的 /Volumes 挂载盘) 下丢失路径首字符的系统 bug
    SAFE_BINARY=$(echo "$BINARY" | sed "s/'/'\\\\''/g")
    osascript -e 'tell application "Terminal" to activate' -e "tell application \\"Terminal\\" to do script \\"'${SAFE_BINARY}'\\""
fi
"""
        launcher_path = os.path.join(macos_dir, "launcher")
        with open(launcher_path, "w", encoding="utf-8") as f:
            f.write(launcher_script)
        os.chmod(launcher_path, 0o755)

        # ── 移动 PyInstaller 输出的二进制 xmm_server → .app/Contents/Resources/ ──
        binary_src = os.path.join(dist_dir, "xmm_server")
        binary_dst = os.path.join(res_dir, "xmm_server")
        if os.path.exists(binary_src):
            shutil.move(binary_src, binary_dst)
        os.chmod(binary_dst, 0o755)

        # ── 复制 icon.icns 到 Resources ──
        icon_src = "icon.icns"
        if os.path.exists(icon_src):
            shutil.copy(icon_src, os.path.join(res_dir, "icon.icns"))

        # ── Ad-hoc 代码签名（减少 macOS Gatekeeper 阻拦）──
        # 没有 Apple Developer 证书时用 ad-hoc (-) 签名，
        # 虽然不是完全消除提示，但能保证签名结构完整，
        # 用户首次打开时右键 → 打开 即可正常使用。
        print("🔐 Signing app bundle with ad-hoc signature...")
        try:
            subprocess.run(
                ["codesign", "--force", "--deep", "--sign", "-", app_path],
                check=True, timeout=60,
            )
            print("✅ Ad-hoc code signing completed.")
        except Exception as e:
            print(f"⚠️  Code signing failed (non-fatal): {e}")

        print(f"📂 macOS App bundle generated at: {app_path}")
        print("👉 Double-click '小猫Mock.app' to start the server.")
        print("💡 首次打开若被拦截：右键 → 打开，或执行：")
        print(f"   xattr -cr {app_path}")

    else:
        executable_name = "小猫Mock.exe"
        print(f"📂 Standalone executable is generated at: {os.path.abspath(os.path.join(dist_dir, executable_name))}")
        print("👉 You can now distribute this single file and run it on other machines without Python installed!")

if __name__ == "__main__":
    package()
