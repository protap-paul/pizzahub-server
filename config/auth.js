import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { authDB, client } from "./db.js";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
    database: mongodbAdapter(authDB, {
        client,
    }),

    baseURL: process.env.BETTER_AUTH_URL,

    secret: process.env.BETTER_AUTH_SECRET,

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
        maxPasswordLength: 128,
    },

    // Google socialProviders 
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },

    // Password validation hooks 
    user: {
        additionalFields: {
            role: {
                type: ["customer", "vendor"],
                required: false,
                defaultValue: "customer",
                input: true,
            },

            isBlocked: {
                type: "boolean",
                required: false,
                defaultValue: false,
                input: false,
            },

            businessName: {
                type: "string",
                required: false,
                input: true,
            },

            subscriptionPlan: {
                type: ["free", "premium"],
                required: false,
                defaultValue: "free",
                input: false,
            },

            subscriptionExpiresAt: {
                type: "date",
                required: false,
                input: false,
            },
        },
    },

    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            // Only validate registration requests
            if (ctx.path != "/sign-up/email") {
                return;
            }

            const password = ctx.body?.password;

            if (typeof password !== "string" || password.length < 6) {
                throw new APIError("BAD_REQUEST", {
                    message: "Password must be at least 6 characters long.",
                });
            }

            if (!/[a-z]/.test(password)) {
                throw new APIError("BAD_REQUEST", {
                    message: "Password must contain at least one lowercase letter.",
                });
            }
        }),
    },

    // JWT authentication
    plugins: [
        jwt({
            jwt: {
                definePayload: ({ user }) => ({
                    id: user.id,
                    email: user.email,
                    role: user.role,
                }),
            },
        }),
    ],
});