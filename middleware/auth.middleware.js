import { asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js";

// verifyToken middleware
// Purpose: Protect routes by verifying JWT access token

export const verifyToken = asyncHandler(async (req, _, next) => {

    try {
        // 1️⃣ Extract access token
        // Priority:
        // 1. From cookies (for browser-based auth)
        // 2. From Authorization header (for API / mobile clients)
        const token =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");

        // 2️⃣ If no token is provided, deny access
        if (!token) {
            throw new ApiError(401, "Access token missing");
        }

        // 3️⃣ Verify and decode JWT
        // - Checks token signature
        // - Checks token expiration
        // - Returns payload if valid
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4️⃣ Find the user using ID stored in token payload
        // - Exclude sensitive fields
        // - Password & refreshToken should never be sent to client
        const user = await User.findById(decoded._id).select(
            "-password -refreshToken"
        );

        // 5️⃣ If token is valid but user no longer exists in DB
        // (example: user deleted but token still exists)
        if (!user) {
            throw new ApiError(401, "Invalid token");
        }

        // 6️⃣ Attach authenticated user to request object
        // This allows access in next middleware or controller
        // Example: req.user._id, req.user.role
        req.user = user;

        // 7️⃣ Pass control to the next middleware/controller
        next();

    } catch (error) {

        // 8️⃣ Handle expired JWT separately
        // Happens when token's exp time is over
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Token expired");
        }

        // 9️⃣ Handle invalid JWT
        // Happens when:
        // - Token is malformed
        // - Signature is invalid
        // - Token is tampered with
        if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid token");
        }

        // 🔟 Forward any other unexpected errors
        // asyncHandler will catch and send them to global error middleware
        throw error;
    }
});
