
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { stripe } from "../config/stripe.js";

// Update Vendor Subscription
const updateVendorSubscription = async (subscription, plan) => {
    const vendorId = subscription.metadata?.vendorId;

    if (
        typeof vendorId !== "string" ||
        !ObjectId.isValid(vendorId) ||
        new ObjectId(vendorId).toString() !== vendorId
    ) {
        throw new Error("Invalid vendor ID in subscription metadata.");
    }

    const db = getDB();

    const updateData = {
        subscriptionPlan: plan,
        stripeSubscriptionId:
            plan === "premium" ? subscription.id : null,
        subscriptionCancelAtPeriodEnd:
            plan === "premium"
                ? subscription.cancel_at_period_end
                : false,
        updatedAt: new Date(),
    };

    if (plan === "premium") {
        const periodEnd =
            subscription.items?.data?.[0]?.current_period_end;

        if (!periodEnd) {
            throw new Error("Subscription expiry date not found.");
        }

        updateData.subscriptionExpiresAt =
            new Date(periodEnd * 1000);
    } else {
        updateData.subscriptionExpiresAt = null;
    }

    // Match authenticated vendor
    const filter = {
        _id: new ObjectId(vendorId),
        role: "vendor",
    };

    // Only cancel the subscription that is currently active in our database
    if (plan === "free") {
        filter.stripeSubscriptionId = subscription.id;
    } else {
        filter.$or = [
            { stripeSubscriptionId: subscription.id },
            { stripeSubscriptionId: { $exists: false } },
            { stripeSubscriptionId: null },
        ];
    }

    const result = await db.collection("user").updateOne(
        filter,
        {
            $set: updateData,
        }
    );

    if (result.matchedCount === 0) {
        const vendorExists = await db.collection("user").findOne(
            {
                _id: new ObjectId(vendorId),
                role: "vendor",
            },
            { projection: { _id: 1 } }
        );

        if (!vendorExists) {
            throw new Error("Vendor account not found.");
        }

        console.log(
            `Ignoring outdated subscription event: ${subscription.id}`
        );

        return;
    }

    console.log(
        `Vendor subscription updated: ${vendorId} -> ${plan}`
    );
};

// Stripe Webhook Handler
export const handleStripeWebhook = async (req, res) => {
    let event;

    // Verify Stripe webhook signature
    try {
        const signature = req.headers["stripe-signature"];

        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error("Stripe Webhook Signature Error:", error.message);

        return res.status(400).send(
            `Webhook Error: ${error.message}`
        );
    }

    try {
        const db = getDB();

        // 1. Successful Checkout
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;

            if (session.mode !== "subscription") {
                return res.status(200).json({ received: true });
            }

            const subscriptionId = session.subscription;

            if (!subscriptionId) {
                throw new Error("Subscription ID not found.");
            }

            const subscription =
                await stripe.subscriptions.retrieve(subscriptionId);

            if (["active", "trialing"].includes(subscription.status)) {
                await updateVendorSubscription(subscription, "premium");

                await db.collection("transactions").updateOne(
                    { stripeSessionId: session.id },
                    {
                        $setOnInsert: {
                            vendorId: subscription.metadata.vendorId,
                            plan: "premium",
                            amount: (session.amount_total || 0) / 100,
                            currency: session.currency,
                            stripeSessionId: session.id,
                            stripeSubscriptionId: subscriptionId,
                            status: "completed",
                            createdAt: new Date(),
                        },
                    },
                    { upsert: true }
                );
            }
        }

        // 2. Subscription Updated / Renewed
        if (event.type === "customer.subscription.updated") {
            const eventSubscription = event.data.object;

            // Fetch the latest subscription status from Stripe
            const subscription = await stripe.subscriptions.retrieve(
                eventSubscription.id
            );

            if (["active", "trialing"].includes(subscription.status)) {
                await updateVendorSubscription(subscription, "premium");
            } else if (
                ["canceled", "unpaid", "incomplete_expired"].includes(
                    subscription.status
                )
            ) {
                await updateVendorSubscription(subscription, "free");
            }

            // Keep the current plan unchanged for past_due status.
        }

        // 3. Subscription Deleted / Ended
        if (event.type === "customer.subscription.deleted") {
            const subscription = event.data.object;

            await updateVendorSubscription(subscription, "free");
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error("Stripe Webhook Processing Error:", error);

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed.",
        });
    }
};
