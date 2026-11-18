
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Protected test route
router.get("/me", requireAuth, (req, res) => {
    res.status(200).json({
        success: true,
        message: "JWT Authentication Successful!",
        user: req.user,
    });
});

// Vendor-only test route
router.get(
    "/vendor-only",
    requireAuth,
    authorizeRoles("vendor"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Vendor authorization successful!",
            user: req.user,
        });
    }
);

// Admin-only route
router.get(
    "/admin-only",
    requireAuth,
    authorizeRoles("admin"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Admin authorization successful!",
            user: req.user,
        });
    }
);

export default router;
