import express from "express";
import {
    getAdminDashboardStats,
    getVendorDashboardStats,
} from "../controllers/dashboardController.js";
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

// Vendor Dashboard Statistics
router.get(
    "/vendor",
    requireAuth,
    authorizeRoles("vendor"),
    getVendorDashboardStats
);

export default router;