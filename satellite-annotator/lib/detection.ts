'use client';

import { DetectionResult, SATELLITE_OBJECT_CLASSES } from '@/types';

/**
 * Dummy object detection combining YOLO + Segformer outputs.
 * Returns null ~20% of the time to simulate detection failure
 * (prompting the user to enter the label manually).
 */
export async function runObjectDetection(
  clickX: number,
  clickY: number,
  imageWidth: number,
  imageHeight: number
): Promise<DetectionResult | null> {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 300));

  // Simulate failure ~20% of the time
  if (Math.random() < 0.2) return null;

  const label = SATELLITE_OBJECT_CLASSES[Math.floor(Math.random() * (SATELLITE_OBJECT_CLASSES.length - 1))];
  const model: 'yolo' | 'segformer' = Math.random() > 0.5 ? 'yolo' : 'segformer';
  const confidence = 0.65 + Math.random() * 0.34;

  const bw = 40 + Math.random() * 80;
  const bh = 40 + Math.random() * 80;
  const bx = Math.max(0, Math.min(imageWidth - bw, clickX - bw / 2));
  const by = Math.max(0, Math.min(imageHeight - bh, clickY - bh / 2));

  return {
    label,
    confidence,
    model,
    boundingBox: { x: bx, y: by, width: bw, height: bh },
  };
}
