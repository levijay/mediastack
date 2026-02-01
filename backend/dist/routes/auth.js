"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("../controllers/AuthController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public endpoint to check if auth is disabled
router.get('/status', (req, res) => {
    res.json({
        authDisabled: (0, auth_1.isAuthenticationDisabled)(),
        message: (0, auth_1.isAuthenticationDisabled)() ? 'Authentication is disabled' : 'Authentication is enabled'
    });
});
router.post('/login', AuthController_1.AuthController.login);
router.post('/register', AuthController_1.AuthController.register);
router.get('/me', auth_1.authenticateToken, AuthController_1.AuthController.me);
router.post('/api-key', auth_1.authenticateToken, AuthController_1.AuthController.generateApiKey);
exports.default = router;
//# sourceMappingURL=auth.js.map