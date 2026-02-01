"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const logger_1 = __importDefault(require("./config/logger"));
const SystemController_1 = require("./controllers/SystemController");
const version_1 = require("./version");
const PORT = process.env.PORT || 5055;
// Initialize database
try {
    (0, database_1.initializeDatabase)();
    logger_1.default.info('Database initialized successfully');
}
catch (error) {
    logger_1.default.error('Failed to initialize database:', error);
    process.exit(1);
}
// Start background workers
try {
    SystemController_1.workerRegistry.startDefaults();
    logger_1.default.info('Background workers started');
}
catch (error) {
    logger_1.default.error('Failed to start background workers:', error);
}
// Start server
const server = app_1.default.listen(PORT, () => {
    logger_1.default.info(`MediaStack API v${version_1.APP_VERSION} listening on port ${PORT}`);
    logger_1.default.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM signal received: closing HTTP server');
    // Stop all workers
    SystemController_1.workerRegistry.getAll().forEach(w => SystemController_1.workerRegistry.stop(w.id));
    server.close(() => {
        logger_1.default.info('HTTP server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT signal received: closing HTTP server');
    // Stop all workers
    SystemController_1.workerRegistry.getAll().forEach(w => SystemController_1.workerRegistry.stop(w.id));
    server.close(() => {
        logger_1.default.info('HTTP server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map