import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initializeDatabase } from './config/database';
import logger from './config/logger';
import { workerRegistry } from './controllers/SystemController';
import { APP_VERSION } from './version';

const PORT = process.env.PORT || 5055;

// Initialize database
try {
  initializeDatabase();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
}

// Start background workers
try {
  workerRegistry.startDefaults();
  logger.info('Background workers started');
} catch (error) {
  logger.error('Failed to start background workers:', error);
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`MediaStack API v${APP_VERSION} listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  // Stop all workers
  workerRegistry.getAll().forEach(w => workerRegistry.stop(w.id));
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  // Stop all workers
  workerRegistry.getAll().forEach(w => workerRegistry.stop(w.id));
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
