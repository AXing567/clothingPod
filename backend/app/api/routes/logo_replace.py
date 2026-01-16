"""
Logo替换功能路由
"""

import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.core.config import settings
from app.services.gemini import gemini_service

router = APIRouter(prefix="/logo-replace", tags=["logo-replace"])

# 内存中存储任务状态（生产环境应使用Redis或数据库）
tasks_store: dict[str, dict[str, Any]] = {}

# 临时文件存储路径
UPLOAD_PATH = Path(settings.UPLOAD_DIR)
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)


class UploadResponse(BaseModel):
    """上传响应"""

    id: str
    filename: str
    size: int


class MaskRegion(BaseModel):
    """圈选区域（多边形坐标）"""

    points: list[tuple[float, float]]


class GenerateRequest(BaseModel):
    """生成请求"""

    product_image_id: str
    logo_image_id: str
    mask_data: str  # Base64编码的遮罩图
    prompt: str | None = None  # 自定义提示词
    aspect_ratio: str = "1:1"
    image_size: str = "2K"


class BatchGenerateRequest(BaseModel):
    """批量生成请求"""

    tasks: list[GenerateRequest]


class TaskResponse(BaseModel):
    """任务响应"""

    task_id: str
    status: str  # pending, processing, completed, failed
    progress: int  # 0-100
    results: list[dict[str, Any]] | None = None
    error: str | None = None


@router.post("/upload", response_model=UploadResponse)
async def upload_image(
    _current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    上传图片（产品图或Logo图通用）
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")

    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"图片大小超过限制 ({settings.MAX_IMAGE_SIZE // 1024 // 1024}MB)",
        )

    # 生成唯一ID并保存文件
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "image.png").suffix or ".png"
    file_path = UPLOAD_PATH / f"{file_id}{suffix}"

    with open(file_path, "wb") as f:
        f.write(content)

    return UploadResponse(
        id=file_id, filename=file.filename or "image.png", size=len(content)
    )


