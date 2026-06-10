'use client';

import { SegmentationResult } from '@/types';

/**
 * Dummy SAM2 segmentation.
 * In production this would call a real SAM2 model endpoint.
 * Here we generate a plausible polygon around the click point.
 */
export async function runSAM2Segmentation(
  imageWidth: number,
  imageHeight: number,
  clickX: number,
  clickY: number
): Promise<SegmentationResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

  const radius = 30 + Math.random() * 60;
  const numPoints = 8 + Math.floor(Math.random() * 6);
  const points: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const r = radius * (0.7 + Math.random() * 0.6);
    const px = Math.max(0, Math.min(imageWidth, clickX + Math.cos(angle) * r));
    const py = Math.max(0, Math.min(imageHeight, clickY + Math.sin(angle) * r));
    points.push(px, py);
  }

  return {
    points,
    mask: [],
    confidence: 0.82 + Math.random() * 0.17,
  };
}
