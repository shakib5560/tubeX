import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1️⃣ No token → continue as guest
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(" ")[1];

        // 2️⃣ Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // 3️⃣ Fetch user
        const user = await User.findById(decoded._id).select(
            "_id username email avatar"
        );

        if (!user) {
            throw new ApiError(401, "User not found");
        }

        // 4️⃣ Attach user to request
        req.user = user;
        next();

    } catch (error) {
        // ❌ Token exists but invalid
        throw new ApiError(401, "Invalid or expired token");
    }
};
