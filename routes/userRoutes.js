
import express from "express";
import {
    getMyProfile,
    updateMyProfile,
    getAllUsers,
} from "../controllers/userController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Get logged-in user's profile
router.get("/me", requireAuth, getMyProfile);

// Admin get all users
router.get(
    "/admin/all",
    requireAuth,
    authorizeRoles("admin"),
    getAllUsers
);

// Update logged-in user's profile
router.patch("/me", requireAuth, updateMyProfile);

export default router;
