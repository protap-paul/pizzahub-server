import express from "express";
import {
    createOrder,
    getVendorOrders,
    updateVendorOrderStatus,
    getMyOrders,
    cancelMyOrder,
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

export default router;