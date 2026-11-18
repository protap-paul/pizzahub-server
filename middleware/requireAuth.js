import { verifyToken } from "./verifyToken.js";
import { checkBlockedUser } from "./checkBlockedUser.js";

export const requireAuth = [
    verifyToken,
    checkBlockedUser,
];