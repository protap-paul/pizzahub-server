import express from "express";
import {
    getMenuItems,
    createMenuItem,
    getMyMenuItems,
    updateMyMenuItem,
    deleteMyMenuItem,
} from "../controllers/menuItemController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

router.get("/", getMenuItems);

router.get(
    "/my-items",
    requireAuth,
    authorizeRoles("vendor"),
    getMyMenuItems
);

// Create menu item (Vendor only)
router.post(
    "/",
    requireAuth,
    authorizeRoles("vendor"),
    createMenuItem
);

router.patch(
    "/:id",
    requireAuth,
    authorizeRoles("vendor"),
    updateMyMenuItem
);

router.delete(
    "/:id",
    requireAuth,
    authorizeRoles("vendor"),
    deleteMyMenuItem
);

export default router;