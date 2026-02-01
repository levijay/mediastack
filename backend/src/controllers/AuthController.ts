import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { comparePassword, generateToken, generateApiKey } from '../utils/auth';
import { AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const user = UserModel.findByUsername(username);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      logger.info(`User logged in: ${username}`);

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password required' });
      }

      // Only allow registration if no users exist yet
      const userCount = UserModel.count();
      if (userCount > 0) {
        return res.status(403).json({ error: 'Registration is disabled. Only one account is allowed.' });
      }

      // First user is admin
      const role = 'admin';

      // Check if username or email already exists (shouldn't happen but be safe)
      if (UserModel.findByUsername(username)) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      if (UserModel.findByEmail(email)) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      const user = await UserModel.create({
        username,
        email,
        password,
        role
      });

      logger.info(`Admin user registered: ${username}`);

      const token = generateToken({
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
    } catch (error) {
      logger.error('Registration error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async me(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = UserModel.findById(req.user.userId);
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
    } catch (error) {
      logger.error('Get user error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async generateApiKey(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const apiKey = generateApiKey();
      UserModel.update(req.user.userId, { api_key: apiKey });

      logger.info(`API key generated for user: ${req.user.username}`);

      return res.json({ api_key: apiKey });
    } catch (error) {
      logger.error('Generate API key error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
