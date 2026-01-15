#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Nano Banana Pro 图片编辑工具 - Python版本
上传本地图片 + 文字描述，生成新图片，支持自定义纵横比和分辨率
"""

import requests
import base64
import os
import datetime
import mimetypes
from typing import Optional, Tuple, List

class NanaBananaProEditor:
    """Nano Banana Pro 图片编辑器"""

    SUPPORTED_ASPECT_RATIOS = [
        "21:9", "16:9", "4:3", "3:2", "1:1",
        "9:16", "3:4", "2:3", "5:4", "4:5"
    ]

    SUPPORTED_SIZES = ["1K", "2K", "4K"]

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

    def edit_image(self, image_path: str, prompt: str,
                   aspect_ratio: str = "1:1",
                   image_size: str = "2K",
                   output_dir: str = ".") -> Tuple[bool, str]:
        """
        编辑单张图片

        参数:
            image_path: 输入图片路径
            prompt: 编辑描述
            aspect_ratio: 纵横比
            image_size: 分辨率 (1K, 2K, 4K)
            output_dir: 保存目录

        返回:
            (是否成功, 结果消息)
        """
        print(f"🚀 开始编辑图片...")
        print(f"📁 输入图片: {image_path}")
        print(f"📝 编辑描述: {prompt}")
        print(f"📐 纵横比: {aspect_ratio}")
        print(f"🖼️  分辨率: {image_size}")

        if not os.path.exists(image_path):
            return False, f"图片文件不存在: {image_path}"

        if aspect_ratio not in self.SUPPORTED_ASPECT_RATIOS:
            return False, f"不支持的纵横比 {aspect_ratio}"

        if image_size not in self.SUPPORTED_SIZES:
            return False, f"不支持的分辨率 {image_size}"

        # 读取并编码图片
        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')

            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type or not mime_type.startswith('image/'):
                mime_type = 'image/jpeg'
        except Exception as e:
            return False, f"读取图片失败: {str(e)}"

        # 生成输出文件名
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"edited_{timestamp}.png")

        try:
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": mime_type, "data": image_base64}}
                    ]
                }],
                "generationConfig": {
                    "responseModalities": ["IMAGE"],
                    "imageConfig": {
                        "aspectRatio": aspect_ratio,
                        "imageSize": image_size
                    }
                }
            }

            print("📡 发送请求到 API...")
            response = requests.post(self.api_url, headers=self.headers, json=payload, timeout=180)

            if response.status_code != 200:
                return False, f"API 请求失败，状态码: {response.status_code}"

            result = response.json()
            output_image_data = result["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]

            print("💾 正在保存图片...")
            decoded_data = base64.b64decode(output_image_data)

            with open(output_file, 'wb') as f:
                f.write(decoded_data)

            file_size = len(decoded_data) / 1024
            print(f"✅ 图片已保存: {output_file}")
            print(f"📊 文件大小: {file_size:.2f} KB")

            return True, f"成功保存图片: {output_file}"

        except Exception as e:
            return False, f"错误: {str(e)}"

    def merge_images(self, image_paths: List[str], prompt: str,
                     aspect_ratio: str = "16:9",
                     image_size: str = "2K",
                     output_dir: str = ".") -> Tuple[bool, str]:
        """
        合并多张图片

        参数:
            image_paths: 输入图片路径列表
            prompt: 合并描述
            aspect_ratio: 纵横比
            image_size: 分辨率
            output_dir: 保存目录

        返回:
            (是否成功, 结果消息)
        """
        print(f"🚀 开始合并 {len(image_paths)} 张图片...")

        parts = [{"text": prompt}]

        for img_path in image_paths:
            if not os.path.exists(img_path):
                return False, f"图片文件不存在: {img_path}"

            with open(img_path, 'rb') as f:
                img_data = f.read()
            img_b64 = base64.b64encode(img_data).decode('utf-8')

            mime_type, _ = mimetypes.guess_type(img_path)
            if not mime_type:
                mime_type = 'image/jpeg'

            parts.append({"inline_data": {"mime_type": mime_type, "data": img_b64}})

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"merged_{timestamp}.png")

        try:
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseModalities": ["IMAGE"],
                    "imageConfig": {
                        "aspectRatio": aspect_ratio,
                        "imageSize": image_size
                    }
                }
            }

            print("📡 发送请求到 API...")
            response = requests.post(self.api_url, headers=self.headers, json=payload, timeout=180)

            if response.status_code != 200:
                return False, f"API 请求失败，状态码: {response.status_code}"

            result = response.json()
            output_image_data = result["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]

            print("💾 正在保存图片...")
            decoded_data = base64.b64decode(output_image_data)

            with open(output_file, 'wb') as f:
                f.write(decoded_data)

            print(f"✅ 图片已保存: {output_file}")
            return True, f"成功保存图片: {output_file}"

        except Exception as e:
            return False, f"错误: {str(e)}"


def main():
    """主函数 - 使用示例"""

    API_KEY = "sk-YOUR_API_KEY"

    editor = NanaBananaProEditor(API_KEY)

    # 示例1: 单图编辑
    success, message = editor.edit_image(
        image_path="./input.jpg",
        prompt="Add a rainbow in the sky",
        aspect_ratio="16:9",
        image_size="2K"
    )
    print(message)

    # 示例2: 多图合并
    success, message = editor.merge_images(
        image_paths=["./cat.jpg", "./dog.jpg"],
        prompt="Combine these two pets into one happy family portrait",
        aspect_ratio="1:1",
        image_size="2K"
    )
    print(message)


if __name__ == "__main__":
    main()