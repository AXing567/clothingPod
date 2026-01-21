import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成唯一 ID（兼容不支持 crypto.randomUUID 的环境）
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 回退方案：使用时间戳 + 随机数
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
