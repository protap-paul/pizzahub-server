
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