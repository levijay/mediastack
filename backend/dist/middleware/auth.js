"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.authenticateApiKey = authenticateApiKey;
exports.isAuthenticationDisabled = isAuthenticationDisabled;
const auth_1 = require("../utils/auth");
const database_1 = __importDefault(require("../config/database"));
// Check if auth is disabled via environment variable
const isAuthDisabled = process.env.AUTH_DISABLED === 'true';
// Default user when auth is disabled
const defaultUser = {
    userId: '1',
    username: 'admin',
    role: 'admin'
};
// Ensure admin user exists in database when auth is disabled
let adminUserEnsured = false;
function ensureAdminUser() {
    if (adminUserEnsured || !isAuthDisabled)
        return;
    try {
        // Check if users table exists
        const tableExists = database_1.default.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        if (tableExists) {
            database_1.default.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('1', 'admin', 'admin@localhost', 'auth-disabled', 'admin', 1);
            adminUserEnsured = true;
        }
    }
    catch (error) {
        console.error('Error ensuring admin user:', error);
    }
}
function authenticateToken(req, res, next) {
    // If auth is disabled, allow all requests with default admin user
    if (isAuthDisabled) {
        ensureAdminUser(); // Ensure user exists before proceeding
        req.user = defaultUser;
        return next();
    }
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    // Also check query string for SSE endpoints (EventSource doesn't support headers)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const payload = (0, auth_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}
function requireRole(roles) {
    return (req, res, next) => {
        // If auth is disabled, allow all requests
        if (isAuthDisabled) {
            ensureAdminUser();
            req.user = defaultUser;
            return next();
        }
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
function authenticateApiKey(req, res, next) {
    // If auth is disabled, allow all requests with default admin user
    if (isAuthDisabled) {
        ensureAdminUser();
        req.user = defaultUser;
        return next();
    }
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    try {
        const user = database_1.default.prepare('SELECT id, username, role FROM users WHERE api_key = ? AND is_active = 1').get(apiKey);
        if (!user) {
            return res.status(403).json({ error: 'Invalid API key' });
        }
        req.user = {
            userId: user.id,
            username: user.username,
            role: user.role
        };
        next();
    }
    catch (error) {
        return res.status(500).json({ error: 'Authentication error' });
    }
}
// Export auth status for frontend
function isAuthenticationDisabled() {
    return isAuthDisabled;
}
//# sourceMappingURL=auth.js.map