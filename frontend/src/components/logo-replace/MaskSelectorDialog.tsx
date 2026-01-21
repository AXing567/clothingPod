"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Check, Trash2, Undo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Polygon, Point } from "./PolygonSelector";
import { generateId } from "@/lib/utils";
import { POINT_RADIUS, POINT_HIT_RADIUS } from "./constants";

interface MaskSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  initialPolygons: Polygon[];
  onSave: (maskData: string, polygons: Polygon[]) => void;
  title?: string;
}

export function MaskSelectorDialog({
  open,
  onClose,
  imageUrl,
  initialPolygons,
  onSave,
  title = "设置圈选区域",
}: MaskSelectorDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 使用 key 机制重新挂载组件，因此可以直接用 props 初始化状态
  const [polygons, setPolygons] = useState<Polygon[]>(() =>
    initialPolygons.length > 0 ? [...initialPolygons] : []
  );
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [activePolygonId, setActivePolygonId] = useState<string | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<{
    polygonId: string;
    pointIndex: number;
  } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    polygonId: string;
    pointIndex: number;
  } | null>(null);

  // 加载图片
  useEffect(() => {
    if (!open) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;

      // 计算适合容器的尺寸
      const containerWidth = 700;
      const maxHeight = 500;

      const imgRatio = img.width / img.height;
      let width = containerWidth;
      let height = containerWidth / imgRatio;

      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * imgRatio;
      }

      setCanvasSize({ width, height });
      setScale(width / img.width);
    };
    img.src = imageUrl;
  }, [imageUrl, open]);

  // 绘制画布
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    polygons.forEach((polygon) => {
      const isActive = polygon.id === activePolygonId;
      const points = polygon.points;

      if (points.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x * scale, points[0].y * scale);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * scale, points[i].y * scale);
      }

      if (polygon.closed) {
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fill();
      }

      ctx.strokeStyle = isActive ? "#ff0000" : "#ff6666";
      ctx.lineWidth = 2;
      ctx.stroke();

      points.forEach((point, index) => {
        const isHovered =
          hoveredPoint?.polygonId === polygon.id && hoveredPoint?.pointIndex === index;
        const isDragging =
          draggingPoint?.polygonId === polygon.id && draggingPoint?.pointIndex === index;

        ctx.beginPath();
        ctx.arc(
          point.x * scale,
          point.y * scale,
          isHovered || isDragging ? POINT_RADIUS + 2 : POINT_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = isDragging ? "#ff0000" : isHovered ? "#ff6666" : "#fff";
        ctx.fill();
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  }, [polygons, activePolygonId, hoveredPoint, draggingPoint, scale]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 获取鼠标在图片坐标系中的位置
  const getImageCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  // 查找鼠标位置的顶点
  const findPointAtPosition = useCallback(
    (pos: Point): { polygonId: string; pointIndex: number } | null => {
      for (const polygon of polygons) {
        for (let i = 0; i < polygon.points.length; i++) {
          const point = polygon.points[i];
          const dist = Math.sqrt(
            Math.pow((point.x - pos.x) * scale, 2) + Math.pow((point.y - pos.y) * scale, 2)
          );
          if (dist <= POINT_HIT_RADIUS) {
            return { polygonId: polygon.id, pointIndex: i };
          }
        }
      }
      return null;
    },
    [polygons, scale]
  );

  // 鼠标点击处理
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingPoint) return;

      const pos = getImageCoords(e);
      const hitPoint = findPointAtPosition(pos);

      if (hitPoint) {
        setActivePolygonId(hitPoint.polygonId);
        return;
      }

      let activePolygon = polygons.find((p) => p.id === activePolygonId);

      if (!activePolygon || activePolygon.closed) {
        const newPolygon: Polygon = {
          id: generateId(),
          points: [pos],
          closed: false,
        };
        setPolygons([...polygons, newPolygon]);
        setActivePolygonId(newPolygon.id);
        return;
      }

      const updatedPolygons = polygons.map((p) => {
        if (p.id === activePolygonId) {
          return { ...p, points: [...p.points, pos] };
        }
        return p;
      });
      setPolygons(updatedPolygons);
    },
    [activePolygonId, draggingPoint, findPointAtPosition, getImageCoords, polygons]
  );

  // 双击闭合多边形
  const handleDoubleClick = useCallback(() => {
    if (!activePolygonId) return;

    const activePolygon = polygons.find((p) => p.id === activePolygonId);
    if (!activePolygon || activePolygon.closed || activePolygon.points.length < 3) return;

    const updatedPolygons = polygons.map((p) => {
      if (p.id === activePolygonId) {
        return { ...p, closed: true };
      }
      return p;
    });
    setPolygons(updatedPolygons);
    setActivePolygonId(null);
  }, [activePolygonId, polygons]);

  // 鼠标移动处理
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getImageCoords(e);

      if (draggingPoint) {
        const updatedPolygons = polygons.map((p) => {
          if (p.id === draggingPoint.polygonId) {
            const newPoints = [...p.points];
            newPoints[draggingPoint.pointIndex] = pos;
            return { ...p, points: newPoints };
          }
          return p;
        });
        setPolygons(updatedPolygons);
        return;
      }

      const hitPoint = findPointAtPosition(pos);
      setHoveredPoint(hitPoint);
    },
    [draggingPoint, findPointAtPosition, getImageCoords, polygons]
  );

  // 鼠标按下处理
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getImageCoords(e);
      const hitPoint = findPointAtPosition(pos);

      if (hitPoint) {
        setDraggingPoint(hitPoint);
        e.preventDefault();
      }
    },
    [findPointAtPosition, getImageCoords]
  );

  // 鼠标释放处理
  const handleMouseUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  // 删除选中的多边形
  const deleteActivePolygon = useCallback(() => {
    if (!activePolygonId) return;
    setPolygons(polygons.filter((p) => p.id !== activePolygonId));
    setActivePolygonId(null);
  }, [activePolygonId, polygons]);

  // 撤销最后一个顶点
  const undoLastPoint = useCallback(() => {
    if (!activePolygonId) return;

    const activePolygon = polygons.find((p) => p.id === activePolygonId);
    if (!activePolygon || activePolygon.closed) return;

    if (activePolygon.points.length <= 1) {
      setPolygons(polygons.filter((p) => p.id !== activePolygonId));
      setActivePolygonId(null);
    } else {
      const updatedPolygons = polygons.map((p) => {
        if (p.id === activePolygonId) {
          return { ...p, points: p.points.slice(0, -1) };
        }
        return p;
      });
      setPolygons(updatedPolygons);
    }
  }, [activePolygonId, polygons]);

  // 清除所有多边形
  const clearAll = useCallback(() => {
    setPolygons([]);
    setActivePolygonId(null);
  }, []);

  // 生成遮罩图
  const generateMask = useCallback((): string => {
    const img = imageRef.current;
    if (!img) return "";

    const offscreen = document.createElement("canvas");
    offscreen.width = img.width;
    offscreen.height = img.height;
    const ctx = offscreen.getContext("2d");

    if (!ctx) return "";

    ctx.drawImage(img, 0, 0);

    polygons.forEach((polygon) => {
      if (!polygon.closed || polygon.points.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
      for (let i = 1; i < polygon.points.length; i++) {
        ctx.lineTo(polygon.points[i].x, polygon.points[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
      ctx.fill();
    });

    return offscreen.toDataURL("image/png").split(",")[1];
  }, [polygons]);

  // 保存处理
  const handleSave = useCallback(() => {
    const closedPolygons = polygons.filter((p) => p.closed);
    if (closedPolygons.length === 0) {
      return;
    }

    const maskData = generateMask();
    onSave(maskData, polygons);
  }, [generateMask, onSave, polygons]);

  const closedPolygonsCount = polygons.filter((p) => p.closed).length;
  const activePolygon = polygons.find((p) => p.id === activePolygonId);
  const isDrawing = activePolygon && !activePolygon.closed;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">已圈选 {closedPolygonsCount} 个区域</span>
              {isDrawing && (
                <span className="text-sm text-blue-600">
                  （正在绘制，已有 {activePolygon.points.length} 个顶点）
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDrawing && (
                <>
                  <Button variant="outline" size="sm" onClick={undoLastPoint}>
                    <Undo className="mr-1 h-4 w-4" />
                    撤销
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDoubleClick}
                    disabled={activePolygon.points.length < 3}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    闭合
                  </Button>
                </>
              )}
              {activePolygonId && activePolygon?.closed && (
                <Button variant="destructive" size="sm" onClick={deleteActivePolygon}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除选中
                </Button>
              )}
              {polygons.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  清除全部
                </Button>
              )}
            </div>
          </div>

          {/* 操作提示 */}
          <div className="rounded bg-slate-100 p-3 text-sm text-slate-500">
            <ul className="list-inside list-disc space-y-1">
              <li>点击图片添加多边形顶点</li>
              <li>拖拽顶点可调整位置</li>
              <li>至少3个顶点后点击"闭合"按钮完成圈选</li>
              <li>可创建多个独立的圈选区域</li>
            </ul>
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="relative flex justify-center overflow-hidden rounded-lg border bg-slate-100"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`cursor-${draggingPoint ? "grabbing" : hoveredPoint ? "grab" : "crosshair"}`}
              style={{ display: "block" }}
            />
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={closedPolygonsCount === 0}>
              <Check className="mr-1 h-4 w-4" />
              保存圈选 ({closedPolygonsCount} 个区域)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
