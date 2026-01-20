"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

// 异步将 base64 转换为 Blob URL（使用 requestIdleCallback 避免主线程阻塞）
function base64ToBlobUrlAsync(base64: string, mimeType: string = "image/png"): Promise<string> {
  return new Promise((resolve, reject) => {
    const callback = () => {
      try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        resolve(URL.createObjectURL(blob));
      } catch (e) {
        console.error("[base64ToBlobUrlAsync] 转换失败:", e);
        reject(e);
      }
    };

    // 使用 requestIdleCallback 进行异步转换，如果不支持则使用 setTimeout
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(callback, { timeout: 2000 });
    } else {
      setTimeout(callback, 0);
    }
  });
}

// 图片预览组件（点击查看大图）- 支持 base64 和普通 URL
function ImagePreview({
  src,
  alt,
  base64Data,
}: {
  src?: string;
  alt: string;
  base64Data?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // 如果提供了 base64Data，异步转换为 Blob URL
  useEffect(() => {
    if (base64Data) {
      setIsConverting(true);
      setLoadError(false);

      let cancelled = false;

      base64ToBlobUrlAsync(base64Data)
        .then((url) => {
          if (!cancelled) {
            setBlobUrl(url);
            setIsConverting(false);
          } else {
            URL.revokeObjectURL(url);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError(true);
            setIsConverting(false);
          }
        });

      return () => {
        cancelled = true;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64Data]);

  const imageSrc = base64Data ? blobUrl : src;

  if (isConverting || (!imageSrc && base64Data)) {
    return (
      <div
        className="flex items-center justify-center rounded border bg-slate-100 text-xs text-slate-400"
        style={{ width: 64, height: 64, minWidth: 64, minHeight: 64 }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

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
    <>
      <div className="relative" style={{ width: 64, height: 64, minWidth: 64, minHeight: 64 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt}
          className="cursor-pointer rounded border object-cover transition-opacity hover:opacity-80"
          style={{ width: 64, height: 64 }}
          onClick={() => loaded && setShowModal(true)}
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
      </div>

      {/* 大图查看模态框 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="flex max-h-[90vh] max-w-[90vw] items-center justify-center border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={alt}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
            onClick={() => setShowModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// 单行任务组件 - 用于虚拟滚动
const TaskRow = ({
  task,
  onToggleSelect,
  onUpdatePrompt,
  onRetry,
  onEditMask,
  onResetToGlobalMask,
  globalMaskData,
  style,
}: {
  task: TaskItem;
  onToggleSelect: (taskId: string) => void;
  onUpdatePrompt: (taskId: string, prompt: string) => void;
  onRetry: (taskId: string) => void;
  onEditMask: (taskId: string) => void;
  onResetToGlobalMask: (productImageId: string) => void;
  globalMaskData: string;
  style?: React.CSSProperties;
}) => {
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
    <div className="flex items-center border-b bg-white hover:bg-slate-50" style={style}>
      {/* 选择框 */}
      <div className="flex w-[60px] min-w-[60px] items-center justify-center p-3">
        <Checkbox
          checked={task.selected}
          onCheckedChange={() => onToggleSelect(task.id)}
          disabled={task.status === "generating"}
        />
      </div>

      {/* 商品图 */}
      <div className="flex w-[88px] min-w-[88px] items-center p-3">
        <ImagePreview src={task.productImage.preview} alt="商品图" />
      </div>

      {/* Logo图 */}
      <div className="flex w-[88px] min-w-[88px] items-center p-3">
        <ImagePreview src={task.logoImage.preview} alt="Logo图" />
      </div>

      {/* 圈选图 */}
      <div className="flex w-[160px] min-w-[160px] items-center p-3">
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
      </div>

      {/* 提示词 */}
      <div className="flex min-w-0 flex-[0.8] items-center p-3">
        {isEditingPrompt ? (
          <div className="w-full space-y-2">
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
            className="line-clamp-3 w-full cursor-pointer rounded p-1 text-xs text-slate-600 hover:bg-slate-100"
            onClick={() => setIsEditingPrompt(true)}
            title="点击编辑提示词"
          >
            {task.prompt || "点击添加提示词"}
          </div>
        )}
      </div>

      {/* 状态 */}
      <div className="flex w-[100px] min-w-[100px] items-center p-3">
        <div>
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
        </div>
      </div>

      {/* 结果图 */}
      <div className="flex w-[88px] min-w-[88px] items-center p-3">
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
      </div>

      {/* 操作 */}
      <div className="flex w-[120px] min-w-[120px] items-center p-3">
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
      </div>
    </div>
  );
};

// 表头组件
function TableHeader() {
  return (
    <div className="flex items-center bg-slate-100 text-left text-sm font-medium">
      <div className="w-[60px] min-w-[60px] p-3 text-center">选择</div>
      <div className="w-[88px] min-w-[88px] p-3">商品图</div>
      <div className="w-[88px] min-w-[88px] p-3">Logo图</div>
      <div className="w-[160px] min-w-[160px] p-3">圈选图</div>
      <div className="min-w-0 flex-[0.8] p-3">提示词</div>
      <div className="w-[100px] min-w-[100px] p-3">状态</div>
      <div className="w-[88px] min-w-[88px] p-3">结果图</div>
      <div className="w-[120px] min-w-[120px] p-3">操作</div>
    </div>
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
  const parentRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动配置
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 每行预估高度 100px
    overscan: 5, // 额外渲染 5 行用于平滑滚动
  });

  // 缓存 props，避免 TaskRow 不必要的重渲染
  const taskRowProps = useMemo(
    () => ({
      onToggleSelect,
      onUpdatePrompt,
      onRetry,
      onEditMask,
      onResetToGlobalMask,
      globalMaskData,
    }),
    [onToggleSelect, onUpdatePrompt, onRetry, onEditMask, onResetToGlobalMask, globalMaskData]
  );

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500">上传商品图和Logo图后将自动生成任务列表</div>
    );
  }

  return (
    <div className="overflow-hidden rounded border">
      {/* 固定表头 */}
      <TableHeader />

      {/* 虚拟滚动容器 */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: Math.min(600, tasks.length * 100) }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = tasks[virtualRow.index];
            return (
              <TaskRow
                key={task.id}
                task={task}
                {...taskRowProps}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
