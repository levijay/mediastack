"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const system_1 = __importDefault(require("./routes/system"));
const search_1 = __importDefault(require("./routes/search"));
const settings_1 = __importDefault(require("./routes/settings"));
const automation_1 = __importDefault(require("./routes/automation"));
const library_1 = __importDefault(require("./routes/library"));
const calendar_1 = __importDefault(require("./routes/calendar"));
const scanner_1 = __importDefault(require("./routes/scanner"));
const mediaManagement_1 = __importDefault(require("./routes/mediaManagement"));
const customFormats_1 = __importDefault(require("./routes/customFormats"));
const images_1 = __importDefault(require("./routes/images"));
const arrImport_1 = __importDefault(require("./routes/arrImport"));
const reports_1 = __importDefault(require("./routes/reports"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const logger_1 = __importDefault(require("./config/logger"));
const app = (0, express_1.default)();
// CORS - allow everything
app.use((0, cors_1.default)());
// Body parsing - increased limit for backup/restore
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Request logging
app.use((req, res, next) => {
    logger_1.default.info(`${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/system', system_1.default);
app.use('/api/search', search_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/automation', automation_1.default);
app.use('/api/library', library_1.default);
app.use('/api/calendar', calendar_1.default);
app.use('/api/scanner', scanner_1.default);
app.use('/api/mediamanagement', mediaManagement_1.default);
app.use('/api/customformats', customFormats_1.default);
app.use('/api/images', images_1.default);
app.use('/api/arr', arrImport_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/notifications', notifications_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, req, res, next) => {
    logger_1.default.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.default = app;
//# sourceMappingURL=app.js.map