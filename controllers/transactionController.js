
import { getDB } from "../config/db.js";

// Admin: Get All Transactions
export const getAllTransactions = async (req, res) => {
    try {
        const db = getDB();

        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
            50,
            Math.max(1, Number(req.query.limit) || 10)
        );

        const skip = (page - 1) * limit;

        // Status Filter
        const { status } = req.query;

        const query = {};

        if (
            status &&
            ["completed", "pending", "failed", "refunded"].includes(status)
        ) {
            query.status = status;
        }

        // Total Transactions
        const totalTransactions =
            await db.collection("transactions").countDocuments(query);

        // Get Transactions
        const transactions = await db.collection("transactions")
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All transactions retrieved successfully.",
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalTransactions / limit),
                totalTransactions,
                limit,
            },
            transactions,
        });

    } catch (error) {
        console.error("Get All Transactions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve transactions.",
        });
    }
};
