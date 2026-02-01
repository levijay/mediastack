import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/auth';
import db from '../config/database';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// Check if auth is disabled via environment variable
const isAuthDisabled = process.env.AUTH_DISABLED === 'true';

// Default user when auth is disabled
const defaultUser: JWTPayload = {
  userId: '1',
  username: 'admin',
  role: 'admin'
};

// Ensure admin user exists in database when auth is disabled
let adminUserEnsured = false;
function ensureAdminUser() {
  if (adminUserEnsured || !isAuthDisabled) return;
  
  try {
    // Check if users table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (tableExists) {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('1', 'admin', 'admin@localhost', 'auth-disabled', 'admin', 1);
      adminUserEnsured = true;
    }
  } catch (error) {
    console.error('Error ensuring admin user:', error);
  }
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
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
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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

export function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  // If auth is disabled, allow all requests with default admin user
  if (isAuthDisabled) {
    ensureAdminUser();
    req.user = defaultUser;
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const user = db.prepare('SELECT id, username, role FROM users WHERE api_key = ? AND is_active = 1').get(apiKey);
    
    if (!user) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    req.user = {
      userId: (user as any).id,
      username: (user as any).username,
      role: (user as any).role
    };
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Export auth status for frontend
export function isAuthenticationDisabled(): boolean {
  return isAuthDisabled;
}
