
import express from "express";
import { getMyProfile } from "../controllers/userController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Get logged-in user's profile
router.get("/me", requireAuth, getMyProfile);

export default router;
