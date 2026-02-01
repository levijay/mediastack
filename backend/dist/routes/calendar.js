"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CalendarController_1 = require("../controllers/CalendarController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/upcoming', CalendarController_1.CalendarController.getUpcoming);
router.get('/missing', CalendarController_1.CalendarController.getMissing);
exports.default = router;
//# sourceMappingURL=calendar.js.map