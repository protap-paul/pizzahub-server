import express from "express";
import cors from "cors";
import { connectToMongoDB } from "./config/db.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

await connectToMongoDB()

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
}));

// Better Auth handler 
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Routes 
app.use("/api/menu-items", menuItemRoutes);

app.use("/api/protected", protectedRoutes);

app.use("/api/users", userRoutes);

// Test Route
app.get("/", (req, res) => {
    res.send("Welcome to PizzaHub Server!");
});

// Health Check API 
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "PizzaHub Server is running successfully!",
    });
});

// Start Server 
app.listen(PORT, () => {
    console.log(`PizzaHub Server is running on port ${PORT}`);
});