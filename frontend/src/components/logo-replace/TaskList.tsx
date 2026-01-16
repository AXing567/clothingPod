"use client";

import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Pencil,
  RotateCcw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { UploadedImage } from "./ImageUploader";
import { fetchResultImageAsBlob, downloadResultImage } from "@/lib/api/logo-replace";

export interface TaskItem {
  id: string;
  productImage: UploadedImage;
  logoImage: UploadedImage;
  maskImage?: string;
  useGlobalMask: boolean;
  prompt: string;
  status: "pending" | "generating" | "success" | "failed";
  resultId?: string;
  error?: string;
  selected: boolean;
}

interface TaskListProps {
  tasks: TaskItem[];
  onToggleSelect: (taskId: string) => void;
  onUpdatePrompt: (taskId: string, prompt: string) => void;
  onRetry: (taskId: string) => void;
  onEditMask: (taskId: string) => void;
  onResetToGlobalMask: (productImageId: string) => void;
  globalMaskData: string;
  // getResultImageUrl 已移除，改用带认证的 fetchResultImageAsBlob
}

// 状态图标组件
function StatusIcon({ status }: { status: TaskItem["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-slate-400" />;
    case "generating":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

// 状态文字
function getStatusText(status: TaskItem["status"]): string {
  switch (status) {
    case "pending":
      return "待生成";
    case "generating":
      return "生成中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
  }
}

// 将 base64 转换为 Blob URL（用于处理大型图片）
function base64ToBlobUrl(base64: string, mimeType: string = "image/png"): string {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("[base64ToBlobUrl] 转换失败:", e);
    return "";
  }
}

// 图片预览组件（悬停放大）- 支持 base64 和普通 URL
function ImagePreview({
  src,
  alt,
  base64Data,
}: {
  src?: string;
  alt: string;
  base64Data?: string;
}) {
  const [showLarge, setShowLarge] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // 如果提供了 base64Data，转换为 Blob URL
  useEffect(() => {
    if (base64Data) {
      const url = base64ToBlobUrl(base64Data);
      if (url) {
        setBlobUrl(url);
      } else {
        setLoadError(true);
      }
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    }
  }, [base64Data]);

  const imageSrc = base64Data ? blobUrl : src;

  if (!imageSrc) {
    return (
      <div
        className="flex items-center justify-center rounded border bg-slate-100 text-xs text-slate-400"
        style={{ width: 64, height: 64, minWidth: 64, minHeight: 64 }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: 64, height: 64, minWidth: 64, minHeight: 64 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={alt}
        className="cursor-pointer rounded border object-cover"
        style={{ width: 64, height: 64 }}
        onMouseEnter={() => setShowLarge(true)}
        onMouseLeave={() => setShowLarge(false)}
        onLoad={() => setLoaded(true)}
        onError={() => setLoadError(true)}
      />
      {loadError && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded bg-red-100 text-xs text-red-500"
          style={{ width: 64, height: 64 }}
        >
          加载失败
        </div>
      )}
      {showLarge && loaded && (
        <div className="absolute left-full top-0 z-50 ml-2 rounded-lg border bg-white p-2 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={alt} className="h-48 w-48 object-contain" />
        </div>
      )}
    </div>
  );
}

// 单行任务组件
function TaskRow({
  task,
  onToggleSelect,
  onUpdatePrompt,
  onRetry,
  onEditMask,
  onResetToGlobalMask,
  globalMaskData,
}: {
  task: TaskItem;
  onToggleSelect: (taskId: string) => void;
  onUpdatePrompt: (taskId: string, prompt: string) => void;
  onRetry: (taskId: string) => void;
  onEditMask: (taskId: string) => void;
  onResetToGlobalMask: (productImageId: string) => void;
  globalMaskData: string;
}) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(task.prompt);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // 当 resultId 变化时，获取带认证的图片
  useEffect(() => {
    if (!task.resultId) {
      setResultImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    let currentBlobUrl: string | null = null;

    const fetchImage = async () => {
      try {
        const blobUrl = await fetchResultImageAsBlob(task.resultId!);
        if (!cancelled) {
          currentBlobUrl = blobUrl;
          setResultImageUrl(blobUrl);
        } else {
          // 如果已取消，立即释放获取到的 URL
          URL.revokeObjectURL(blobUrl);
        }
      } catch (error) {
        console.error("获取结果图片失败:", error);
        if (!cancelled) {
          setResultImageUrl(null);
        }
      }
    };

    fetchImage();

    // 清理函数：释放 Blob URL
    return () => {
      cancelled = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [task.resultId]);

  const handlePromptSave = useCallback(() => {
    onUpdatePrompt(task.id, localPrompt);
    setIsEditingPrompt(false);
  }, [task.id, localPrompt, onUpdatePrompt]);

  const handleDownload = async () => {
    if (!task.resultId || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadResultImage(task.resultId, `logo_replaced_${task.id}.png`);
      toast.success("图片下载成功");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "下载失败";
      toast.error(`下载失败: ${errorMsg}`);
      console.error("下载图片失败:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <tr className="border-b hover:bg-slate-50">
      {/* 选择框 */}
      <td className="p-3 text-center">
        <Checkbox
          checked={task.selected}
          onCheckedChange={() => onToggleSelect(task.id)}
          disabled={task.status === "generating"}
        />
      </td>

      {/* 商品图 */}
      <td className="p-3">
        <ImagePreview src={task.productImage.preview} alt="商品图" />
      </td>

      {/* Logo图 */}
      <td className="p-3">
        <ImagePreview src={task.logoImage.preview} alt="Logo图" />
      </td>

      {/* 圈选图 */}
      <td className="p-3">
        <div className="flex items-center gap-2">
          {task.maskImage ? (
            <ImagePreview base64Data={task.maskImage} alt={`圈选图-${task.id}`} />
          ) : (
            <div
              className="flex items-center justify-center rounded border text-xs text-slate-400"
              style={{ width: 64, height: 64, minWidth: 64 }}
            >
              未圈选
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditMask(task.id)}
              className="h-7 px-2"
            >
              <Pencil className="mr-1 h-3 w-3" />
              {task.useGlobalMask ? "单独圈选" : "修改"}
            </Button>
            {!task.useGlobalMask && globalMaskData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetToGlobalMask(task.productImage.id)}
                className="h-7 px-2 text-slate-500"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                恢复全局
              </Button>
            )}
          </div>
        </div>
      </td>

      {/* 提示词 */}
      <td className="max-w-xs p-3">
        {isEditingPrompt ? (
          <div className="space-y-2">
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={handlePromptSave} className="h-6 text-xs">
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLocalPrompt(task.prompt);
                  setIsEditingPrompt(false);
                }}
                className="h-6 text-xs"
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="line-clamp-3 cursor-pointer rounded p-1 text-xs text-slate-600 hover:bg-slate-100"
            onClick={() => setIsEditingPrompt(true)}
            title="点击编辑提示词"
          >
            {task.prompt || "点击添加提示词"}
          </div>
        )}
      </td>

      {/* 状态 */}
      <td className="p-3">
        <div className="flex items-center gap-2">
          <StatusIcon status={task.status} />
          <span
            className={`text-sm ${
              task.status === "success"
                ? "text-green-600"
                : task.status === "failed"
                  ? "text-red-600"
                  : task.status === "generating"
                    ? "text-blue-600"
                    : "text-slate-500"
            }`}
          >
            {getStatusText(task.status)}
          </span>
        </div>
        {task.error && (
          <p className="mt-1 text-xs text-red-500" title={task.error}>
            {task.error.slice(0, 30)}...
          </p>
        )}
      </td>

      {/* 结果图 */}
      <td className="p-3">
        {resultImageUrl ? (
          <ImagePreview src={resultImageUrl} alt="结果图" />
        ) : task.resultId ? (
          <div
            className="flex items-center justify-center rounded border"
            style={{ width: 64, height: 64 }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded border text-xs text-slate-400"
            style={{ width: 64, height: 64 }}
          >
            -
          </div>
        )}
      </td>

      {/* 操作 */}
      <td className="p-3">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(task.id)}
            disabled={task.status === "generating"}
            className="h-8"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            重试
          </Button>
          {task.resultId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8"
            >
              {isDownloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TaskList({
  tasks,
  onToggleSelect,
  onUpdatePrompt,
  onRetry,
  onEditMask,
  onResetToGlobalMask,
  globalMaskData,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500">上传商品图和Logo图后将自动生成任务列表</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left text-sm">
            <th className="w-12 p-3 text-center">选择</th>
            <th className="w-20 p-3">商品图</th>
            <th className="w-20 p-3">Logo图</th>
            <th className="w-32 p-3">圈选图</th>
            <th className="p-3">提示词</th>
            <th className="w-24 p-3">状态</th>
            <th className="w-20 p-3">结果图</th>
            <th className="w-28 p-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleSelect={onToggleSelect}
              onUpdatePrompt={onUpdatePrompt}
              onRetry={onRetry}
              onEditMask={onEditMask}
              onResetToGlobalMask={onResetToGlobalMask}
              globalMaskData={globalMaskData}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
