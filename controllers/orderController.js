import { sendEmail } from "../utils/sendEmail.js";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Escape HTML characters for safe email templates
const escapeHTML = (value = "") => {
    return String(value).replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[char];
    });
};

// Customer create a new order
export const createOrder = async (req, res) => {
    try {
        const db = getDB();

        const { itemId, deliveryDate, deliveryAddress, message } = req.body;

        // Validate required fields
        if (
            !itemId ||
            !deliveryDate ||
            typeof deliveryAddress !== "string" ||
            !deliveryAddress.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required order information.",
            });
        }

        // Validate menu item ID
        if (!ObjectId.isValid(itemId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        // Validate delivery date
        const parsedDeliveryDate = new Date(deliveryDate);

        if (
            Number.isNaN(parsedDeliveryDate.getTime()) ||
            parsedDeliveryDate.getTime() <= Date.now()
        ) {
            return res.status(400).json({
                success: false,
                message: "Delivery date must be in the future.",
            });
        }

        // Find approved and available menu item
        const menuItem = await db.collection("menuItems").findOne({
            _id: new ObjectId(itemId),
            status: "approved",
            isAvailable: true,
        });

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found or currently unavailable.",
            });
        }

        // Prevent vendor from ordering own item
        if (menuItem.vendorId === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You cannot order your own menu item.",
            });
        }

        // Prevent duplicate active orders
        const existingOrder = await db.collection("orders").findOne({
            itemId: new ObjectId(itemId),
            customerId: req.user.id,
            deliveryDate: parsedDeliveryDate,
            status: { $in: ["pending", "accepted"] },
        });

        if (existingOrder) {
            return res.status(409).json({
                success: false,
                message: "You already have an active order for this item and date.",
            });
        }

        // Create order
        const newOrder = {
            itemId: new ObjectId(itemId),
            vendorId: menuItem.vendorId,
            customerId: req.user.id,
            deliveryDate: parsedDeliveryDate,
            deliveryAddress: deliveryAddress.trim(),
            message: typeof message === "string" ? message.trim() : "",
            status: "pending",

            // Order Status History
            statusHistory: [
                {
                    status: "pending",
                    changedAt: new Date(),
                    changedBy: req.user.id,
                    note: "Order placed successfully.",
                },
            ],

            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("orders").insertOne(newOrder);

        // Send order notification to vendor
        try {
            // Get vendor and customer information
            const [vendor, customer] = await Promise.all([
                db
                    .collection("user")
                    .findOne(
                        { _id: new ObjectId(menuItem.vendorId) },
                        { projection: { name: 1, email: 1 } },
                    ),
                db
                    .collection("user")
                    .findOne(
                        { _id: new ObjectId(req.user.id) },
                        { projection: { name: 1, email: 1 } },
                    ),
            ]);

            if (vendor?.email) {
                await sendEmail({
                    to: vendor.email,
                    subject: "New Pizza Order - PizzaHub",
                    html: `
                <h2>You have received a new order!</h2>
                <p>Hello ${escapeHTML(vendor.name || "Vendor")},</p>
                <p>A customer has placed a new order for your menu item.</p>
                <p><strong>Pizza:</strong> ${escapeHTML(menuItem.itemName)}</p>
                <p><strong>Customer:</strong> ${escapeHTML(customer?.name || "Customer")}</p>
                <p><strong>Delivery Date:</strong> ${escapeHTML(parsedDeliveryDate.toLocaleString())}</p>
                <p><strong>Delivery Address:</strong> ${escapeHTML(newOrder.deliveryAddress)}</p>
                <p><strong>Message:</strong> ${escapeHTML(newOrder.message || "No additional message")}</p>
                <p><strong>Order Status:</strong> Pending</p>
                <p>Please log in to PizzaHub to manage this order.</p>
            `,
                });
            }
        } catch (emailError) {
            console.error("Order notification failed:", emailError);
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            orderId: result.insertedId,
            order: newOrder,
        });
    } catch (error) {
        console.error("Create Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to place order.",
        });
    }
};

