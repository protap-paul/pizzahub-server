import express from "express";
import {
    getMenuItems,
    createMenuItem,
    getMyMenuItems,
    updateMyMenuItem,
    deleteMyMenuItem,
    getAllMenuItems,
    updateMenuItemApproval,
    updateMenuItemAvailability,
    updateMyMenuItemAvailability,
    adminDeleteMenuItem,
    addMenuItemReview,
    getMenuItemReviews,
    getMenuItemById,
} from "../controllers/menuItemController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import uploadImage from "../middleware/uploadImage.js";
import { uploadMenuItemImage } from "../controllers/imageUploadController.js";

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

router.get("/:id", requireAuth, getMenuItemById);

router.get(
    "/:itemId/reviews",
    getMenuItemReviews
);

// Create menu item (Vendor only)
router.post(
    "/",
    requireAuth,
    authorizeRoles("vendor"),
    createMenuItem
);

// Review for item
router.post(
    "/:itemId/reviews",
    requireAuth,
    authorizeRoles("customer"),
    addMenuItemReview
);

// Upload menu item image (Vendor only)
router.post(
    "/upload-image",
    requireAuth,
    authorizeRoles("vendor"),
    uploadImage.single("image"),
    uploadMenuItemImage
);

router.patch(
    "/:id",
    requireAuth,
    authorizeRoles("vendor"),
    updateMyMenuItem
);

// Vendor update own menu item availability
router.patch(
    "/my-items/:id/availability",
    requireAuth,
    authorizeRoles("vendor"),
    updateMyMenuItemAvailability
);

router.patch(
    "/admin/:id/approval",
    requireAuth,
    authorizeRoles("admin"),
    updateMenuItemApproval
);

router.patch(
    "/admin/:id/availability",
    requireAuth,
    authorizeRoles("admin"),
    updateMenuItemAvailability
);

router.delete(
    "/:id",
    requireAuth,
    authorizeRoles("vendor"),
    deleteMyMenuItem
);

// Admin delete any menu item
router.delete(
    "/admin/:id",
    requireAuth,
    authorizeRoles("admin"),
    adminDeleteMenuItem
);

export default router;