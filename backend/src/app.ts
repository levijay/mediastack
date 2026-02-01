import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import searchRoutes from './routes/search';
import settingsRoutes from './routes/settings';
import automationRoutes from './routes/automation';
import libraryRoutes from './routes/library';
import calendarRoutes from './routes/calendar';
import scannerRoutes from './routes/scanner';
import mediaManagementRoutes from './routes/mediaManagement';
import customFormatsRoutes from './routes/customFormats';
import imageRoutes from './routes/images';
import arrImportRoutes from './routes/arrImport';
import reportsRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import logger from './config/logger';

const app = express();

// CORS - allow everything
app.use(cors());

// Body parsing - increased limit for backup/restore
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/mediamanagement', mediaManagementRoutes);
app.use('/api/customformats', customFormatsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/arr', arrImportRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
