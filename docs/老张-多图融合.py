import requests
import base64

# ========== 配置 ==========
API_KEY = "sk-YOUR_API_KEY"
API_URL = "https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"

# 使用前面生成的两张图（示例1和示例2的输出）
IMAGES = ["output.png", "output_styled.png"]
PROMPT = "Combine these two cat images into a single artistic composition"
ASPECT_RATIO = "16:9"
IMAGE_SIZE = "2K"
# ============================

# 构建 parts: 文本 + 多张图片
parts = [{"text": PROMPT}]

for img_path in IMAGES:
    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")
    parts.append({"inline_data": {"mime_type": "image/png", "data": img_b64}})

headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

payload = {
    "contents": [{"parts": parts}],
    "generationConfig": {
        "responseModalities": ["IMAGE"],
        "imageConfig": {
            "aspectRatio": ASPECT_RATIO,
            "imageSize": IMAGE_SIZE
        }
    }
}

response = requests.post(API_URL, headers=headers, json=payload, timeout=180)
result = response.json()

# 保存图片
output_data = result["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
with open("output_mixed.png", "wb") as f:
    f.write(base64.b64decode(output_data))

print("✅ 图片已保存: output_mixed.png")