@router.post("/generate", response_model=TaskResponse)
async def generate_logo_replace(
    _current_user: CurrentUser,
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    执行单个Logo替换任务
    """
    task_id = str(uuid.uuid4())

    # 验证文件存在
    product_path = _find_uploaded_file(request.product_image_id)
    logo_path = _find_uploaded_file(request.logo_image_id)

    if not product_path:
        raise HTTPException(status_code=404, detail="产品图片不存在")
    if not logo_path:
        raise HTTPException(status_code=404, detail="Logo图片不存在")

    # 创建任务
    tasks_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "results": None,
        "error": None,
    }

    # 后台执行生成任务
    background_tasks.add_task(
        _execute_generate_task,
        task_id,
        product_path,
        logo_path,
        request.mask_data,
        request.prompt,
        request.aspect_ratio,
        request.image_size,
    )

    return TaskResponse(
        task_id=task_id,
        status="pending",
        progress=0,
    )


@router.post("/generate-batch", response_model=TaskResponse)
async def generate_logo_replace_batch(
    _current_user: CurrentUser,
    request: BatchGenerateRequest,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    批量Logo替换任务
    """
    task_id = str(uuid.uuid4())

    # 验证所有文件存在
    validated_tasks = []
    for i, task in enumerate(request.tasks):
        product_path = _find_uploaded_file(task.product_image_id)
        logo_path = _find_uploaded_file(task.logo_image_id)

        if not product_path:
            raise HTTPException(status_code=404, detail=f"任务{i+1}的产品图片不存在")
        if not logo_path:
            raise HTTPException(status_code=404, detail=f"任务{i+1}的Logo图片不存在")

        validated_tasks.append(
            {
                "product_path": product_path,
                "logo_path": logo_path,
                "mask_data": task.mask_data,
                "aspect_ratio": task.aspect_ratio,
                "image_size": task.image_size,
            }
        )

    # 创建任务
    tasks_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "total": len(validated_tasks),
        "results": None,
        "error": None,
    }

    # 后台执行批量生成任务
    background_tasks.add_task(
        _execute_batch_generate_task,
        task_id,
        validated_tasks,
    )

    return TaskResponse(
        task_id=task_id,
        status="pending",
        progress=0,
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(
    _current_user: CurrentUser,
    task_id: str,
) -> Any:
    """
    查询任务状态
    """
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = tasks_store[task_id]
    return TaskResponse(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        results=task.get("results"),
        error=task.get("error"),
    )


def _find_uploaded_file(file_id: str) -> Path | None:
    """根据ID查找上传的文件"""
    for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
        path = UPLOAD_PATH / f"{file_id}{ext}"
        if path.exists():
            return path
    return None


async def _execute_generate_task(
    task_id: str,
    product_path: Path,
    logo_path: Path,
    mask_data: str,
    prompt: str | None,
    aspect_ratio: str,
    image_size: str,
) -> None:
    """执行单个生成任务"""
    import base64

    try:
        tasks_store[task_id]["status"] = "processing"
        tasks_store[task_id]["progress"] = 10

        # 读取图片数据
        with open(product_path, "rb") as f:
            product_image = f.read()
        with open(logo_path, "rb") as f:
            logo_image = f.read()

        # 解码遮罩图
        mask_image = base64.b64decode(mask_data)

        tasks_store[task_id]["progress"] = 30

        # 调用Gemini API
        result_data = await gemini_service.replace_logo(
            product_image=product_image,
            mask_image=mask_image,
            logo_image=logo_image,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        )

        tasks_store[task_id]["progress"] = 90

        # 保存结果
        result_id = str(uuid.uuid4())
        result_path = UPLOAD_PATH / f"result_{result_id}.png"
        with open(result_path, "wb") as f:
            f.write(result_data)

        tasks_store[task_id]["status"] = "completed"
        tasks_store[task_id]["progress"] = 100
        tasks_store[task_id]["results"] = [
            {
                "id": result_id,
                "path": str(result_path),
            }
        ]

    except Exception as e:
        tasks_store[task_id]["status"] = "failed"
        tasks_store[task_id]["error"] = str(e)


async def _execute_batch_generate_task(
    task_id: str,
    validated_tasks: list[dict[str, Any]],
) -> None:
    """执行批量生成任务"""
    import base64

    try:
        tasks_store[task_id]["status"] = "processing"

        # 准备所有任务数据
        api_tasks = []
        for task in validated_tasks:
            with open(task["product_path"], "rb") as f:
                product_image = f.read()
            with open(task["logo_path"], "rb") as f:
                logo_image = f.read()
            mask_image = base64.b64decode(task["mask_data"])

            api_tasks.append(
                {
                    "product_image": product_image,
                    "mask_image": mask_image,
                    "logo_image": logo_image,
                    "aspect_ratio": task["aspect_ratio"],
                    "image_size": task["image_size"],
                }
            )

        tasks_store[task_id]["progress"] = 20

        # 并发调用API
        results = await gemini_service.replace_logo_batch(api_tasks, max_concurrent=3)

        tasks_store[task_id]["progress"] = 80

        # 保存所有结果
        final_results = []
        for result in results:
            if result["success"]:
                result_id = str(uuid.uuid4())
                result_path = UPLOAD_PATH / f"result_{result_id}.png"
                with open(result_path, "wb") as f:
                    f.write(result["data"])
                final_results.append(
                    {
                        "index": result["index"],
                        "success": True,
                        "id": result_id,
                    }
                )
            else:
                final_results.append(
                    {
                        "index": result["index"],
                        "success": False,
                        "error": result["error"],
                    }
                )

        tasks_store[task_id]["status"] = "completed"
        tasks_store[task_id]["progress"] = 100
        tasks_store[task_id]["results"] = final_results

    except Exception as e:
        tasks_store[task_id]["status"] = "failed"
        tasks_store[task_id]["error"] = str(e)


@router.get("/results/{result_id}")
async def get_result_image(
    _current_user: CurrentUser,
    result_id: str,
) -> Any:
    """
    获取生成结果图片
    """
    from fastapi.responses import FileResponse

    result_path = UPLOAD_PATH / f"result_{result_id}.png"
    if not result_path.exists():
        raise HTTPException(status_code=404, detail="结果图片不存在")

    return FileResponse(
        result_path, media_type="image/png", filename=f"logo_replaced_{result_id}.png"
    )
