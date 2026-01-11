/* =========================================================
   IMPORTS & DEPENDENCIES
========================================================= */

// Wraps async controllers to handle errors centrally
import { asyncHandler } from "../utils/asyncHandler.js";

// Custom error class for consistent API errors
import { ApiError } from "../utils/ApiError.js";

// User Mongoose model
import { User } from "../models/user.model.js";

// Upload helper for Cloudinary
import { uploadOn } from "../config/cloudinary.service.js";

// Image processing utility (resize, convert to webp)
import { processImage } from "../utils/imageProcessor.js";

// Node file system (used to delete temp files)
import fs from "fs";

// Standardized API success response
import ApiResponse from "../utils/ApiResponse.js";

// JWT access & refresh token generator
import { genAccessAndRefreshTokens } from "../utils/jwtConfig.js";

// JWT token input
import jwt from "jsonwebtoken";

/* =========================================================
   CONSTANTS
========================================================= */

// Default cover image (used if user does not upload one)
const DEFAULT_COVER = "public/images/cover.webp";

/* =========================================================
   USER REGISTRATION CONTROLLER
========================================================= */

const registerUser = asyncHandler(async (req, res) => {

    /* ----------------------------------------------------
       STEP 1: Extract required fields from request body
    ---------------------------------------------------- */
    const { email, password, username, fullName } = req.body;

    /* ----------------------------------------------------
       STEP 2: Validate empty fields
       - Ensures no required field is missing or empty
    ---------------------------------------------------- */
    if ([fullName, email, username, password].some(v => !v || v.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    /* ----------------------------------------------------
       STEP 3: Validate email format
    ---------------------------------------------------- */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email address");
    }

    /* ----------------------------------------------------
       STEP 4: Normalize username
       - Makes username case-insensitive
    ---------------------------------------------------- */
    const normalizedUsername = username.toLowerCase();

    /* ----------------------------------------------------
       STEP 5: Check if user already exists
       - Prevents duplicate email or username
    ---------------------------------------------------- */
    const userExist = await User.findOne({
        $or: [{ email }, { username: normalizedUsername }],
    });

    if (userExist) {
        throw new ApiError(409, "User already exists");
    }

    /* ----------------------------------------------------
       STEP 6: Validate avatar upload (REQUIRED)
    ---------------------------------------------------- */
    if (!req.files?.avatar?.[0]) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatarFile = req.files.avatar[0];

    /* ----------------------------------------------------
       STEP 7: Validate avatar file size (Max 2MB)
    ---------------------------------------------------- */
    const MAX_SIZE = 2 * 1024 * 1024;
    if (avatarFile.size > MAX_SIZE) {
        throw new ApiError(400, "Avatar too large");
    }

    /* ----------------------------------------------------
       STEP 8: Validate avatar MIME type
    ---------------------------------------------------- */
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(avatarFile.mimetype)) {
        throw new ApiError(400, "Invalid format for user avatar");
    }

    /* ----------------------------------------------------
       STEP 9: Process avatar image
       - Resize to 256x256
       - Convert to webp for optimization
    ---------------------------------------------------- */
    const avatarWebpPath = await processImage({
        inputPath: avatarFile.path,
        width: 256,
        height: 256,
    });

    /* ----------------------------------------------------
       STEP 10: Upload avatar to Cloudinary
       - Delete local temp files after upload
    ---------------------------------------------------- */
    let uploadedAvatar;
    try {
        uploadedAvatar = await uploadOn(avatarWebpPath);
    } finally {
        await Promise.allSettled([
            fs.promises.unlink(avatarWebpPath),
            fs.promises.unlink(avatarFile.path),
        ]);
    }

    if (!uploadedAvatar?.url) {
        throw new ApiError(500, "Avatar upload failed");
    }

    /* ----------------------------------------------------
       STEP 11: Handle optional cover image upload
    ---------------------------------------------------- */
    let uploadedCover = null;

    if (req.files?.coverImage?.[0]) {
        const coverFile = req.files.coverImage[0];

        if (!allowedMimeTypes.includes(coverFile.mimetype)) {
            throw new ApiError(400, "Invalid format for user cover image");
        }

        const coverWebpPath = await processImage({ inputPath: coverFile.path });

        try {
            uploadedCover = await uploadOn(coverWebpPath);
        } finally {
            await Promise.allSettled([
                fs.promises.unlink(coverWebpPath),
                fs.promises.unlink(coverFile.path),
            ]);
        }
    }

    /* ----------------------------------------------------
       STEP 12: Create user in database
       - Password hashing occurs in model pre-save hook
    ---------------------------------------------------- */
    const user = await User.create({
        fullName,
        email,
        username: normalizedUsername,
        password,
        avatar: {
            url: uploadedAvatar.url,
            publicId: uploadedAvatar.publicId,
        },
        coverImage: uploadedCover
            ? {
                url: uploadedCover.url,
                publicId: uploadedCover.publicId,
            }
            : undefined,
    });

    /* ----------------------------------------------------
       STEP 13: Fetch user without sensitive fields
    ---------------------------------------------------- */
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(403, "User not found");
    }

    /* ----------------------------------------------------
       STEP 14: Send success response
    ---------------------------------------------------- */
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

/* =========================================================
   USER LOGIN CONTROLLER
========================================================= */

const loginUser = asyncHandler(async (req, res) => {

    /* ----------------------------------------------------
       STEP 1: Extract login credentials
    ---------------------------------------------------- */
    const { email, username, password } = req.body;

    if (!email && !username) {
        throw new ApiError(400, "username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    /* ----------------------------------------------------
       STEP 2: Find user by email or username
    ---------------------------------------------------- */
    const userFind = await User.findOne({
        $or: [{ email }, { username }],
    }).select("+password");

    if (!userFind) {
        throw new ApiError(401, "Invalid credentials");
    }

    /* ----------------------------------------------------
       STEP 3: Verify password
    ---------------------------------------------------- */
    const isPasswordValid = await userFind.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    /* ----------------------------------------------------
       STEP 4: Generate JWT tokens
    ---------------------------------------------------- */
    const { accessToken, refreshToken } =
        await genAccessAndRefreshTokens(userFind._id);

    /* ----------------------------------------------------
       STEP 5: Fetch user without sensitive fields
    ---------------------------------------------------- */
    const loggedInUser = await User.findById(userFind._id)
        .select("-password -refreshToken");

    /* ----------------------------------------------------
       STEP 6: Send tokens via HTTP-only cookies
    ---------------------------------------------------- */
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});

/* =========================================================
   USER LOGOUT CONTROLLER
========================================================= */

const logoutUser = asyncHandler(async (req, res) => {

    /* ----------------------------------------------------
       STEP 1: Verify authenticated user
    ---------------------------------------------------- */
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized request");
    }

    /* ----------------------------------------------------
       STEP 2: Remove refresh token from database
    ---------------------------------------------------- */
    await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshToken: 1 },
    });

    /* ----------------------------------------------------
       STEP 3: Clear authentication cookies
    ---------------------------------------------------- */
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "None",
        path: "/",
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        );
});

