import mongoose, { Document, Schema } from 'mongoose';

interface Annotation {
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

export interface IImage extends Document {
  _id: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  originalUrl: string;       // Cloudinary HTTPS URL
  thumbnail: string;         // Cloudinary transformation URL (320×240)
  cloudinaryPublicId?: string; // Stored so we can delete from Cloudinary on image delete
  width: number;
  height: number;
  annotations: Annotation[];
  createdAt: Date;
}

const annotationSchema = new Schema<Annotation>(
  {
    id: { type: String, required: true },
    points: { type: [Number], required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
    confidence: { type: Number },
    detectionMethod: { type: String, enum: ['auto', 'manual'], required: true },
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
  },
  { _id: false }
);

const imageSchema = new Schema<IImage>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Image name is required'],
      trim: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
    },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    annotations: {
      type: [annotationSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const Image = mongoose.model<IImage>('Image', imageSchema);
