
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { stripe } from "../config/stripe.js";

// Create Stripe Checkout Session for Vendor Premium
export const createCheckoutSession = async (req, res) => {
    try {
        const db = getDB();

        // Find authenticated vendor
        const vendor = await db.collection("user").findOne({
            _id: new ObjectId(req.user.id),
            role: "vendor",
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor account not found.",
            });
        }

        // Check existing Premium subscription
        const isPremiumActive =
            vendor.subscriptionPlan === "premium" &&
            vendor.subscriptionExpiresAt &&
            new Date(vendor.subscriptionExpiresAt) > new Date();

        if (isPremiumActive) {
            return res.status(409).json({
                success: false,
                message: "You already have an active Premium subscription.",
            });
        }

        // Check Stripe Price ID
        const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;

        if (!priceId) {
            return res.status(500).json({
                success: false,
                message: "Premium subscription price is not configured.",
            });
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",

            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],

            customer_email: vendor.email,

            client_reference_id: req.user.id,

            metadata: {
                vendorId: req.user.id,
                plan: "premium",
            },

            subscription_data: {
                metadata: {
                    vendorId: req.user.id,
                    plan: "premium",
                },
            },

            success_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,

            cancel_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription?cancelled=true`,
        });

        return res.status(200).json({
            success: true,
            message: "Stripe Checkout Session created successfully.",
            url: session.url,
        });
    } catch (error) {
        console.error("Create Checkout Session Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create Stripe Checkout Session.",
        });
    }
};
