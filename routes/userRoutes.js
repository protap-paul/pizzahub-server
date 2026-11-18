
import express from "express";
import { getMyProfile, updateMyProfile, } from "../controllers/userController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Get logged-in user's profile
router.get("/me", requireAuth, getMyProfile);

// Update logged-in user's profile
router.patch("/me", requireAuth, updateMyProfile);

export default router;
