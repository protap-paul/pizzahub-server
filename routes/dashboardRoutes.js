import express from "express";
import { getAdminDashboardStats } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Admin Dashboard Statistics
router.get(
    "/admin",
    requireAuth,
    authorizeRoles("admin"),
    getAdminDashboardStats
);

export default router;