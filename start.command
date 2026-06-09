#!/bin/bash
cd "$(dirname "$0")"
echo "正在检查并安装运行依赖 (FastAPI, Uvicorn, curl_cffi, lz4)..."
pip3 install fastapi uvicorn pydantic httpx lz4 curl_cffi --only-binary=:all:
echo "Mock 服务已在后台启动！"
echo "控制台地址: http://127.0.0.1:8099"
echo "客户端请求前缀: http://127.0.0..."
open "http://127.0.0.1:8099"
python3 server.py
