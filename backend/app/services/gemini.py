"""
Gemini API 服务层
封装老张AI中转站的 Gemini 3 Image API 调用
"""

import asyncio
import base64
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


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

    def _encode_image(
        self, image_data: bytes, mime_type: str = "image/png"
    ) -> dict[str, Any]:
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
        aspect_ratio: str | None = None,
        image_size: str | None = None,
    ) -> bytes:
        """
        Logo替换生成

        Args:
            product_image: 产品原图数据
            mask_image: 用户圈选后的遮罩图数据
            logo_image: 新Logo图片数据
            prompt: 自定义提示词（可选，为空则使用默认提示词）
            aspect_ratio: 输出图片纵横比（可选，为空则使用 API 默认值）
            image_size: 输出图片分辨率（可选，为空则使用 API 默认值）

        Returns:
            生成的图片数据 (bytes)

        Raises:
            ValueError: 参数无效
            httpx.HTTPStatusError: API调用失败
        """
        # 仅当有值时验证参数
        if aspect_ratio and aspect_ratio not in self.SUPPORTED_ASPECT_RATIOS:
            raise ValueError(f"不支持的纵横比: {aspect_ratio}")
        if image_size and image_size not in self.SUPPORTED_SIZES:
            raise ValueError(f"不支持的分辨率: {image_size}")

        # 使用自定义提示词或默认提示词
        default_prompt = """图1是产品原图，图2是logo图片，图3是用户圈选logo后的图片。
我的目标是：
- 按照用户圈选的位置，将原图中的logo替换为图2
- 图2的大小不能大于原logo大小
- 按照圈选的修改，未圈选的不修改"""
        final_prompt = prompt if prompt else default_prompt

        # 构建请求 parts（顺序很重要，对应提示词中的图1、图2、图3）
        parts = [
            {"text": final_prompt},
            self._encode_image(product_image, "image/png"),  # 图1: 产品原图
            self._encode_image(logo_image, "image/png"),  # 图2: Logo图
            self._encode_image(mask_image, "image/png"),  # 图3: 圈选图
        ]

        # 日志记录图片顺序和大小
        logger.info(
            f"[Gemini] 图片顺序: 图1=产品原图({len(product_image)}字节), "
            f"图2=Logo图({len(logo_image)}字节), 图3=圈选图({len(mask_image)}字节)"
        )

        # 构建 imageConfig（仅包含有值的参数）
        image_config: dict[str, str] = {}
        if aspect_ratio:
            image_config["aspectRatio"] = aspect_ratio
        if image_size:
            image_config["imageSize"] = image_size

        # 构建 generationConfig（仅当 imageConfig 有值时包含）
        generation_config: dict[str, Any] = {"responseModalities": ["IMAGE"]}
        if image_config:
            generation_config["imageConfig"] = image_config

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": generation_config,
        }

        # 调试日志
        logger.info(f"[Gemini] API URL: {self.api_url}")
        logger.info(
            f"[Gemini] API Key 长度: {len(self.api_key) if self.api_key else 0}"
        )
        logger.info(
            f"[Gemini] 图片数量: 3, 纵横比: {aspect_ratio or '默认'}, "
            f"分辨率: {image_size or '默认'}"
        )

        # 配置超时：连接60秒，读写300秒（大图片上传需要更长时间）
        timeout = httpx.Timeout(
            timeout=300.0,  # 总超时
            connect=60.0,  # 连接超时
            read=300.0,  # 读取超时
            write=300.0,  # 写入超时（上传大图片需要）
        )

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                logger.info("[Gemini] 开始发送请求...")
                response = await client.post(
                    self.api_url, headers=self.headers, json=payload
                )
                logger.info(f"[Gemini] 收到响应，状态码: {response.status_code}")
                response.raise_for_status()

                result = response.json()
                output_data = result["candidates"][0]["content"]["parts"][0][
                    "inlineData"
                ]["data"]
                logger.info("[Gemini] 成功解析响应数据")
                return base64.b64decode(output_data)
        except httpx.ConnectError as e:
            logger.error(f"[Gemini] 连接失败: {e}")
            raise Exception(f"连接老张API失败: {e}") from e
        except httpx.TimeoutException as e:
            logger.error(f"[Gemini] 请求超时: {e}")
            raise Exception(f"请求老张API超时: {e}") from e
        except httpx.HTTPStatusError as e:
            logger.error(
                f"[Gemini] HTTP错误: {e.response.status_code} - {e.response.text}"
            )
            raise Exception(
                f"老张API返回错误: {e.response.status_code} - {e.response.text}"
            ) from e
        except Exception as e:
            logger.error(f"[Gemini] 未知错误: {type(e).__name__}: {e}")
            raise

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
                        aspect_ratio=task.get("aspect_ratio"),
                        image_size=task.get("image_size"),
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
