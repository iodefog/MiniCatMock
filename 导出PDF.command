#!/bin/bash
# 切换到当前脚本所在目录
cd "$(dirname "$0")"

echo "🎨 正在通过 Google Chrome 导出幻灯片为 PDF..."
echo "输入 HTML 路径: ./slides.html"

# 定义输出路径
OUTPUT_DIR="/Users/lhl/Desktop/小猫Mock"
OUTPUT_PATH="${OUTPUT_DIR}/小猫Mock-单机私有部署的移动端AI调试服务器.pdf"

# 确保目标目录存在
mkdir -p "${OUTPUT_DIR}"

# 检查 Google Chrome 路径
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ -f "${CHROME_PATH}" ]; then
    echo "🚀 正在运行 Chrome Headless 进行转换..."
    "${CHROME_PATH}" --headless --disable-gpu --print-to-pdf="${OUTPUT_PATH}" --no-margins --print-to-pdf-no-header "./slides.html"
    
    if [ $? -eq 0 ]; then
        echo "✅ 导出成功！"
        echo "PDF 文件已保存至: ${OUTPUT_PATH}"
        # 自动打开生成的 PDF
        open "${OUTPUT_PATH}"
    else
        echo "❌ 导出失败，请尝试使用 Chrome 浏览器手动打印。"
    fi
else
    echo "❌ 未检测到系统中的 Google Chrome 安装！"
    echo "💡 提示：您也可以直接在 Chrome 浏览器中打开 slides.html，按下 Cmd+P 选择「另存为 PDF」进行导出。"
fi

# 保持终端窗口开启
echo ""
read -p "按下任意键退出..." -n1 -s
