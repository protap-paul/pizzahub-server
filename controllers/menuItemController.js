
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return (
        typeof id === "string" &&
        ObjectId.isValid(id) &&
        new ObjectId(id).toString() === id
    );
};

// Escape special regex characters
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Validate pagination parameters
const getPagination = (query, defaultLimit = 10, maxLimit = 50) => {
    const { page = "1", limit = String(defaultLimit) } = query;

    if (
        typeof page !== "string" ||
        typeof limit !== "string"
    ) {
        return null;
    }

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1 ||
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > maxLimit
    ) {
        return null;
    }

    return {
        page: parsedPage,
        limit: parsedLimit,
        skip: (parsedPage - 1) * parsedLimit,
    };
};

// Allowed menu categories
const allowedCategories = [
    "Classic",
    "Vegetarian",
    "Meat Lovers",
    "Specialty/Gourmet",
    "Sides/Appetizers",
    "Beverages/Desserts",
];

// Validate image URLs
const areValidImages = (images) => {
    return (
        Array.isArray(images) &&
        images.length > 0 &&
        images.every((image) => {
            if (typeof image !== "string" || !image.trim()) {
                return false;
            }

            try {
                const url = new URL(image);

                return (
                    ["http:", "https:"].includes(url.protocol) &&
                    Boolean(url.hostname)
                );
            } catch {
                return false;
            }
        })
    );
};

// Get all approved and active menu items
export const getMenuItems = async (req, res) => {
    try {
        const {
            search = "",
            category,
            location,
            sort = "newest",
            limit = "12",
            page = "1",
        } = req.query;

        // Validate query parameter types
        if (
            typeof search !== "string" ||
            (category !== undefined && typeof category !== "string") ||
            (location !== undefined && typeof location !== "string") ||
            typeof sort !== "string" ||
            typeof limit !== "string" ||
            typeof page !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid query parameters.",
            });
        }

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
                message: "Invalid pagination parameters.",
            });
        }

        // Allowed sorting options
        const sortOptions = {
            newest: { createdAt: -1 },
            price_asc: { price: 1 },
            price_desc: { price: -1 },
        };

        if (!Object.hasOwn(sortOptions, sort)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sorting option.",
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
            query.category = category.trim();
        }

        if (location) {
            if (!location.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Location cannot be empty.",
                });
            }

            query.location = {
                $regex: escapeRegex(location.trim()),
                $options: "i",
            };
        }

        const db = getDB();
        const collection = db.collection("menuItems");

        // Total matching items
        const totalItems = await collection.countDocuments(query);

        // Premium vendor items appear first
        const menuItems = await collection.aggregate([
            {
                $match: query,
            },
            {
                $addFields: {
                    vendorObjectId: {
                        $convert: {
                            input: "$vendorId",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "user",
                    let: {
                        vendorId: "$vendorObjectId",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$vendorId"],
                                },
                            },
                        },
                        {
                            $project: {
                                name: 1,
                                image: 1,
                                businessName: 1,
                                subscriptionPlan: 1,
                            },
                        },
                    ],
                    as: "vendorInfo",
                },
            },
            {
                $addFields: {
                    vendor: {
                        $arrayElemAt: ["$vendorInfo", 0],
                    },
                    isFeatured: {
                        $eq: [
                            {
                                $ifNull: [
                                    {
                                        $arrayElemAt: [
                                            "$vendorInfo.subscriptionPlan",
                                            0,
                                        ],
                                    },
                                    "free",
                                ],
                            },
                            "premium",
                        ],
                    },
                },
            },
            {
                $sort: {
                    isFeatured: -1,
                    ...sortOptions[sort],
                },
            },
            {
                $skip: (parsedPage - 1) * parsedLimit,
            },
            {
                $limit: parsedLimit,
            },
            {
                $project: {
                    vendorObjectId: 0,
                    vendorInfo: 0,
                },
            },
        ]).toArray();

        return res.status(200).json({
            success: true,
            message: "Menu items fetched successfully.",
            data: menuItems,
            pagination: {
                totalItems,
                currentPage: parsedPage,
                totalPages: Math.ceil(totalItems / parsedLimit),
                limit: parsedLimit,
            },
        });
    } catch (error) {
        console.error("Get Menu Items Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch menu items.",
        });
    }
};

