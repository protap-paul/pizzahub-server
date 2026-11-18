import { success } from "better-auth";
import { jwtVerify, createRemoteJWKset } from "jose";

const authBaseURL = process.env.BETTER_AUTH_URL;

const JWKS = createRemoteJWKset(
    new URL(`${authBaseURL}/api/auth/jwks`)
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

        // Extract JWT token
        const token = authHeader.split(" ")[1];

        // Verify JWT signature and claims
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: authBaseURL,
            audience: authBaseURL,
        });

        // Validate required user information
        const userId = payload.id || payload.sub;

        if (
            typeof userId !== "string" ||
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