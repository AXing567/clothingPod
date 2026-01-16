"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RotateCcw, Play, RefreshCw, CheckSquare, Square, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUploader, type UploadedImage } from "@/components/logo-replace/ImageUploader";
import { type Polygon } from "@/components/logo-replace/PolygonSelector";
import { TaskList, type TaskItem } from "@/components/logo-replace/TaskList";
import { PromptBatchInput } from "@/components/logo-replace/PromptInput";
import { MaskSelectorDialog } from "@/components/logo-replace/MaskSelectorDialog";
import {
  uploadImage,
  generateLogoReplace,
  pollTaskUntilComplete,
  getResultImageUrl,
} from "@/lib/api/logo-replace";

// 默认提示词
const DEFAULT_PROMPT = `图1是产品原图，图2是用户圈选logo后的图片，图3是logo图片。
我的目标是：
- 按照用户圈选的位置，将原图中的logo替换为图3
- 图3的大小不能大于原logo大小`;

export default function LogoReplacePage() {
  const session = useSession();

  // 图片状态
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [logoImages, setLogoImages] = useState<UploadedImage[]>([]);

  // 全局圈选状态
  const [globalPolygons, setGlobalPolygons] = useState<Polygon[]>([]);
  const [globalMaskData, setGlobalMaskData] = useState<string>("");

  // 单独圈选状态（productImageId -> maskData）
  const [individualMasks, setIndividualMasks] = useState<Record<string, string>>({});
  const [individualPolygons, setIndividualPolygons] = useState<Record<string, Polygon[]>>({});

  // 提示词
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);

  // 任务列表
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // 弹窗状态
  const [maskDialogOpen, setMaskDialogOpen] = useState(false);
  const [maskDialogMode, setMaskDialogMode] = useState<"global" | "individual">("global");
  const [currentEditingTaskId, setCurrentEditingTaskId] = useState<string | null>(null);

  // 生成任务列表（商品×Logo的笛卡尔积）
  useEffect(() => {
    if (productImages.length === 0 || logoImages.length === 0) {
      setTasks([]);
      return;
    }

    const newTasks: TaskItem[] = [];
    for (const product of productImages) {
      for (const logo of logoImages) {
        const existingTask = tasks.find(
          (t) => t.productImage.id === product.id && t.logoImage.id === logo.id
        );

        if (existingTask) {
          // 保留现有任务状态，但更新图片引用（确保 uploaded 状态是最新的）
          newTasks.push({
            ...existingTask,
            productImage: product,
            logoImage: logo,
          });
        } else {
          // 创建新任务
          newTasks.push({
            id: `${product.id}-${logo.id}`,
            productImage: product,
            logoImage: logo,
            maskImage: individualMasks[product.id] || globalMaskData,
            useGlobalMask: !individualMasks[product.id],
            prompt: defaultPrompt,
            status: "pending",
            selected: true,
          });
        }
      }
    }
    setTasks(newTasks);
  }, [productImages, logoImages]);

  // 当全局遮罩更新时，更新使用全局遮罩的任务
  useEffect(() => {
    if (!globalMaskData) return;

    setTasks((prev) =>
      prev.map((task) => {
        if (task.useGlobalMask) {
          return { ...task, maskImage: globalMaskData };
        }
        return task;
      })
    );
  }, [globalMaskData]);

  // 上传处理
  const handleUploadProductImage = useCallback(async (file: File) => {
    const response = await uploadImage(file);
    return response.id;
  }, []);

  const handleUploadLogoImage = useCallback(async (file: File) => {
    const response = await uploadImage(file);
    return response.id;
  }, []);

  // 全选/取消全选
  const allSelected = tasks.length > 0 && tasks.every((t) => t.selected);
  const someSelected = tasks.some((t) => t.selected);

  const toggleSelectAll = () => {
    setTasks((prev) => prev.map((task) => ({ ...task, selected: !allSelected })));
  };

  const toggleTaskSelection = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, selected: !task.selected } : task))
    );
  };

  // 更新单个任务的提示词
  const updateTaskPrompt = (taskId: string, prompt: string) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, prompt } : task)));
  };

  // 批量填充提示词
  const fillAllPrompts = (prompt: string) => {
    setDefaultPrompt(prompt);
    setTasks((prev) => prev.map((task) => ({ ...task, prompt })));
  };

  // 打开全局圈选弹窗
  const openGlobalMaskDialog = () => {
    if (productImages.length === 0) {
      toast.error("请先上传商品图片");
      return;
    }
    setMaskDialogMode("global");
    setCurrentEditingTaskId(null);
    setMaskDialogOpen(true);
  };

  // 打开单独圈选弹窗
  const openIndividualMaskDialog = (taskId: string) => {
    setMaskDialogMode("individual");
    setCurrentEditingTaskId(taskId);
    setMaskDialogOpen(true);
  };

  // 保存圈选结果
  const handleSaveMask = (maskData: string, polygons: Polygon[]) => {
    if (maskDialogMode === "global") {
      setGlobalMaskData(maskData);
      setGlobalPolygons(polygons);
      toast.success("全局圈选已保存，将应用到所有商品图");
    } else if (currentEditingTaskId) {
      const task = tasks.find((t) => t.id === currentEditingTaskId);
      if (task) {
        setIndividualMasks((prev) => ({
          ...prev,
          [task.productImage.id]: maskData,
        }));
        setIndividualPolygons((prev) => ({
          ...prev,
          [task.productImage.id]: polygons,
        }));

        // 更新所有使用该商品图的任务
        setTasks((prev) =>
          prev.map((t) =>
            t.productImage.id === task.productImage.id
              ? { ...t, maskImage: maskData, useGlobalMask: false }
              : t
          )
        );
        toast.success("单独圈选已保存");
      }
    }
    setMaskDialogOpen(false);
  };

  // 重置为全局圈选
  const resetToGlobalMask = (productImageId: string) => {
    setIndividualMasks((prev) => {
      const newMasks = { ...prev };
      delete newMasks[productImageId];
      return newMasks;
    });
    setIndividualPolygons((prev) => {
      const newPolygons = { ...prev };
      delete newPolygons[productImageId];
      return newPolygons;
    });

    setTasks((prev) =>
      prev.map((t) =>
        t.productImage.id === productImageId
          ? { ...t, maskImage: globalMaskData, useGlobalMask: true }
          : t
      )
    );
    toast.success("已恢复使用全局圈选");
  };

  // 执行生成
  const handleGenerate = async (tasksToGenerate: TaskItem[]) => {
    if (tasksToGenerate.length === 0) {
      toast.error("请选择要生成的任务");
      return;
    }

    // 检查所有任务是否有遮罩
    const missingMask = tasksToGenerate.find((t) => !t.maskImage);
    if (missingMask) {
      toast.error("部分任务缺少圈选区域，请先完成圈选");
      return;
    }

    // 检查图片是否已上传
    const notUploadedProduct = tasksToGenerate.find((t) => !t.productImage.uploaded);
    const notUploadedLogo = tasksToGenerate.find((t) => !t.logoImage.uploaded);

    if (notUploadedProduct || notUploadedLogo) {
      const issues: string[] = [];
      if (notUploadedProduct) {
        const errorDetail = notUploadedProduct.productImage.uploadError
          ? `(${notUploadedProduct.productImage.uploadError})`
          : "";
        issues.push(
          `商品图 "${notUploadedProduct.productImage.file.name}" 未上传成功${errorDetail}`
        );
      }
      if (notUploadedLogo) {
        const errorDetail = notUploadedLogo.logoImage.uploadError
          ? `(${notUploadedLogo.logoImage.uploadError})`
          : "";
        issues.push(`Logo图 "${notUploadedLogo.logoImage.file.name}" 未上传成功${errorDetail}`);
      }
      toast.error(
        `图片上传问题: ${issues.join("; ")}。请检查后端服务是否运行，或删除失败的图片重新上传。`
      );
      return;
    }

    // 更新状态为生成中
    setTasks((prev) =>
      prev.map((task) =>
        tasksToGenerate.some((t) => t.id === task.id)
          ? { ...task, status: "generating" as const, error: undefined }
          : task
      )
    );

    // 并发生成（限制并发数）
    const concurrency = 3;
    const taskQueue = [...tasksToGenerate];

    const processTask = async (task: TaskItem) => {
      try {
        const taskResponse = await generateLogoReplace({
          product_image_id: task.productImage.uploadedId!,
          logo_image_id: task.logoImage.uploadedId!,
          mask_data: task.maskImage!,
          prompt: task.prompt,
          aspect_ratio: "1:1",
          image_size: "2K",
        });

        const result = await pollTaskUntilComplete(taskResponse.task_id);

        if (result.status === "failed") {
          throw new Error(result.error || "生成失败");
        }

        const resultId = result.results?.[0]?.id;
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "success" as const, resultId } : t))
        );
      } catch (error) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : "生成失败",
                }
              : t
          )
        );
      }
    };

    // 执行并发任务
    const executing: Promise<void>[] = [];
    for (const task of taskQueue) {
      const promise = processTask(task).then(() => {
        executing.splice(executing.indexOf(promise), 1);
      });
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    toast.success("批量生成完成");
  };

  // 开始生成所有选中的任务
  const handleGenerateSelected = () => {
    const selectedTasks = tasks.filter((t) => t.selected && t.status !== "generating");
    handleGenerate(selectedTasks);
  };

  // 重新生成选中的任务
  const handleRetrySelected = () => {
    const selectedTasks = tasks.filter(
      (t) => t.selected && (t.status === "failed" || t.status === "success")
    );
    handleGenerate(selectedTasks);
  };

  // 重新生成单个任务
  const handleRetrySingle = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      handleGenerate([task]);
    }
  };

  // 重置所有
  const handleReset = () => {
    setProductImages([]);
    setLogoImages([]);
    setGlobalPolygons([]);
    setGlobalMaskData("");
    setIndividualMasks({});
    setIndividualPolygons({});
    setTasks([]);
    setDefaultPrompt(DEFAULT_PROMPT);
    toast.success("已重置");
  };

  // 获取当前编辑任务的商品图
  const currentEditingProduct = useMemo(() => {
    if (maskDialogMode === "global") {
      return productImages[0];
    }
    if (currentEditingTaskId) {
      const task = tasks.find((t) => t.id === currentEditingTaskId);
      return task?.productImage;
    }
    return undefined;
  }, [maskDialogMode, currentEditingTaskId, productImages, tasks]);

  // 获取当前编辑的多边形
  const currentEditingPolygons = useMemo(() => {
    if (maskDialogMode === "global") {
      return globalPolygons;
    }
    if (currentEditingTaskId) {
      const task = tasks.find((t) => t.id === currentEditingTaskId);
      if (task) {
        return individualPolygons[task.productImage.id] || globalPolygons;
      }
    }
    return [];
  }, [maskDialogMode, currentEditingTaskId, globalPolygons, individualPolygons, tasks]);

  // 统计
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      generating: tasks.filter((t) => t.status === "generating").length,
      success: tasks.filter((t) => t.status === "success").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      selected: tasks.filter((t) => t.selected).length,
    };
  }, [tasks]);

  if (session?.status === "loading") {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logo替换</h1>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
      </div>

      {/* 上传区域 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <ImageUploader
            title="上传商品图"
            description={`已上传 ${productImages.length}/100 张`}
            multiple
            maxFiles={100}
            images={productImages}
            onImagesChange={setProductImages}
            onUpload={handleUploadProductImage}
          />
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <ImageUploader
            title="上传Logo图"
            description={`已上传 ${logoImages.length}/100 张`}
            multiple
            maxFiles={100}
            images={logoImages}
            onImagesChange={setLogoImages}
            onUpload={handleUploadLogoImage}
          />
        </div>
      </div>

      {/* 圈选区域 */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">统一圈选</h3>
            <p className="text-sm text-slate-500">点击下方按钮为所有商品图设置统一的Logo圈选区域</p>
          </div>
          <Button onClick={openGlobalMaskDialog} disabled={productImages.length === 0}>
            <Pencil className="mr-2 h-4 w-4" />
            {globalMaskData ? "修改圈选" : "开始圈选"}
          </Button>
        </div>

        {globalMaskData && (
          <div className="flex items-center gap-4 rounded-lg bg-green-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${globalMaskData}`}
              alt="全局圈选预览"
              className="h-24 w-24 rounded border object-contain"
            />
            <div className="text-sm text-green-700">
              <p>已设置全局圈选区域</p>
              <p className="text-green-600">此遮罩将应用到所有未单独设置的商品图</p>
            </div>
          </div>
        )}

        {!globalMaskData && productImages.length > 0 && (
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            请先设置全局圈选区域，或在下方任务列表中为每个商品单独设置
          </div>
        )}
      </div>

      {/* 提示词批量设置 */}
      <div className="rounded-lg bg-white p-4 shadow">
        <PromptBatchInput defaultPrompt={defaultPrompt} onFillAll={fillAllPrompts} />
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium">任务列表 ({stats.total} 个组合)</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">待生成: {stats.pending}</span>
                <span className="text-blue-500">生成中: {stats.generating}</span>
                <span className="text-green-500">成功: {stats.success}</span>
                <span className="text-red-500">失败: {stats.failed}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {allSelected ? (
                  <CheckSquare className="mr-1 h-4 w-4" />
                ) : (
                  <Square className="mr-1 h-4 w-4" />
                )}
                {allSelected ? "取消全选" : "全选"}
              </Button>
              <Button
                onClick={handleGenerateSelected}
                disabled={!someSelected || stats.generating > 0}
              >
                <Play className="mr-2 h-4 w-4" />
                开始生成 ({stats.selected})
              </Button>
              <Button
                variant="outline"
                onClick={handleRetrySelected}
                disabled={!someSelected || stats.generating > 0}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重新生成选中
              </Button>
            </div>
          </div>

          <TaskList
            tasks={tasks}
            onToggleSelect={toggleTaskSelection}
            onUpdatePrompt={updateTaskPrompt}
            onRetry={handleRetrySingle}
            onEditMask={openIndividualMaskDialog}
            onResetToGlobalMask={resetToGlobalMask}
            globalMaskData={globalMaskData}
            getResultImageUrl={getResultImageUrl}
          />
        </div>
      )}

      {/* 圈选弹窗 */}
      {maskDialogOpen && currentEditingProduct && (
        <MaskSelectorDialog
          open={maskDialogOpen}
          onClose={() => setMaskDialogOpen(false)}
          imageUrl={currentEditingProduct.preview}
          initialPolygons={currentEditingPolygons}
          onSave={handleSaveMask}
          title={maskDialogMode === "global" ? "设置全局圈选" : "设置单独圈选"}
        />
      )}
    </div>
  );
}
