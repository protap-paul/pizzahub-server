import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Customer create a new order
export const createOrder = async (req, res) => {
    try {
        const db = getDB();

        const {
            itemId,
            deliveryDate,
            deliveryAddress,
            message,
        } = req.body;

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
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("orders").insertOne(newOrder);

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
        const limit = Math.min(
            50,
            Math.max(1, Number(req.query.limit) || 10)
        );

        const skip = (page - 1) * limit;

        // Only retrieve orders belonging to this vendor
        const query = {
            vendorId: req.user.id,
        };

        const totalOrders = await db
            .collection("orders")
            .countDocuments(query);

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