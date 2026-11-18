import express from "express";
import { getMenuItems } from "../controllers/menuItemController.js";

const router = express.Router();

router.get("/", getMenuItems);

export default router;