// Vendor: Get all orders received for their menu items
export const getVendorOrders = async (req, res) => {
    try {
        const db = getDB();

        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

        const skip = (page - 1) * limit;

        // Only retrieve orders belonging to this vendor
        const query = {
            vendorId: req.user.id,
        };

        const totalOrders = await db.collection("orders").countDocuments(query);

        const orders = await db
            .collection("orders")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Vendor orders retrieved successfully.",
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                limit,
            },
            orders,
        });
    } catch (error) {
        console.error("Get Vendor Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve vendor orders.",
        });
    }
};

// Vendor: Accept or reject a customer order
export const updateVendorOrderStatus = async (req, res) => {
    try {
        const db = getDB();

        const { id } = req.params;
        const { status } = req.body;

        // Validate order ID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID.",
            });
        }

        // Validate status
        if (!["accepted", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be accepted or rejected.",
            });
        }

        // Update only vendor's own pending order
        const result = await db.collection("orders").updateOne(
            {
                _id: new ObjectId(id),
                vendorId: req.user.id,
                status: "pending",
            },
            {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
                $push: {
                    statusHistory: {
                        status,
                        changedAt: new Date(),
                        changedBy: req.user.id,
                        note: `Order ${status} by vendor.`,
                    },
                },
            },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Pending order not found or already processed.",
            });
        }

        // Get updated order information
        const order = await db.collection("orders").findOne({
            _id: new ObjectId(id),
        });

        // Send order status notification to customer
        try {
            // Get updated order information
            const order = await db.collection("orders").findOne({
                _id: new ObjectId(id),
            });

            if (order) {
                // Get customer and menu item information
                const [customer, menuItem] = await Promise.all([
                    db
                        .collection("user")
                        .findOne(
                            { _id: new ObjectId(order.customerId) },
                            { projection: { name: 1, email: 1 } },
                        ),
                    db
                        .collection("menuItems")
                        .findOne(
                            { _id: order.itemId },
                            { projection: { itemName: 1, price: 1 } },
                        ),
                ]);

                if (customer?.email) {
                    const isAccepted = status === "accepted";

                    await sendEmail({
                        to: customer.email,
                        subject: isAccepted
                            ? "Your Pizza Order Has Been Accepted! 🍕"
                            : "Your Pizza Order Has Been Rejected",
                        html: `
                    <h2>
                        ${isAccepted
                                ? "Great News! Your Order Has Been Accepted."
                                : "Sorry! Your Order Has Been Rejected."}
                    </h2>

                    <p>Hello ${escapeHTML(customer.name || "Customer")},</p>

                    <p>
                        Your order for
                        <strong>${escapeHTML(menuItem?.itemName || "Pizza")}</strong>
                        has been ${escapeHTML(status)}.
                    </p>

                    <p><strong>Order ID:</strong> ${escapeHTML(id)}</p>
                    <p><strong>Price:</strong> ${escapeHTML(menuItem?.price ?? "N/A")}</p>
                    <p><strong>Delivery Date:</strong> ${escapeHTML(new Date(order.deliveryDate).toLocaleString())}</p>
                    <p><strong>Delivery Address:</strong> ${escapeHTML(order.deliveryAddress)}</p>
                    <p><strong>Current Status:</strong> ${escapeHTML(status.toUpperCase())}</p>

                    <p>Thank you for choosing PizzaHub!</p>
                `,
                    });
                }
            }
        } catch (emailError) {
            console.error("Order status notification failed:", emailError);
        }

        return res.status(200).json({
            success: true,
            message: `Order ${status} successfully.`,
        });
    } catch (error) {
        console.error("Update Vendor Order Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order status.",
        });
    }
};

// Customer: Get all orders placed by the logged-in customer
export const getMyOrders = async (req, res) => {
    try {
        const db = getDB();

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

        const skip = (page - 1) * limit;

        // Only retrieve the logged-in customer's orders
        const query = {
            customerId: req.user.id,
        };

        const totalOrders = await db.collection("orders").countDocuments(query);

        const orders = await db
            .collection("orders")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Your orders retrieved successfully.",
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                limit,
            },
            orders,
        });
    } catch (error) {
        console.error("Get My Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve your orders.",
        });
    }
};

