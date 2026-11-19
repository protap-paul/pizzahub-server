import express from "express";
import {
    createOrder,
    getVendorOrders,
    updateVendorOrderStatus,
    getMyOrders,
    cancelMyOrder,
    getAllOrders,
    adminDeleteOrder,
} from "../controllers/orderController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Customer create a new order
router.post(
    "/",
    requireAuth,
    authorizeRoles("customer"),
    createOrder
);

router.get(
    "/vendor",
    requireAuth,
    authorizeRoles("vendor"),
    getVendorOrders
);

// Customer: Get my orders
router.get(
    "/my-orders",
    requireAuth,
    authorizeRoles("customer"),
    getMyOrders
);

// Admin: Get all customer orders
router.get(
    "/admin/all",
    requireAuth,
    authorizeRoles("admin"),
    getAllOrders
);

router.patch(
    "/vendor/:id/status",
    requireAuth,
    authorizeRoles("vendor"),
    updateVendorOrderStatus
);

// Customer: Cancel my pending order
router.patch(
    "/my-orders/:id/cancel",
    requireAuth,
    authorizeRoles("customer"),
    cancelMyOrder
);

// Admin: Delete any order
router.delete(
    "/admin/:id",
    requireAuth,
    authorizeRoles("admin"),
    adminDeleteOrder
);

export default router;