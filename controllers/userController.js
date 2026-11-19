
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Get logged-in user's profile
export const getMyProfile = async (req, res) => {
    try {
        const db = getDB();

        const user = await db.collection("user").findOne(
            {
                _id: new ObjectId(req.user.id),
            },
            {
                projection: {
                    name: 1,
                    email: 1,
                    image: 1,
                    role: 1,
                    businessName: 1,
                    subscriptionPlan: 1,
                    subscriptionExpiresAt: 1,
                    createdAt: 1,
                },
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User profile not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile retrieved successfully.",
            user,
        });
    } catch (error) {
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve user profile.",
        });
    }
};

// Update logged-in user's profile
export const updateMyProfile = async (req, res) => {
    try {
        const db = getDB();

        const { name, image, businessName } = req.body;

        const updateData = {};

        // Update name
        if (typeof name === "string" && name.trim()) {
            updateData.name = name.trim();
        }

        // Update profile image
        if (typeof image === "string") {
            updateData.image = image.trim();
        }

        // Update business name for vendors only
        if (req.user.role === "vendor") {
            if (typeof businessName === "string" && businessName.trim()) {
                updateData.businessName = businessName.trim();
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid profile information.",
            });
        }

        const result = await db.collection("user").updateOne(
            {
                _id: new ObjectId(req.user.id),
            },
            {
                $set: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User profile not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            updatedFields: updateData,
        });
    } catch (error) {
        console.error("Update Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user profile.",
        });
    }
};

// Admin get all users
export const getAllUsers = async (req, res) => {
    try {
        const db = getDB();

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
            50,
            Math.max(1, Number(req.query.limit) || 10)
        );

        const skip = (page - 1) * limit;

        // Get all users except sensitive authentication data
        const { role, search } = req.query;

        const query = {};

        // Filter by role
        if (role && ["customer", "vendor", "admin"].includes(role)) {
            query.role = role;
        }

        // Search by name or email
        if (search && typeof search === "string" && search.trim()) {
            const searchRegex = new RegExp(
                search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
            ];
        }

        const totalUsers = await db.collection("user").countDocuments(query);

        const users = await db
            .collection("user")
            .find(query)
            .project({
                name: 1,
                email: 1,
                image: 1,
                role: 1,
                isBlocked: 1,
                businessName: 1,
                subscriptionPlan: 1,
                subscriptionExpiresAt: 1,
                createdAt: 1,
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All users retrieved successfully.",
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalUsers / limit),
                totalUsers,
                limit,
            },
            users,
        });
    } catch (error) {
        console.error("Get All Users Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve users.",
        });
    }
};

// Admin block a user
export const blockUser = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        // Validate user ID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID.",
            });
        }

        // Prevent admin from blocking themselves
        if (id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot block your own account.",
            });
        }

        // Block user
        const result = await db.collection("user").updateOne(
            {
                _id: new ObjectId(id),
                role: { $in: ["customer", "vendor"] },
            },
            {
                $set: {
                    isBlocked: true,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer or Vendor not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User blocked successfully.",
        });
    } catch (error) {
        console.error("Block User Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to block user.",
        });
    }
};

// Admin unblock a user
export const unblockUser = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        // Validate user ID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID.",
            });
        }

        // Unblock user
        const result = await db.collection("user").updateOne(
            {
                _id: new ObjectId(id),
                role: { $in: ["customer", "vendor"] },
            },
            {
                $set: {
                    isBlocked: false,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer or Vendor not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User unblocked successfully.",
        });
    } catch (error) {
        console.error("Unblock User Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to unblock user.",
        });
    }
};