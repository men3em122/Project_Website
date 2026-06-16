import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { uploadsDir } from './config/storage';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import { imagesRouter } from './routes/images';
import { uploadsRouter } from './routes/uploads';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = parseInt(process.env.PORT ?? '5000', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve locally stored images
app.use('/uploads', express.static(uploadsDir()));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api', imagesRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
// connectDB() is async because sql.js initialises asynchronously (WASM load),
// but all subsequent DB calls are synchronous — no network required at runtime.
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
      console.log(`   Uploads dir: ${uploadsDir()}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

