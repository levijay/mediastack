"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const User_1 = require("../models/User");
const auth_1 = require("../utils/auth");
const logger_1 = __importDefault(require("../config/logger"));
class AuthController {
    static async login(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            const user = User_1.UserModel.findByUsername(username);
            if (!user || !user.is_active) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const isValid = await (0, auth_1.comparePassword)(password, user.password_hash);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = (0, auth_1.generateToken)({
                userId: user.id,
                username: user.username,
                role: user.role
            });
            logger_1.default.info(`User logged in: ${username}`);
            return res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        }
        catch (error) {
            logger_1.default.error('Login error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async register(req, res) {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password required' });
            }
            // Only allow registration if no users exist yet
            const userCount = User_1.UserModel.count();
            if (userCount > 0) {
                return res.status(403).json({ error: 'Registration is disabled. Only one account is allowed.' });
            }
            // First user is admin
            const role = 'admin';
            // Check if username or email already exists (shouldn't happen but be safe)
            if (User_1.UserModel.findByUsername(username)) {
                return res.status(409).json({ error: 'Username already exists' });
            }
            if (User_1.UserModel.findByEmail(email)) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            const user = await User_1.UserModel.create({
                username,
                email,
                password,
                role
            });
            logger_1.default.info(`Admin user registered: ${username}`);
            const token = (0, auth_1.generateToken)({
                userId: user.id,
                username: user.username,
                role: user.role
            });
            return res.status(201).json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        }
        catch (error) {
            logger_1.default.error('Registration error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async me(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = User_1.UserModel.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                request_limit_movies: user.request_limit_movies,
                request_limit_tv: user.request_limit_tv
            });
        }
        catch (error) {
            logger_1.default.error('Get user error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async generateApiKey(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const apiKey = (0, auth_1.generateApiKey)();
            User_1.UserModel.update(req.user.userId, { api_key: apiKey });
            logger_1.default.info(`API key generated for user: ${req.user.username}`);
            return res.json({ api_key: apiKey });
        }
        catch (error) {
            logger_1.default.error('Generate API key error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=AuthController.js.map