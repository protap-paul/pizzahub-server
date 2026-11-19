import { getDB } from "../config/db.js";

// Admin: Get dashboard overview statistics
export const getAdminDashboardStats = async (req, res) => {
    try {
        const db = getDB();

        // Total registered users
        const totalUsers = await db
            .collection("user")
            .countDocuments();

        // Total customers
        const totalCustomers = await db
            .collection("user")
            .countDocuments({ role: "customer" });

        // Total vendors
        const totalVendors = await db
            .collection("user")
            .countDocuments({ role: "vendor" });

        // Total menu items
        const totalMenuItems = await db
            .collection("menuItems")
            .countDocuments();

        // Pending menu items
        const pendingMenuItems = await db
            .collection("menuItems")
            .countDocuments({ status: "pending" });

        // Total orders
        const totalOrders = await db
            .collection("orders")
            .countDocuments();

        // Pending orders
        const pendingOrders = await db
            .collection("orders")
            .countDocuments({ status: "pending" });

        // Total transactions
        const totalTransactions = await db
            .collection("transactions")
            .countDocuments();

        return res.status(200).json({
            success: true,
            message: "Admin dashboard statistics retrieved successfully.",
            stats: {
                totalUsers,
                totalCustomers,
                totalVendors,
                totalMenuItems,
                pendingMenuItems,
                totalOrders,
                pendingOrders,
                totalTransactions,
            },
        });

    } catch (error) {
        console.error("Admin Dashboard Stats Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve admin dashboard statistics.",
        });
    }
};