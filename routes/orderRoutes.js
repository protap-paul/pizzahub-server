import express from "express";
import {
    createOrder,
    getVendorOrders,
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

export default router;