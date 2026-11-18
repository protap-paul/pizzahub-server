import express from "express";
import { getMenuItems, createMenuItem, } from "../controllers/menuItemController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

router.get("/", getMenuItems);

// Create menu item (Vendor only)
router.post(
    "/",
    requireAuth,
    authorizeRoles("vendor"),
    createMenuItem
);

export default router;