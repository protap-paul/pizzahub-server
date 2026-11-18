
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