/* =========================================================
   USER RefreshAccessToken CONTROLLER
========================================================= */

const refreshAccessToken = asyncHandler(async (req, res) => {
    // 1️⃣ Get the refresh token from cookies or request body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        // If no token found, return unauthorized
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        // 2️⃣ Decode the token using jwt.verify instead of jwt.decode
        // ⚠️ Important: jwt.decode DOES NOT verify the token signature, jwt.verify does
        const decodedRefreshToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        // 3️⃣ Find the user by ID from decoded token
        const findUser = await User.findById(decodedRefreshToken._id);

        if (!findUser) {
            throw new ApiError(401, "User not found for this token");
        }

        // 4️⃣ Compare incoming token with stored refreshToken in DB
        if (incomingRefreshToken !== findUser.refreshToken) {
            throw new ApiError(403, "Refresh token is invalid or expired");
        }

        // 5️⃣ Generate new access and refresh tokens
        const { accessToken, newRefreshToken } = await genAccessAndRefreshTokens(findUser._id);

        // 6️⃣ Update the user's refreshToken in DB
        findUser.refreshToken = newRefreshToken;
        await findUser.save();

        // 7️⃣ Cookie options
        const options = {
            httpOnly: true,  // Prevents client-side JS access
            secure: process.env.NODE_ENV === "production",  // Only send over HTTPS in production
            sameSite: "strict",  // Helps prevent CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000 // Optional: 7 days
        };

        // 8️⃣ Send new tokens in HTTP-only cookies and response body
        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Tokens refreshed successfully")
            );
    } catch (error) {
        console.error(error);
        // 9️⃣ Handle JWT errors specifically
        if (error.name === "TokenExpiredError") {
            throw new ApiError(403, "Refresh token has expired");
        }
        if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid refresh token");
        }
        throw new ApiError(500, error.message || "Something went wrong while refreshing token");
    }
});

/* =========================================================
   EXPORT CONTROLLERS
========================================================= */

export { registerUser, loginUser, logoutUser, refreshAccessToken };
