// routes/user.routes.js

/**
 * User Routes
 * ------------
 * This module handles all user-related routes:
 * - Registration
 * - Login
 * - Logout
 * - Token Refresh
 */

import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
} from "../controllers/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @route   GET /api/users/register
 * @desc    Simple test route to check registration endpoint
 * @access  Public
 */
router.get("/register", (req, res) => {
    res.json({ message: "GET register endpoint is working" });
});

/**
 * @route   POST /api/users/register
 * @desc    Register a new user with optional avatar and cover image uploads
 * @access  Public
 */
router.post(
    "/register",
    // Multer middleware handles multi-file upload
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
    ]),
    registerUser
);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate user and return access & refresh tokens
 * @access  Public
 */
router.post("/login", loginUser);

/**
 * @route   POST /api/users/logout
 * @desc    Logout the user and invalidate the refresh token
 * @access  Private
 */
router.post("/logout", verifyToken, logoutUser);

/**
 * @route   POST /api/users/refresh-token
 * @desc    Generate a new access token using a valid refresh token
 * @access  Public
 */
router.post("/refresh-token", refreshAccessToken);

export default router;