// Get Single Menu Item Details
export const getMenuItemById = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        const menuItem = await db.collection("menuItems").findOne({
            _id: new ObjectId(id),
            status: "approved",
            isAvailable: true,
        });

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found or unavailable.",
            });
        }

        const vendor = await db.collection("user").findOne(
            { _id: new ObjectId(menuItem.vendorId) },
            {
                projection: {
                    name: 1,
                    image: 1,
                    businessName: 1,
                    subscriptionPlan: 1,
                },
            }
        );

        return res.status(200).json({
            success: true,
            message: "Menu item retrieved successfully.",
            menuItem: {
                ...menuItem,
                vendor: vendor
                    ? {
                        name: vendor.name,
                        image: vendor.image,
                        businessName: vendor.businessName,
                        subscriptionPlan: vendor.subscriptionPlan || "free",
                        isPremium: vendor.subscriptionPlan === "premium",
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error("Get Menu Item Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve menu item details.",
        });
    }
};

// Create Menu Item (Vendor)
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

        // Required field and data type validation
        if (
            typeof itemName !== "string" ||
            !itemName.trim() ||
            itemName.trim().length > 100 ||

            typeof category !== "string" ||
            !allowedCategories.includes(category) ||

            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 2000 ||

            price === undefined ||
            price === null ||

            typeof location !== "string" ||
            !location.trim() ||
            location.trim().length > 200 ||

            !Array.isArray(images) ||
            images.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "All menu item fields must be valid and within the allowed limits.",
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

        // Image validation
        if (!areValidImages(images)) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid image URLs.",
            });
        }

        // Get vendor information
        const vendor = await db.collection("user").findOne(
            {
                _id: new ObjectId(req.user.id),
                role: "vendor",
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
                isAvailable: true,
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
            reviews: [],
            totalReviews: 0,
            averageRating: 0,
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

// Get logged-in vendor's menu items
export const getMyMenuItems = async (req, res) => {
    try {
        const pagination = getPagination(req.query, 10, 50);

        if (!pagination) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters.",
            });
        }

        const db = getDB();

        const query = {
            vendorId: req.user.id,
        };

        const totalItems = await db
            .collection("menuItems")
            .countDocuments(query);

        const menuItems = await db
            .collection("menuItems")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Your menu items retrieved successfully.",
            pagination: {
                currentPage: pagination.page,
                totalPages: Math.ceil(totalItems / pagination.limit),
                totalItems,
                limit: pagination.limit,
            },
            menuItems,
        });
    } catch (error) {
        console.error("Get My Menu Items Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve your menu items.",
        });
    }
};

// Update vendor's own menu item
export const updateMyMenuItem = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        const {
            itemName,
            category,
            description,
            price,
            location,
            images,
        } = req.body;

        const updateData = {};

        if (itemName !== undefined) {
            if (
                typeof itemName !== "string" ||
                !itemName.trim() ||
                itemName.trim().length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Item name must be valid and within 100 characters.",
                });
            }

            updateData.itemName = itemName.trim();
        }

        if (category !== undefined) {
            if (
                typeof category !== "string" ||
                !allowedCategories.includes(category)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid menu item category.",
                });
            }

            updateData.category = category;
        }

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                !description.trim() ||
                description.trim().length > 2000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Description must be valid and within 2000 characters.",
                });
            }

            updateData.description = description.trim();
        }

        if (price !== undefined) {
            const itemPrice = Number(price);

            if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a valid positive number.",
                });
            }

            updateData.price = itemPrice;
        }

        if (location !== undefined) {
            if (
                typeof location !== "string" ||
                !location.trim() ||
                location.trim().length > 200
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Location must be valid and within 200 characters.",
                });
            }

            updateData.location = location.trim();
        }

        if (images !== undefined) {
            if (!areValidImages(images)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide valid image URLs.",
                });
            }

            updateData.images = images;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one valid field to update.",
            });
        }

        updateData.updatedAt = new Date();

        const result = await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(id),
                vendorId: req.user.id,
            },
            {
                $set: updateData,
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found or you do not own this item.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item updated successfully.",
            updatedFields: updateData,
        });
    } catch (error) {
        console.error("Update Menu Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update menu item.",
        });
    }
};

