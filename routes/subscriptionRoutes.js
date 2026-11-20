
import express from "express";
import {
    createCheckoutSession,
    cancelPremiumSubscription,
} from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Create Premium Subscription Checkout Session
router.post(
    "/create-checkout-session",
    requireAuth,
    authorizeRoles("vendor"),
    createCheckoutSession
);

// Vendor: Cancel Premium Subscription
router.patch(
    "/cancel",
    requireAuth,
    authorizeRoles("vendor"),
    cancelPremiumSubscription
);

export default router;
