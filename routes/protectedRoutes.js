
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Protected test route
router.get("/me", requireAuth, (req, res) => {
    res.status(200).json({
        success: true,
        message: "JWT Authentication Successful!",
        user: req.user,
    });
});

export default router;
