import { getDB } from "../config/db.js";

export const checkBlockedUser = async (req, res, next) => {
    try {
        const db = getDB();

        const user = await db.collection("user").findOne(
            {
                $or: [
                    { _id: req.user.id },
                    { id: req.user.id },
                ],
            },
            {
                projection: {
                    isBlocked: 1,
                },
            }
        );

        // Access is denied if the user is not in the database
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User not found.",
            });
        }

        // Access for blocked users is disabled
        if (user.isBlocked === true) {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked.",
            });
        }

        next();
    } catch (error) {
        console.error("Blocked user check error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to verify user account status.",
        });
    }
};