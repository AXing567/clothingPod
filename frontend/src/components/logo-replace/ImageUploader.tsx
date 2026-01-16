"use client";

import { useCallback, useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  uploaded: boolean;
  uploadedId?: string;
  uploadError?: string; // 上传失败的错误信息
}

// 支持函数式更新或直接值
type ImageChangeHandler =
  | ((images: UploadedImage[]) => void)
  | React.Dispatch<React.SetStateAction<UploadedImage[]>>;

interface ImageUploaderProps {
  title: string;
  description?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // bytes
  images: UploadedImage[];
  onImagesChange: ImageChangeHandler;
  onUpload?: (file: File) => Promise<string>; // 返回上传后的ID
}

export function ImageUploader({
  title,
  description,
  multiple = true,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  images,
  onImagesChange,
  onUpload,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<Set<string>>(new Set());

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((file) => {
        if (!file.type.startsWith("image/")) {
          return false;
        }
        if (file.size > maxSize) {
          return false;
        }
        return true;
      });

      if (!multiple && validFiles.length > 0) {
        // 单文件模式，替换现有图片
        const file = validFiles[0];
        const newImage: UploadedImage = {
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          uploaded: false,
        };
        onImagesChange([newImage]);

        // 自动上传
        if (onUpload) {
          setUploading(new Set([newImage.id]));
          try {
            const uploadedId = await onUpload(file);
            onImagesChange([{ ...newImage, uploaded: true, uploadedId }]);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "上传失败";
            onImagesChange([{ ...newImage, uploaded: false, uploadError: errorMsg }]);
            toast.error(`图片上传失败: ${errorMsg}`);
          } finally {
            setUploading(new Set());
          }
        }
        return;
      }

      // 多文件模式
      const remainingSlots = maxFiles - images.length;
      const filesToAdd = validFiles.slice(0, remainingSlots);

      const newImages: UploadedImage[] = filesToAdd.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        uploaded: false,
      }));

      const allImages = [...images, ...newImages];
      onImagesChange(allImages);

      // 自动上传新文件
      if (onUpload) {
        const uploadingIds = new Set(newImages.map((img) => img.id));
        setUploading(uploadingIds);

        let failedCount = 0;
        let successCount = 0;

        // 存储上传结果
        const uploadResults: Map<
          string,
          { uploaded: boolean; uploadedId?: string; uploadError?: string }
        > = new Map();

        // 并发上传，但收集结果
        await Promise.all(
          newImages.map(async (img) => {
            try {
              const uploadedId = await onUpload(img.file);
              uploadResults.set(img.id, { uploaded: true, uploadedId });
              successCount++;
              console.log(`[ImageUploader] 图片 ${img.file.name} 上传完成，ID: ${uploadedId}`);
            } catch (error) {
              failedCount++;
              const errorMsg = error instanceof Error ? error.message : "上传失败";
              uploadResults.set(img.id, { uploaded: false, uploadError: errorMsg });
              console.error(`[ImageUploader] 图片 ${img.file.name} 上传失败:`, errorMsg);
            }
          })
        );

        // 构建最终的图片数组（基于 allImages + uploadResults）
        const finalImages = allImages.map((img) => {
          const result = uploadResults.get(img.id);
          if (result) {
            console.log(`[ImageUploader] 更新图片状态: ${img.file.name}`, result);
            return { ...img, ...result };
          }
          return img;
        });

        console.log(
          `[ImageUploader] 最终图片数组:`,
          finalImages.map((img) => ({
            name: img.file.name,
            uploaded: img.uploaded,
            uploadedId: img.uploadedId,
          }))
        );

        // 直接更新状态
        onImagesChange(finalImages);

        setUploading(new Set());

        console.log(`[ImageUploader] 批量上传完成: 成功 ${successCount}, 失败 ${failedCount}`);

        if (failedCount > 0) {
          toast.error(`${failedCount} 张图片上传失败，请检查后端服务是否运行`);
        }
      }
    },
    [images, maxFiles, maxSize, multiple, onImagesChange, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      onImagesChange(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>

      {/* 上传区域 */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleInputChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">拖拽图片到此处，或点击上传</p>
        <p className="mt-1 text-xs text-slate-400">
          支持 PNG, JPG, WEBP 格式，最大 {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>

      {/* 已上传图片预览 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="预览" className="h-full w-full object-cover" />

              {/* 上传状态 */}
              {uploading.has(image.id) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}

              {/* 上传成功标记 */}
              {image.uploaded && !uploading.has(image.id) && (
                <div className="absolute left-2 top-2 rounded bg-green-500 px-2 py-0.5 text-xs text-white">
                  已上传
                </div>
              )}

              {/* 上传失败标记 */}
              {image.uploadError && !uploading.has(image.id) && (
                <div
                  className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-500 px-2 py-0.5 text-xs text-white"
                  title={image.uploadError}
                >
                  <AlertCircle className="h-3 w-3" />
                  上传失败
                </div>
              )}

              {/* 删除按钮 */}
              <button
                onClick={() => removeImage(image.id)}
                className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 文件名 */}
              <div className="absolute bottom-0 left-0 right-0 truncate bg-black/60 p-2 text-xs text-white">
                {image.file.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 图片数量提示 */}
      {multiple && (
        <p className="text-sm text-slate-500">
          已选择 {images.length} / {maxFiles} 张图片
        </p>
      )}
    </div>
  );
}
