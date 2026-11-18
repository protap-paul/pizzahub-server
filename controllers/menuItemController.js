
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// Escape special regex characters
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Get all approved and active menu items
export const getMenuItems = async (req, res) => {
    try {
        const db = getDB();

        const {
            search = "",
            category,
            location,
            sort = "newest",
            limit = "12",
            page = "1",
        } = req.query;

        // Validate pagination
        const parsedLimit = Number(limit);
        const parsedPage = Number(page);

        if (
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100 ||
            !Number.isInteger(parsedPage) ||
            parsedPage < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters",
            });
        }

        // Only allow predefined sorting options
        const sortOptions = {
            newest: { createdAt: -1 },
            price_asc: { price: 1 },
            price_desc: { price: -1 },
        };

        if (!sortOptions[sort]) {
            return res.status(400).json({
                success: false,
                message: "Invalid sorting option",
            });
        }

        // Build MongoDB query
        const query = {
            status: "approved",
            isAvailable: true,
        };

        if (search.trim()) {
            query.itemName = {
                $regex: escapeRegex(search.trim()),
                $options: "i",
            };
        }

        if (category) {
            query.category = category;
        }

        if (location) {
            query.location = {
                $regex: escapeRegex(location.trim()),
                $options: "i",
            };
        }

        const collection = db.collection("menuItems");

        const totalItems = await collection.countDocuments(query);

        const menuItems = await collection
            .find(query)
            .sort(sortOptions[sort])
            .skip((parsedPage - 1) * parsedLimit)
            .limit(parsedLimit)
            .toArray();

        res.status(200).json({
            success: true,
            message: "Menu items fetched successfully",
            data: menuItems,
            pagination: {
                totalItems,
                currentPage: parsedPage,
                totalPages: Math.ceil(totalItems / parsedLimit),
                limit: parsedLimit,
            },
        });
    } catch (error) {
        console.error("Get menu items error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch menu items",
        });
    }
};

export const createMenuItem = async (req, res) => {
    try {
        const db = getDB();

        const {
            itemName,
            category,
            description,
            price,
            location,
            images,
        } = req.body;

        // Required field validation
        if (
            !itemName?.trim() ||
            !category ||
            !description?.trim() ||
            price === undefined ||
            !location?.trim() ||
            !Array.isArray(images) ||
            images.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "All menu item fields are required.",
            });
        }

        // Price validation
        const itemPrice = Number(price);

        if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a valid positive number.",
            });
        }

        // Category validation
        const allowedCategories = [
            "Classic",
            "Vegetarian",
            "Meat Lovers",
            "Specialty/Gourmet",
            "Sides/Appetizers",
            "Beverages/Desserts",
        ];

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item category.",
            });
        }

        // Image validation
        const validImages = images.every(
            (image) =>
                typeof image === "string" &&
                /^https?:\/\/.+/i.test(image)
        );

        if (!validImages) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid image URLs.",
            });
        }

        // Get vendor information
        const vendor = await db.collection("user").findOne(
            {
                _id: new ObjectId(req.user.id),
            },
            {
                projection: {
                    subscriptionPlan: 1,
                },
            }
        );

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor account not found.",
            });
        }

        // Free vendor item limit
        if (vendor.subscriptionPlan !== "premium") {
            const activeItemCount = await db.collection("menuItems").countDocuments({
                vendorId: req.user.id,
                status: { $in: ["pending", "approved"] },
            });

            if (activeItemCount >= 3) {
                return res.status(403).json({
                    success: false,
                    message: "Free vendors can have a maximum of 3 active menu items. Upgrade to Premium for unlimited items.",
                });
            }
        }

        const newMenuItem = {
            vendorId: req.user.id,
            itemName: itemName.trim(),
            category,
            description: description.trim(),
            price: itemPrice,
            location: location.trim(),
            images,
            status: "pending",
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("menuItems").insertOne(newMenuItem);

        return res.status(201).json({
            success: true,
            message: "Menu item submitted for admin approval.",
            menuItem: {
                _id: result.insertedId,
                ...newMenuItem,
            },
        });
    } catch (error) {
        console.error("Create Menu Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create menu item.",
        });
    }
};