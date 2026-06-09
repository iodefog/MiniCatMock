#!/bin/bash
# 切换到脚本所在的当前目录
cd "$(dirname "$0")"

echo "🔌 正在清理旧的进程并激活虚拟环境..."

# 1. 检查是否存在虚拟环境，存在则直接使用其中的 python3
if [ -d ".venv" ]; then
    # 自动检测并安装所有运行所必需的依赖库
    dependencies="fastapi uvicorn pydantic httpx lz4 curl_cffi"
    for dep in $dependencies; do
        .venv/bin/python3 -c "import $dep" 2>/dev/null
        if [ $? -ne 0 ]; then
            echo "📦 检测到缺少依赖库 $dep，正在为您自动安装..."
            .venv/bin/python3 -m pip install $dep
        fi
    done
else
    echo "❌ 未检测到 .venv 虚拟环境，请先运行 start.command 脚本或手动创建虚拟环境！"
    exit 1
fi

echo "🚀「小猫Mock」抓包服务已在后台启动！"
echo "控制台地址: http://127.0.0.1:8099"
echo "客户端请求前缀: http://<你的Mac局域网IP>:8099/mock/..."

# 2. 自动打开浏览器控制台
open "http://127.0.0.1:8099"

# 3. 使用虚拟环境中的 python 运行服务
.venv/bin/python3 server.py