// Delete vendor's own menu item
export const deleteMyMenuItem = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        const result = await db.collection("menuItems").deleteOne({
            _id: new ObjectId(id),
            vendorId: req.user.id,
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found or you do not own this item.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item deleted successfully.",
        });
    } catch (error) {
        console.error("Delete Menu Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete menu item.",
        });
    }
};

// Vendor update own menu item availability
export const updateMyMenuItemAvailability = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { isAvailable } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        if (typeof isAvailable !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isAvailable must be true or false.",
            });
        }

        const result = await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(id),
                vendorId: req.user.id,
                status: "approved",
            },
            {
                $set: {
                    isAvailable,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Approved menu item not found or you do not own this item.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Your menu item availability updated successfully.",
            isAvailable,
        });
    } catch (error) {
        console.error("Update My Menu Item Availability Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update menu item availability.",
        });
    }
};

// Get all menu items for admin
export const getAllMenuItems = async (req, res) => {
    try {
        const { status, search } = req.query;

        // Validate query parameter types
        if (
            (status !== undefined && typeof status !== "string") ||
            (search !== undefined && typeof search !== "string")
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid search or status parameter.",
            });
        }

        const pagination = getPagination(req.query, 10, 50);

        if (!pagination) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters.",
            });
        }

        const allowedStatuses = [
            "pending",
            "approved",
            "rejected",
            "inactive",
        ];

        const query = {};

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid menu item status.",
                });
            }

            query.status = status;
        }

        if (search !== undefined && search.trim()) {
            query.itemName = {
                $regex: escapeRegex(search.trim()),
                $options: "i",
            };
        }

        const db = getDB();

        const totalItems = await db
            .collection("menuItems")
            .countDocuments(query);

        const menuItems = await db
            .collection("menuItems")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All menu items retrieved successfully.",
            pagination: {
                currentPage: pagination.page,
                totalPages: Math.ceil(totalItems / pagination.limit),
                totalItems,
                limit: pagination.limit,
            },
            menuItems,
        });
    } catch (error) {
        console.error("Get All Menu Items Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve menu items.",
        });
    }
};

