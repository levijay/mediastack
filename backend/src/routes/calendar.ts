import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/upcoming', CalendarController.getUpcoming);
router.get('/missing', CalendarController.getMissing);

export default router;
