'use client';

import axios from 'axios';
import { DetectionResult } from '@/types';

// Client for the Python AI service (SAM2 + YOLO + SegFormer).
// The service receives the Cloudinary URL of the image — never the raw file —
// downloads it once, embeds it in SAM2 and caches YOLO/SegFormer outputs.
const aiApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AI_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

export interface AIBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AIDetection {
  label: string;
  confidence: number;
  model: 'yolo' | 'segformer';
  boundingBox: AIBoundingBox;
}

export interface SetImageResponse {
  width: number;
  height: number;
  detections: AIDetection[];
}

export interface SegmentResponse {
  points: number[];
  label: string;
  confidence: number;
  model: 'yolo' | 'segformer';
  samScore: number;
  area: number;
  perimeter: number;
  solidity: number;
  boundingBox: AIBoundingBox;
}

/**
 * Prepare an image in the AI service (SAM2 embedding + full-image YOLO pass).
 * Called right after the image is uploaded to Cloudinary.
 * Returns the image size and all YOLO detections for auto-annotation.
 */
export async function prepareImage(imageUrl: string): Promise<SetImageResponse> {
  const { data } = await aiApi.post<SetImageResponse>('/set-image', { imageUrl });
  return data;
}

/**
 * SAM2 point-prompt segmentation + classification at a clicked pixel
 * (image coordinates). Mirrors a left-click in the interactive notebook.
 */
export async function segmentAtPoint(
  imageUrl: string,
  x: number,
  y: number
): Promise<SegmentResponse> {
  const { data } = await aiApi.post<SegmentResponse>('/segment', { imageUrl, x, y });
  return data;
}

/** Convert a segment response into the DetectionResult shape used by the UI. */
export function toDetectionResult(seg: SegmentResponse): DetectionResult {
  return {
    label: seg.label,
    confidence: seg.confidence,
    model: seg.model,
    boundingBox: seg.boundingBox,
  };
}

/** Convert a bounding box to a closed polygon (flat [x1,y1,...] list). */
export function boxToPolygon(box: AIBoundingBox): number[] {
  return [
    box.x, box.y,
    box.x + box.width, box.y,
    box.x + box.width, box.y + box.height,
    box.x, box.y + box.height,
  ];
}
