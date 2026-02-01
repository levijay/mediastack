import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken, isAuthenticationDisabled } from '../middleware/auth';

const router = Router();

// Public endpoint to check if auth is disabled
router.get('/status', (req, res) => {
  res.json({ 
    authDisabled: isAuthenticationDisabled(),
    message: isAuthenticationDisabled() ? 'Authentication is disabled' : 'Authentication is enabled'
  });
});

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.get('/me', authenticateToken, AuthController.me);
router.post('/api-key', authenticateToken, AuthController.generateApiKey);

export default router;
