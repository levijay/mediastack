import { Router } from 'express';
import { MediaManagementController } from '../controllers/MediaManagementController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Quality Definitions
router.get('/quality/definitions', authenticateToken, MediaManagementController.getQualityDefinitions);

// Quality Profiles
router.get('/quality/profiles', authenticateToken, MediaManagementController.getQualityProfiles);
router.get('/quality/profiles/:id', authenticateToken, MediaManagementController.getQualityProfile);
router.post('/quality/profiles', authenticateToken, MediaManagementController.createQualityProfile);
router.put('/quality/profiles/:id', authenticateToken, MediaManagementController.updateQualityProfile);
router.delete('/quality/profiles/:id', authenticateToken, MediaManagementController.deleteQualityProfile);

// Naming Configuration
router.get('/naming', authenticateToken, MediaManagementController.getNamingConfig);
router.put('/naming', authenticateToken, MediaManagementController.updateNamingConfig);
router.get('/naming/tokens', authenticateToken, MediaManagementController.getNamingTokens);
router.post('/naming/preview', authenticateToken, MediaManagementController.previewNaming);

// File Management Settings
router.get('/file-management', authenticateToken, MediaManagementController.getFileManagementSettings);
router.put('/file-management', authenticateToken, MediaManagementController.updateFileManagementSettings);

export default router;
