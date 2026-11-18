
import { getDB } from "../config/db.js";

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
