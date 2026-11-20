
import { getDB } from "../config/db.js";

// Admin: Get All Transactions
export const getAllTransactions = async (req, res) => {
    try {
        const db = getDB();

        // Pagination
        const pageInput = Number(req.query.page) || 1;
        const limitInput = Number(req.query.limit) || 10;

        const page = Math.max(1, Math.floor(pageInput));
        const limit = Math.min(50, Math.max(1, Math.floor(limitInput)));

        const skip = (page - 1) * limit;

        // Status Filter
        const { status } = req.query;

        const query = {};

        const allowedStatuses = [
            "completed",
            "pending",
            "failed",
            "refunded",
        ];

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid transaction status filter.",
                });
            }

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
