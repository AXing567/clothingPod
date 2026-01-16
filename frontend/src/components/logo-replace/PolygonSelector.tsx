"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Undo, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  id: string;
  points: Point[];
  closed: boolean;
}

interface PolygonSelectorProps {
  imageUrl: string;
  polygons: Polygon[];
  onPolygonsChange: (polygons: Polygon[]) => void;
}

const POINT_RADIUS = 6;
const POINT_HIT_RADIUS = 12;

export function PolygonSelector({
  imageUrl,
  polygons,
  onPolygonsChange,
}: PolygonSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;

      // 计算适合容器的尺寸
      const container = containerRef.current;
      if (container) {
        const containerWidth = container.clientWidth;
        const maxHeight = 600;

        const imgRatio = img.width / img.height;
        let width = containerWidth;
        let height = containerWidth / imgRatio;

        if (height > maxHeight) {
          height = maxHeight;
          width = maxHeight * imgRatio;
        }

        setCanvasSize({ width, height });
        setScale(width / img.width);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 绘制画布
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制图片
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 绘制所有多边形
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

      // 绘制顶点
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
      if (draggingPoint) return; // 拖拽时不处理点击

      const pos = getImageCoords(e);
      const hitPoint = findPointAtPosition(pos);

      if (hitPoint) {
        // 点击了已有顶点，选中该多边形
        setActivePolygonId(hitPoint.polygonId);
        return;
      }

      // 获取或创建活动多边形
      let activePolygon = polygons.find((p) => p.id === activePolygonId);

      if (!activePolygon || activePolygon.closed) {
        // 创建新多边形
        const newPolygon: Polygon = {
          id: crypto.randomUUID(),
          points: [pos],
          closed: false,
        };
        onPolygonsChange([...polygons, newPolygon]);
        setActivePolygonId(newPolygon.id);
        return;
      }

      // 添加新顶点到活动多边形
      const updatedPolygons = polygons.map((p) => {
        if (p.id === activePolygonId) {
          return { ...p, points: [...p.points, pos] };
        }
        return p;
      });
      onPolygonsChange(updatedPolygons);
    },
    [
      activePolygonId,
      draggingPoint,
      findPointAtPosition,
      getImageCoords,
      onPolygonsChange,
      polygons,
    ]
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
    onPolygonsChange(updatedPolygons);
    setActivePolygonId(null);
  }, [activePolygonId, onPolygonsChange, polygons]);

  // 鼠标移动处理
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getImageCoords(e);

      if (draggingPoint) {
        // 拖拽顶点
        const updatedPolygons = polygons.map((p) => {
          if (p.id === draggingPoint.polygonId) {
            const newPoints = [...p.points];
            newPoints[draggingPoint.pointIndex] = pos;
            return { ...p, points: newPoints };
          }
          return p;
        });
        onPolygonsChange(updatedPolygons);
        return;
      }

      // 检查悬停
      const hitPoint = findPointAtPosition(pos);
      setHoveredPoint(hitPoint);
    },
    [draggingPoint, findPointAtPosition, getImageCoords, onPolygonsChange, polygons]
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
    onPolygonsChange(polygons.filter((p) => p.id !== activePolygonId));
    setActivePolygonId(null);
  }, [activePolygonId, onPolygonsChange, polygons]);

  // 撤销最后一个顶点
  const undoLastPoint = useCallback(() => {
    if (!activePolygonId) return;

    const activePolygon = polygons.find((p) => p.id === activePolygonId);
    if (!activePolygon || activePolygon.closed) return;

    if (activePolygon.points.length <= 1) {
      // 只剩一个点，删除整个多边形
      onPolygonsChange(polygons.filter((p) => p.id !== activePolygonId));
      setActivePolygonId(null);
    } else {
      // 删除最后一个点
      const updatedPolygons = polygons.map((p) => {
        if (p.id === activePolygonId) {
          return { ...p, points: p.points.slice(0, -1) };
        }
        return p;
      });
      onPolygonsChange(updatedPolygons);
    }
  }, [activePolygonId, onPolygonsChange, polygons]);

  // 生成遮罩图
  const generateMask = useCallback((): string => {
    const img = imageRef.current;
    if (!img) return "";

    // 创建离屏Canvas，使用原图尺寸
    const offscreen = document.createElement("canvas");
    offscreen.width = img.width;
    offscreen.height = img.height;
    const ctx = offscreen.getContext("2d");

    if (!ctx) return "";

    // 绘制原图
    ctx.drawImage(img, 0, 0);

    // 在圈选区域绘制红色遮罩
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

  // 暴露生成遮罩方法
  useEffect(() => {
    // @ts-expect-error - 用于暴露遮罩生成方法到全局
    window.__generateMask = generateMask;
  }, [generateMask]);

  const closedPolygonsCount = polygons.filter((p) => p.closed).length;
  const activePolygon = polygons.find((p) => p.id === activePolygonId);
  const isDrawing = activePolygon && !activePolygon.closed;

  return (
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
      <div ref={containerRef} className="relative overflow-hidden rounded-lg border">
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
    </div>
  );
}

/**
 * 获取遮罩图的辅助函数
 */
export function getGeneratedMask(): string {
  // @ts-expect-error - 从全局获取遮罩生成方法
  return window.__generateMask?.() || "";
}
