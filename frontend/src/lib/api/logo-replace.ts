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
  console.log("[uploadImage] 开始上传:", file.name);

  const token = await getAuthToken();
  console.log("[uploadImage] Token获取结果:", token ? "已获取" : "未获取");

  if (!token) {
    throw new Error("未登录，请刷新页面或重新登录");
  }

  const formData = new FormData();
  formData.append("file", file);

  console.log("[uploadImage] 发送请求到:", `${API_BASE}/api/v1/logo-replace/upload`);

  try {
    const response = await fetch(`${API_BASE}/api/v1/logo-replace/upload`, {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    console.log("[uploadImage] 响应状态:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[uploadImage] 错误响应:", errorText);

      let errorDetail = "上传失败";
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = `HTTP ${response.status}: ${errorText.slice(0, 100)}`;
      }
      throw new Error(errorDetail);
    }

    const result = await response.json();
    console.log("[uploadImage] 上传成功:", result.id);
    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("[uploadImage] 网络错误:", error);
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
 * 获取结果图片URL
 */
export function getResultImageUrl(resultId: string): string {
  return `${API_BASE}/api/v1/logo-replace/results/${resultId}`;
}

/**
 * 轮询任务状态直到完成
 */
export async function pollTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 90 // 最多3分钟
): Promise<TaskResponse> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getTaskStatus(taskId);

    if (onProgress) {
      onProgress(status.progress);
    }

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error("任务超时");
}
