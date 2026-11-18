import express from "express";
import {
    getMenuItems,
    createMenuItem,
    getMyMenuItems,
    updateMyMenuItem,
    deleteMyMenuItem,
    getAllMenuItems,
    updateMenuItemApproval,
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

router.get(
    "/admin/all",
    requireAuth,
    authorizeRoles("admin"),
    getAllMenuItems
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

router.patch(
    "/admin/:id/approval",
    requireAuth,
    authorizeRoles("admin"),
    updateMenuItemApproval
);

router.delete(
    "/:id",
    requireAuth,
    authorizeRoles("vendor"),
    deleteMyMenuItem
);

export default router;