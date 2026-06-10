'use client';

import React, { useRef, useState, useEffect, useCallback, ReactElement } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { Annotation } from '@/types';
import { hexToRgba } from '@/lib/utils';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 10; // 1000%

export interface CanvasControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface AnnotationCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  selectedId: string | null;
  isProcessing: boolean;
  onCanvasClick: (x: number, y: number) => void;
  onSelectAnnotation: (id: string | null) => void;
  containerWidth: number;
  containerHeight: number;
  /** Filled by the canvas so the parent toolbar can drive zoom in/out/reset */
  controlsRef?: React.RefObject<CanvasControls | null>;
}


export function AnnotationCanvas({
  imageUrl,
  annotations,
  selectedId,
  isProcessing,
  onCanvasClick,
  onSelectAnnotation,
  containerWidth,
  containerHeight,
  controlsRef,
}: AnnotationCanvasProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImageSize({ width: w, height: h });

      // Fit image to container
      const scaleX = containerWidth / w;
      const scaleY = containerHeight / h;
      const fitScale = Math.min(scaleX, scaleY, 1) * 0.92;
      setScale(fitScale);

      const scaledW = w * fitScale;
      const scaledH = h * fitScale;
      setOffset({
        x: (containerWidth - scaledW) / 2,
        y: (containerHeight - scaledH) / 2,
      });
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl, containerWidth, containerHeight]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * (1 + direction * 0.1)));

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  // Zoom keeping the center of the viewport fixed (used by the toolbar buttons)
  const zoomAroundCenter = useCallback((factor: number) => {
    setStageScale((oldScale) => {
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * factor));
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      setStagePos((pos) => ({
        x: cx - ((cx - pos.x) / oldScale) * newScale,
        y: cy - ((cy - pos.y) / oldScale) * newScale,
      }));
      return newScale;
    });
  }, [containerWidth, containerHeight]);

  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      zoomIn: () => zoomAroundCenter(1.5),
      zoomOut: () => zoomAroundCenter(1 / 1.5),
      resetView: () => {
        setStageScale(1);
        setStagePos({ x: 0, y: 0 });
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, zoomAroundCenter]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelectAnnotation(null);
    }

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Convert to image coordinates
    const worldX = (pointer.x - stagePos.x) / stageScale;
    const worldY = (pointer.y - stagePos.y) / stageScale;

    const imageX = (worldX - offset.x) / scale;
    const imageY = (worldY - offset.y) / scale;

    if (
      imageX >= 0 &&
      imageX <= imageSize.width &&
      imageY >= 0 &&
      imageY <= imageSize.height
    ) {
      setClickIndicator({ x: worldX, y: worldY });
      setTimeout(() => setClickIndicator(null), 1500);
      onCanvasClick(imageX, imageY);
    }
  }, [stagePos, stageScale, offset, scale, imageSize, onCanvasClick, onSelectAnnotation]);

  if (!image) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#8b949e]">
        <div className="text-center">
          <div className="spinner mx-auto mb-3" style={{ width: 32, height: 32 }} />
          <p className="text-sm">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      scaleX={stageScale}
      scaleY={stageScale}
      x={stagePos.x}
      y={stagePos.y}
      onWheel={handleWheel}
      onClick={handleStageClick}
      draggable
      onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
      style={{ cursor: isProcessing ? 'wait' : 'crosshair' }}
    >
      <Layer>
        {/* Background image */}
        <KonvaImage
          image={image}
          x={offset.x}
          y={offset.y}
          width={imageSize.width * scale}
          height={imageSize.height * scale}
        />

        {/* Annotations */}
        {annotations.map((ann) => {
          const scaledPoints = ann.points.map((p, i) =>
            i % 2 === 0 ? offset.x + p * scale : offset.y + p * scale
          );
          const isSelected = ann.id === selectedId;
          const fillColor = hexToRgba(ann.color, isSelected ? 0.35 : 0.2);
          const strokeColor = ann.color;

          // Label position (centroid)
          const xs = scaledPoints.filter((_, i) => i % 2 === 0);
          const ys = scaledPoints.filter((_, i) => i % 2 === 1);
          const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
          const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

          return (
            <Group
              key={ann.id}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectAnnotation(ann.id === selectedId ? null : ann.id);
              }}
            >
              {/* Polygon fill — stroke stays 1px-ish on screen at any zoom */}
              <Line
                points={scaledPoints}
                closed
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeScaleEnabled={false}
                dash={isSelected ? [] : []}
                opacity={1}
                listening
              />
              {/* Vertices — constant screen size regardless of zoom */}
              {isSelected &&
                scaledPoints.reduce((acc: ReactElement[], _, idx) => {
                  if (idx % 2 === 0) {
                    acc.push(
                      <Circle
                        key={idx}
                        x={scaledPoints[idx]}
                        y={scaledPoints[idx + 1]}
                        radius={3 / stageScale}
                        fill={strokeColor}
                        stroke="#fff"
                        strokeWidth={1}
                        strokeScaleEnabled={false}
                      />
                    );
                  }
                  return acc;
                }, [])}
              {/* Label — inverse-scaled so it keeps the same size on screen
                  while the image underneath zooms */}
              <Group x={cx} y={cy} scaleX={1 / stageScale} scaleY={1 / stageScale}>
                <Rect
                  x={-2}
                  y={-11}
                  width={ann.label.length * 7 + 16}
                  height={20}
                  fill={strokeColor}
                  cornerRadius={4}
                  opacity={0.95}
                />
                <Text
                  x={6}
                  y={-7}
                  text={ann.label}
                  fontSize={11}
                  fontStyle="bold"
                  fill="#fff"
                  listening={false}
                />
              </Group>
            </Group>
          );
        })}

        {/* Click indicator */}
        {clickIndicator && (
          <Group>
            <Circle
              x={clickIndicator.x}
              y={clickIndicator.y}
              radius={16 / stageScale}
              stroke="#58a6ff"
              strokeWidth={2}
              strokeScaleEnabled={false}
              opacity={0.8}
              dash={[4, 4]}
            />
            <Circle
              x={clickIndicator.x}
              y={clickIndicator.y}
              radius={4 / stageScale}
              fill="#58a6ff"
              opacity={0.9}
            />
          </Group>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <Group>
            <Rect
              x={0}
              y={0}
              width={containerWidth / stageScale}
              height={containerHeight / stageScale}
              fill="rgba(3, 7, 18, 0.4)"
            />
          </Group>
        )}
      </Layer>
    </Stage>
  );
}
