import os
# 清理系统代理环境变量，避免 pip install 因为残留的代理设置导致连接 127.0.0.1:7890 失败
for env_key in ["http_proxy", "https_proxy", "all_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]:
    os.environ.pop(env_key, None)

import sys
import shutil
import subprocess

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
        info_plist = """\
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
    <key>CFBundleVersion</key>
    <string>1.0</string>
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

        print(f"📂 macOS App bundle generated at: {app_path}")
        print("👉 Double-click '小猫Mock.app' to start the server.")

    else:
        executable_name = "小猫Mock.exe"
        print(f"📂 Standalone executable is generated at: {os.path.abspath(os.path.join(dist_dir, executable_name))}")
        print("👉 You can now distribute this single file and run it on other machines without Python installed!")

if __name__ == "__main__":
    package()
