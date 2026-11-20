
import express from "express";
import { getAllTransactions } from "../controllers/transactionController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const router = express.Router();

// Admin: Get All Transactions
router.get(
    "/admin/all",
    requireAuth,
    authorizeRoles("admin"),
    getAllTransactions
);

export default router;