// Admin approve or reject menu item
export const updateMenuItemApproval = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { status } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        if (
            typeof status !== "string" ||
            !["approved", "rejected"].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Status must be approved or rejected.",
            });
        }

        const result = await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(id),
                status: "pending",
            },
            {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Pending menu item not found or already reviewed.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Menu item ${status} successfully.`,
            updatedStatus: status,
        });
    } catch (error) {
        console.error("Update Menu Item Approval Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update menu item approval.",
        });
    }
};

// Admin update menu item availability
export const updateMenuItemAvailability = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { isAvailable } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        if (typeof isAvailable !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isAvailable must be true or false.",
            });
        }

        const result = await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(id),
                status: "approved",
            },
            {
                $set: {
                    isAvailable,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Approved menu item not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item availability updated successfully.",
            isAvailable,
        });
    } catch (error) {
        console.error("Update Menu Item Availability Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update menu item availability.",
        });
    }
};

// Admin delete any menu item
export const adminDeleteMenuItem = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        const result = await db.collection("menuItems").deleteOne({
            _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Menu item deleted successfully by Admin.",
        });
    } catch (error) {
        console.error("Admin Delete Menu Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete menu item.",
        });
    }
};

// Customer can review menu items
export const addMenuItemReview = async (req, res) => {
    try {
        const db = getDB();
        const { itemId } = req.params;
        const { rating, comment } = req.body;

        // Validate menu item ID
        if (!isValidObjectId(itemId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        // Validate rating
        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be an integer between 1 and 5.",
            });
        }

        // Validate comment
        if (
            typeof comment !== "string" ||
            !comment.trim() ||
            comment.trim().length > 500
        ) {
            return res.status(400).json({
                success: false,
                message: "Comment is required and must be within 500 characters.",
            });
        }

        // Check accepted order
        const acceptedOrder = await db.collection("orders").findOne({
            itemId: new ObjectId(itemId),
            customerId: req.user.id,
            status: "accepted",
        });

        if (!acceptedOrder) {
            return res.status(403).json({
                success: false,
                message: "You can review only items you have an accepted order for.",
            });
        }

        // Get customer information
        const customer = await db.collection("user").findOne(
            {
                _id: new ObjectId(req.user.id),
            },
            {
                projection: {
                    name: 1,
                },
            }
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        // Add review without allowing duplicates
        const result = await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(itemId),
                "reviews.customerId": { $ne: req.user.id },
            },
            {
                $push: {
                    reviews: {
                        customerId: req.user.id,
                        customerName: customer.name,
                        rating,
                        comment: comment.trim(),
                        createdAt: new Date(),
                    },
                },
            }
        );

        if (result.matchedCount === 0) {
            const menuItem = await db.collection("menuItems").findOne({
                _id: new ObjectId(itemId),
            });

            if (!menuItem) {
                return res.status(404).json({
                    success: false,
                    message: "Menu item not found.",
                });
            }

            return res.status(409).json({
                success: false,
                message: "You have already reviewed this item.",
            });
        }


        // Calculate average rating using MongoDB aggregation pipeline
        await db.collection("menuItems").updateOne(
            {
                _id: new ObjectId(itemId),
            },
            [
                {
                    $set: {
                        totalReviews: {
                            $size: {
                                $ifNull: ["$reviews", []],
                            },
                        },
                        averageRating: {
                            $round: [
                                {
                                    $avg: {
                                        $map: {
                                            input: {
                                                $ifNull: ["$reviews", []],
                                            },
                                            as: "review",
                                            in: "$$review.rating",
                                        },
                                    },
                                },
                                1,
                            ],
                        },
                    },
                },
            ]
        );

        // Get the updated review statistics
        const updatedMenuItem = await db.collection("menuItems").findOne(
            {
                _id: new ObjectId(itemId),
            },
            {
                projection: {
                    totalReviews: 1,
                    averageRating: 1,
                },
            }
        );

        const totalReviews = updatedMenuItem.totalReviews;
        const averageRating = updatedMenuItem.averageRating;


        return res.status(201).json({
            success: true,
            message: "Review added successfully.",
            totalReviews,
            averageRating: Number(averageRating.toFixed(1)),
        });
    } catch (error) {
        console.error("Add Review Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add review.",
        });
    }
};

// Get menu item reviews
export const getMenuItemReviews = async (req, res) => {
    try {
        const db = getDB();
        const { itemId } = req.params;

        if (!isValidObjectId(itemId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID.",
            });
        }

        const menuItem = await db.collection("menuItems").findOne(
            {
                _id: new ObjectId(itemId),
            },
            {
                projection: {
                    itemName: 1,
                    reviews: 1,
                    averageRating: 1,
                    totalReviews: 1,
                },
            }
        );

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reviews retrieved successfully.",
            itemName: menuItem.itemName,
            totalReviews: menuItem.totalReviews || 0,
            averageRating: menuItem.averageRating || 0,
            reviews: menuItem.reviews || [],
        });
    } catch (error) {
        console.error("Get Reviews Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve reviews.",
        });
    }
};
