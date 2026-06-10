export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

/** Category shape returned by the API (no embedded images array) */
export interface ApiCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  imageCount: number;
  annotationCount: number;
  thumbnails: string[];
  createdAt: string;
}

export interface Annotation {
  id: string;
  points: number[];
  label: string;
  color: string;
  confidence?: number;
  detectionMethod: 'auto' | 'manual';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AnnotatedImage {
  id: string;
  name: string;
  originalUrl: string;
  width: number;
  height: number;
  annotations: Annotation[];
  categoryId: string;
  createdAt: string;
  thumbnail?: string;
}

/** Legacy local-only category shape (kept for annotate session store) */
export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  images: AnnotatedImage[];
  createdAt: string;
}

export interface DetectionResult {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  model: 'yolo' | 'segformer';
}

export interface SegmentationResult {
  points: number[];
  mask: number[][];
  confidence: number;
}

export const ANNOTATION_COLORS = [
  '#58a6ff',
  '#bc8cff',
  '#3fb950',
  '#f0883e',
  '#f85149',
  '#ffa657',
  '#79c0ff',
  '#d2a8ff',
  '#56d364',
  '#ff7b72',
];

export const SATELLITE_OBJECT_CLASSES = [
  'Building',
  'Road',
  'Vehicle',
  'Aircraft',
  'Ship',
  'Water Body',
  'Forest',
  'Agricultural Land',
  'Solar Panel',
  'Runway',
  'Bridge',
  'Stadium',
  'Harbor',
  'Industrial Area',
  'Residential Area',
  'Cloud',
  'Shadow',
  'Unknown',
];
