'use client';

import React, { useRef, useState, useEffect, useCallback, ReactElement } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { Annotation } from '@/types';
import { hexToRgba } from '@/lib/utils';

interface ReadOnlyCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  selectedId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  containerWidth: number;
  containerHeight: number;
}

export function ReadOnlyCanvas({
  imageUrl,
  annotations,
  selectedId,
  onSelectAnnotation,
  containerWidth,
  containerHeight,
}: ReadOnlyCanvasProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
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

      const scaleX = containerWidth / w;
      const scaleY = containerHeight / h;
      const fitScale = Math.min(scaleX, scaleY, 1) * 0.92;
      setScale(fitScale);
      setOffset({
        x: (containerWidth - w * fitScale) / 2,
        y: (containerHeight - h * fitScale) / 2,
      });
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl, containerWidth, containerHeight]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = stageScale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = Math.max(0.3, Math.min(10, oldScale * (1 + direction * 0.1)));
      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [stageScale, stagePos]
  );

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
      onClick={(e) => {
        if (e.target === e.target.getStage()) onSelectAnnotation(null);
      }}
      draggable
      onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
      style={{ cursor: 'grab' }}
    >
      <Layer>
        <KonvaImage
          image={image}
          x={offset.x}
          y={offset.y}
          width={imageSize.width * scale}
          height={imageSize.height * scale}
        />

        {annotations.map((ann) => {
          const scaledPoints = ann.points.map((p, i) =>
            i % 2 === 0 ? offset.x + p * scale : offset.y + p * scale
          );
          const isSelected = ann.id === selectedId;
          const fillColor = hexToRgba(ann.color, isSelected ? 0.4 : 0.22);

          const xs = scaledPoints.filter((_, i) => i % 2 === 0);
          const ys = scaledPoints.filter((_, i) => i % 2 === 1);
          const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
          const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
          const labelWidth = ann.label.length * 7 + 16;

          return (
            <Group
              key={ann.id}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectAnnotation(ann.id === selectedId ? null : ann.id);
              }}
            >
              <Line
                points={scaledPoints}
                closed
                fill={fillColor}
                stroke={ann.color}
                strokeWidth={isSelected ? 3 : 1.8}
                strokeScaleEnabled={false}
                listening
              />

              {/* Vertex dots when selected — constant screen size */}
              {isSelected &&
                scaledPoints.reduce((acc: ReactElement[], _, idx) => {
                  if (idx % 2 === 0) {
                    acc.push(
                      <Circle
                        key={idx}
                        x={scaledPoints[idx]}
                        y={scaledPoints[idx + 1]}
                        radius={4 / stageScale}
                        fill={ann.color}
                        stroke="#fff"
                        strokeWidth={1.5}
                        strokeScaleEnabled={false}
                      />
                    );
                  }
                  return acc;
                }, [])}

              {/* Label badge — inverse-scaled so it stays the same size
                  on screen while the image zooms */}
              <Group x={cx} y={cy} scaleX={1 / stageScale} scaleY={1 / stageScale}>
                <Rect
                  x={-2}
                  y={-11}
                  width={labelWidth}
                  height={20}
                  fill={ann.color}
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
      </Layer>
    </Stage>
  );
}
