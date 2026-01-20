/**
 * Logo替换功能 API 调用层
 */

import { getAuthToken } from "./client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UploadResponse {
  id: string;
  filename: string;
  size: number;
}

export interface GenerateRequest {
  product_image_id: string;
  logo_image_id: string;
  mask_data: string; // Base64编码的遮罩图
  prompt?: string; // 自定义提示词
  aspect_ratio?: string;
  image_size?: string;
}

export interface TaskResponse {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  results?: Array<{
    index?: number;
    id?: string;
    success?: boolean;
    error?: string;
  }>;
  error?: string;
}

/**
 * 上传图片
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录，请刷新页面或重新登录");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE}/api/v1/logo-replace/upload`, {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = "上传失败";
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = `HTTP ${response.status}: ${errorText.slice(0, 100)}`;
      }
      throw new Error(errorDetail);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("网络连接失败，请检查后端服务是否运行在 " + API_BASE);
    }
    throw error;
  }
}

/**
 * 执行Logo替换生成
 */
export async function generateLogoReplace(request: GenerateRequest): Promise<TaskResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`${API_BASE}/api/v1/logo-replace/generate`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "生成失败");
  }

  return response.json();
}

/**
 * 批量Logo替换生成
 */
export async function generateLogoReplaceBatch(tasks: GenerateRequest[]): Promise<TaskResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`${API_BASE}/api/v1/logo-replace/generate-batch`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tasks }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "批量生成失败");
  }

  return response.json();
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<TaskResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`${API_BASE}/api/v1/logo-replace/tasks/${taskId}`, {
    headers: {
      Authorization: token,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "查询失败");
  }

  return response.json();
}

/**
 * 获取结果图片URL（内部使用）
 */
export function getResultImageUrl(resultId: string): string {
  return `${API_BASE}/api/v1/logo-replace/results/${resultId}`;
}

/**
 * 获取带认证的结果图片 Blob URL
 */
export async function fetchResultImageAsBlob(resultId: string): Promise<string> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(getResultImageUrl(resultId), {
    headers: {
      Authorization: token,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "获取图片失败");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * 下载结果图片（带认证）
 */
export async function downloadResultImage(resultId: string, filename: string): Promise<void> {
  const blobUrl = await fetchResultImageAsBlob(resultId);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 释放 Blob URL
  URL.revokeObjectURL(blobUrl);
}

/**
 * 轮询任务状态直到完成
 * 轮询策略：前2分钟每30秒一次，后2分钟每10秒一次
 */
export async function pollTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void
): Promise<TaskResponse> {
  const startTime = Date.now();
  const phase1Duration = 2 * 60 * 1000; // 前2分钟
  const totalDuration = 4 * 60 * 1000; // 总共4分钟

  while (Date.now() - startTime < totalDuration) {
    const status = await getTaskStatus(taskId);

    if (onProgress) {
      onProgress(status.progress);
    }

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    // 前2分钟30秒一次，后2分钟10秒一次
    const elapsed = Date.now() - startTime;
    const interval = elapsed < phase1Duration ? 30000 : 10000;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("任务超时");
}
