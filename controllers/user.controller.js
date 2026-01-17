/* =========================================================
   IMPORTS & DEPENDENCIES
========================================================= */
import { genAccessAndRefreshTokens } from "../utils/jwtConfig.js";

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
// import { genAccessAndRefreshTokens } from "../utils/jwtConfig.js";

// JWT token input
import jwt from "jsonwebtoken";
import user from "debug";

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
   USER googleAuthCallback CONTROLLER
========================================================= */

const googleAuthCallback = asyncHandler(async (req, res) => {

    const user = req.user;

    // 1️⃣ Generate tokens
    const { accessToken, newRefreshToken } =
        await genAccessAndRefreshTokens(user._id);

    // 2️⃣ Save refresh token
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    // 3️⃣ Cookie options
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    // 4️⃣ Send cookies & redirect frontend
    res
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .redirect("http://localhost:3000"); // frontend URL
})

/* =========================================================
   USER changeCurrentPassword CONTROLLER
========================================================= */

// Controller to handle user password change
const changePasswordCallback = asyncHandler(async (req, res) => {

    // 1️⃣ Extract old and new password from request body
    const { oldPassword, newPassword, conformNewPassword} = req.body;

    // 2️⃣ Validate required fields
    // If either old or new password is missing, throw a bad request error
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }

    if (conformNewPassword !== newPassword) {
        throw new ApiError(403, "ConformNewPassword is not correct");
    }

    // 3️⃣ Fetch the authenticated user from database using ID from token
    const user = await User.findById(req.user._id);

    // 4️⃣ If user does not exist, token is invalid or user was deleted
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 5️⃣ Verify that the provided old password matches the stored password
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    // 6️⃣ If old password does not match, deny the request
    if (!isOldPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    // 7️⃣ Validate new password strength (minimum length check)
    if (newPassword.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long");
    }



    // 8️⃣ Assign the new password
    // Password hashing will be handled automatically by Mongoose pre-save hook
    user.password = newPassword;

    // 9️⃣ Save the updated user document to the database
    await user.save();

    // 🔟 Send success response to client
    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

/* =========================================================
   USER getCurrentUser CONTROLLER
========================================================= */

const  getCurrentUser = asyncHandler(async (req, res) => {

    return res
    .status(200)
        .json(200, req.user, "current user fetched successfully")

})

/* =========================================================
   USER updateUsername CONTROLLER
========================================================= */

const userNameUpdate = asyncHandler(async (req, res) => {
    const { password, username } = req.body;

    if (!password || !username) {
        throw new ApiError(400, "Password and username are required");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid password");
    }

    if (user.username === username) {
        throw new ApiError(400, "New username must be different");
    }

    const exists = await User.findOne({ username });
    if (exists) {
        throw new ApiError(409, "Username already taken");
    }

    user.username = username;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { username: user.username }, "Username updated successfully")
    );
});

/* =========================================================
   USER updateEmail CONTROLLER
========================================================= */

const userEmailUpdate = asyncHandler(async (req, res) => {
    const { password, email } = req.body;

    if (!password || !email) {
        throw new ApiError(400, "Password and email are required");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid password");
    }

    if (user.email === email) {
        throw new ApiError(400, "New email must be different");
    }

    const exists = await User.findOne({ email });
    if (exists) {
        throw new ApiError(409, "Email already in use");
    }

    user.email = email;
    user.isEmailVerified = false; // recommended
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { email: user.email }, "Email updated successfully")
    );
});

/* =========================================================
   USER fullName CONTROLLER
========================================================= */

const fullNameUpdate = asyncHandler(async (req, res) => {
    const {fullName} = req.body;
    if (!fullName){
        throw new ApiError(400, "Wrong full name");
    }
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    user.fullName = fullName;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            { username: user.username },
            "FullName updated successfully"
        )
    );
})

/* =========================================================
   EXPORT CONTROLLERS
========================================================= */

export { registerUser, loginUser, logoutUser, refreshAccessToken, googleAuthCallback, changePasswordCallback, getCurrentUser, userNameUpdate, userEmailUpdate, fullNameUpdate };