// Customer: Cancel their own pending order
export const cancelMyOrder = async (req, res) => {
    try {
        const db = getDB();

        const { id } = req.params;

        // Validate order ID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID.",
            });
        }

        // Cancel only the customer's own pending order
        const result = await db.collection("orders").updateOne(
            {
                _id: new ObjectId(id),
                customerId: req.user.id,
                status: "pending",
            },
            {
                $set: {
                    status: "cancelled",
                    updatedAt: new Date(),
                },
                $push: {
                    statusHistory: {
                        status: "cancelled",
                        changedAt: new Date(),
                        changedBy: req.user.id,
                        note: "Order cancelled by customer.",
                    },
                },
            },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Pending order not found or cannot be cancelled.",
            });
        }

        // Send cancellation notification to vendor
        try {
            // Get cancelled order information
            const order = await db.collection("orders").findOne({
                _id: new ObjectId(id),
            });

            if (order) {
                // Get vendor and customer information
                const [vendor, customer, menuItem] = await Promise.all([
                    db
                        .collection("user")
                        .findOne(
                            { _id: new ObjectId(order.vendorId) },
                            { projection: { name: 1, email: 1 } },
                        ),
                    db
                        .collection("user")
                        .findOne(
                            { _id: new ObjectId(order.customerId) },
                            { projection: { name: 1 } },
                        ),
                    db
                        .collection("menuItems")
                        .findOne(
                            { _id: new ObjectId(order.itemId) },
                            { projection: { itemName: 1, price: 1 } },
                        ),
                ]);

                // Send email to vendor
                if (vendor?.email) {
                    await sendEmail({
                        to: vendor.email,
                        subject: "Pizza Order Cancelled - PizzaHub",
                        html: `
    <h2>Order Cancellation Notification</h2>

    <p>Hello ${escapeHTML(vendor.name || "Vendor")},</p>

    <p>A customer has cancelled their order.</p>

    <p><strong>Pizza:</strong> ${escapeHTML(menuItem?.itemName || "Pizza")}</p>
    <p><strong>Customer:</strong> ${escapeHTML(customer?.name || "Customer")}</p>
    <p><strong>Order ID:</strong> ${escapeHTML(id)}</p>
    <p><strong>Price:</strong> ${escapeHTML(menuItem?.price ?? "N/A")}</p>
    <p><strong>Delivery Date:</strong> ${escapeHTML(new Date(order.deliveryDate).toLocaleString())}</p>
    <p><strong>Delivery Address:</strong> ${escapeHTML(order.deliveryAddress)}</p>
    <p><strong>Status:</strong> CANCELLED</p>

    <p>Please log in to PizzaHub to view your updated orders.</p>
`,
                    });
                }
            }
        } catch (emailError) {
            console.error("Vendor Cancellation Email Error:", emailError);
        }

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully.",
        });
    } catch (error) {
        console.error("Cancel My Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel your order.",
        });
    }
};

// Admin: Get all customer orders
export const getAllOrders = async (req, res) => {
    try {
        const db = getDB();

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

        const skip = (page - 1) * limit;

        const { status } = req.query;

        const query = {};

        // Filter orders by status
        const allowedStatuses = ["pending", "accepted", "rejected", "cancelled"];

        if (status && allowedStatuses.includes(status)) {
            query.status = status;
        }

        const totalOrders = await db.collection("orders").countDocuments(query);

        const orders = await db
            .collection("orders")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All orders retrieved successfully.",
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                limit,
            },
            orders,
        });
    } catch (error) {
        console.error("Get All Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve all orders.",
        });
    }
};

// Admin: Delete any order
export const adminDeleteOrder = async (req, res) => {
    try {
        const db = getDB();

        const { id } = req.params;

        // Validate order ID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID.",
            });
        }

        // Delete order
        const result = await db.collection("orders").deleteOne({
            _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully.",
        });
    } catch (error) {
        console.error("Admin Delete Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete order.",
        });
    }
};
