"""
Gemini API 服务层
封装老张AI中转站的 Gemini 3 Image API 调用
"""

import asyncio
import base64
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings


class GeminiService:
    """Gemini 图像生成服务"""

    SUPPORTED_ASPECT_RATIOS = [
        "21:9",
        "16:9",
        "4:3",
        "3:2",
        "1:1",
        "9:16",
        "3:4",
        "2:3",
        "5:4",
        "4:5",
    ]
    SUPPORTED_SIZES = ["1K", "2K", "4K"]

    def __init__(self) -> None:
        self.api_key = settings.LAOZHANG_API_KEY
        self.api_url = settings.LAOZHANG_API_URL
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _encode_image(self, image_data: bytes, mime_type: str = "image/png") -> dict[str, Any]:
        """将图片数据编码为API所需格式"""
        img_b64 = base64.b64encode(image_data).decode("utf-8")
        return {"inline_data": {"mime_type": mime_type, "data": img_b64}}

    def _encode_image_from_path(self, image_path: str) -> dict[str, Any]:
        """从文件路径读取并编码图片"""
        path = Path(image_path)
        with open(path, "rb") as f:
            image_data = f.read()

        suffix = path.suffix.lower()
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        mime_type = mime_map.get(suffix, "image/png")

        return self._encode_image(image_data, mime_type)

    async def replace_logo(
        self,
        product_image: bytes,
        mask_image: bytes,
        logo_image: bytes,
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
        image_size: str = "2K",
    ) -> bytes:
        """
        Logo替换生成

        Args:
            product_image: 产品原图数据
            mask_image: 用户圈选后的遮罩图数据
            logo_image: 新Logo图片数据
            prompt: 自定义提示词（可选，为空则使用默认提示词）
            aspect_ratio: 输出图片纵横比
            image_size: 输出图片分辨率

        Returns:
            生成的图片数据 (bytes)

        Raises:
            ValueError: 参数无效
            httpx.HTTPStatusError: API调用失败
        """
        if aspect_ratio not in self.SUPPORTED_ASPECT_RATIOS:
            raise ValueError(f"不支持的纵横比: {aspect_ratio}")
        if image_size not in self.SUPPORTED_SIZES:
            raise ValueError(f"不支持的分辨率: {image_size}")

        # 使用自定义提示词或默认提示词
        default_prompt = """图1是产品原图，图2是用户圈选logo后的遮罩图（红色区域标记了需要替换的logo位置），图3是新的logo图片。
请按照以下要求进行处理：
1. 将产品原图中被红色区域标记的logo替换为图3的新logo
2. 新logo的大小应该与原logo大小相近，不能超出原logo区域
3. 新logo应该自然融入产品图片，保持透视和光影一致
4. 保持产品图片其他部分不变"""
        final_prompt = prompt if prompt else default_prompt

        parts = [
            {"text": final_prompt},
            self._encode_image(product_image, "image/png"),
            self._encode_image(mask_image, "image/png"),
            self._encode_image(logo_image, "image/png"),
        ]

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {"aspectRatio": aspect_ratio, "imageSize": image_size},
            },
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                self.api_url, headers=self.headers, json=payload
            )
            response.raise_for_status()

            result = response.json()
            output_data = result["candidates"][0]["content"]["parts"][0]["inlineData"][
                "data"
            ]
            return base64.b64decode(output_data)

    async def replace_logo_batch(
        self, tasks: list[dict[str, Any]], max_concurrent: int = 3
    ) -> list[dict[str, Any]]:
        """
        批量Logo替换

        Args:
            tasks: 任务列表，每个任务包含 product_image, mask_image, logo_image
            max_concurrent: 最大并发数

        Returns:
            结果列表，每个结果包含 success, data/error
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_one(task: dict[str, Any], index: int) -> dict[str, Any]:
            async with semaphore:
                try:
                    result = await self.replace_logo(
                        product_image=task["product_image"],
                        mask_image=task["mask_image"],
                        logo_image=task["logo_image"],
                        prompt=task.get("prompt"),
                        aspect_ratio=task.get("aspect_ratio", "1:1"),
                        image_size=task.get("image_size", "2K"),
                    )
                    return {"index": index, "success": True, "data": result}
                except Exception as e:
                    return {"index": index, "success": False, "error": str(e)}

        results = await asyncio.gather(
            *[process_one(task, i) for i, task in enumerate(tasks)]
        )
        return list(results)


# 全局服务实例
gemini_service = GeminiService()
