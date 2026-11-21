import { ObjectId } from "mongodb";
import { jwtVerify, createRemoteJWKSet } from "jose";

const authBaseURL = process.env.BETTER_AUTH_URL;

if (!authBaseURL) {
    throw new Error("BETTER_AUTH_URL is not configured!");
}

const JWKS = createRemoteJWKSet(
    new URL("/api/auth/jwks", authBaseURL)
);

export const verifyToken = async (req, res, next) => {
    try {
        // Read Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Access token is required.",
            });
        }

        // Extract and validate Bearer token
        const [scheme, token, ...extraParts] = authHeader.trim().split(/\s+/);

        if (
            scheme !== "Bearer" ||
            !token ||
            extraParts.length > 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid authorization header.",
            });
        }

        // Verify JWT signature and claims
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: authBaseURL,
            audience: authBaseURL,
        });

        // Validate required user information
        const userId = payload.id;

        if (
            typeof userId !== "string" ||
            !ObjectId.isValid(userId) ||
            new ObjectId(userId).toString() !== userId
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid user ID in token.",
            });
        }

        if (
            typeof payload.email !== "string" ||
            !["customer", "vendor", "admin"].includes(payload.role)
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token payload.",
            });
        }

        // Attach authenticated user to request
        req.user = {
            id: userId,
            email: payload.email,
            role: payload.role,
        };
        next();
    } catch (error) {
        console.error("JWT verification failed:", error.message);

        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or expired token.",
        });
    }

};