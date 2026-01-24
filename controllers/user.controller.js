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
import {Subscription, Subscriptions} from "../models/subscriptions.model.js";

// Upload helper for Cloudinary
import { deleteFromCloudinary, uploadOn } from "../config/cloudinary.service.js";

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
import mongoose from "mongoose";

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
const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    // 1️⃣ Validate required fields
    if (!oldPassword || !newPassword || !confirmNewPassword) {
        throw new ApiError(400, "Old password, new password and confirmation are required");
    }

    // 2️⃣ Confirm new password match
    if (newPassword !== confirmNewPassword) {
        throw new ApiError(400, "New password and confirm password do not match");
    }

    // 3️⃣ Prevent reusing same password
    if (oldPassword === newPassword) {
        throw new ApiError(400, "New password must be different from old password");
    }

    // 4️⃣ Fetch user with password
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 5️⃣ Verify old password
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isOldPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    // 6️⃣ Validate password strength
    if (newPassword.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long");
    }

    // (Optional but recommended)
    // Add regex check for strong passwords if needed

    // 7️⃣ Update password (hashing via pre-save hook)
    user.password = newPassword;
    await user.save();

    // 8️⃣ Optional security hardening
    // await invalidateUserSessions(user._id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

/* =========================================================
   USER getCurrentUser CONTROLLER
========================================================= */

const getCurrentUser = asyncHandler(async (req, res) => {

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

    // Optional: normalize username
    const normalizedUsername = username.trim().toLowerCase();

    // 1️⃣ Fetch user WITH password for verification
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 2️⃣ Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // 3️⃣ Prevent same username
    if (user.username === normalizedUsername) {
        throw new ApiError(400, "New username must be different");
    }

    // 4️⃣ Check username uniqueness
    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
        throw new ApiError(409, "Username already taken");
    }

    // 5️⃣ Update username safely
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                username: normalizedUsername,
            },
        },
        {
            new: true,
            runValidators: false, // ignore password validation
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(
            200,
            { username: updatedUser.username },
            "Username updated successfully"
        )
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

    // 1️⃣ Fetch user WITH password (needed for verification)
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 2️⃣ Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // 3️⃣ Prevent same email update
    if (user.email === email) {
        throw new ApiError(400, "New email must be different");
    }

    // 4️⃣ Check email uniqueness
    const emailExists = await User.findOne({ email });
    if (emailExists) {
        throw new ApiError(409, "Email already in use");
    }

    // 5️⃣ Update email safely (password untouched)
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                email,
                isEmailVerified: false,
            },
        },
        {
            new: true,
            runValidators: false,
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(
            200,
            { email: updatedUser.email },
            "Email updated successfully"
        )
    );
});

/* =========================================================
   USER fullName CONTROLLER
========================================================= */

const fullNameUpdate = asyncHandler(async (req, res) => {
    const { fullName } = req.body;

    if (!fullName || fullName.trim().length < 3) {
        throw new ApiError(400, "Invalid full name");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName: fullName.trim(),
            },
        },
        {
            new: true,            // return updated document
            runValidators: false, // ignore schema validations (like password)
        }
    ).select("-password");       // exclude password from response

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { fullName: updatedUser.fullName },
            "Full name updated successfully"
        )
    );
});


/* =========================================================
   USER updateAvatar CONTROLLER
========================================================= */
const updateAvatar = asyncHandler(async (req, res) => {
    // 1️⃣ Check if a file is uploaded
    if (!req.file) {
        throw new ApiError(400, "Avatar file is required");
    }

    // 2️⃣ Validate file type
    if (!req.file.mimetype.startsWith("image/")) {
        throw new ApiError(400, "Only image files are allowed");
    }

    // 3️⃣ Find the current user
    const userBefore = await User.findById(req.user._id);
    if (!userBefore) {
        throw new ApiError(404, "User not found");
    }

    const oldAvatar = userBefore.avatar;

    // 4️⃣ Process image if needed (optional)
    // Example: resize & convert to webp using your processImage utility
    const processedAvatarPath = await processImage({
        inputPath: req.file.path,
        width: 256,
        height: 256,
    });

    // 5️⃣ Upload new avatar to Cloudinary
    const uploadedAvatar = await uploadOn(processedAvatarPath);

    if (!uploadedAvatar || !uploadedAvatar.url || !uploadedAvatar.publicId) {
        throw new ApiError(500, "Error uploading avatar");
    }

    // 6️⃣ Update user document
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: { url: uploadedAvatar.url, publicId: uploadedAvatar.publicId } },
        { new: true }
    ).select("-password");

    // 7️⃣ Delete old avatar from Cloudinary
    if (oldAvatar?.publicId) {
        await deleteFromCloudinary(oldAvatar.publicId);
    }

    // 8️⃣ Delete temp uploaded file
    await fs.promises.unlink(req.file.path);
    await fs.promises.unlink(processedAvatarPath);

    return res.status(200).json(
        new ApiResponse(200, { avatar: user.avatar }, "Avatar updated successfully")
    );
});

/* =========================================================
   USER updateCoverImage CONTROLLER
========================================================= */
const updateCoverImage = asyncHandler(async (req, res) => {
    // 1️⃣ If no file uploaded, return current cover image
    if (!req.file) {
        return res.status(200).json(
            new ApiResponse(200, {}, "No cover image uploaded")
        );
    }

    // 2️⃣ Validate file type
    if (!req.file.mimetype.startsWith("image/")) {
        throw new ApiError(400, "Only image files are allowed");
    }

    // 3️⃣ Find current user
    const userBefore = await User.findById(req.user._id);
    if (!userBefore) {
        throw new ApiError(404, "User not found");
    }

    const oldCover = userBefore.coverImage;

    // 4️⃣ Process cover image (optional resizing/conversion)
    const processedCoverPath = await processImage({
        inputPath: req.file.path,
    });

    // 5️⃣ Upload new cover image
    const uploadedCover = await uploadOn(processedCoverPath);

    if (!uploadedCover || !uploadedCover.url || !uploadedCover.publicId) {
        throw new ApiError(500, "Error uploading cover image");
    }

    // 6️⃣ Update user document
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { coverImage: { url: uploadedCover.url, publicId: uploadedCover.publicId } },
        { new: true }
    ).select("-password");

    // 7️⃣ Delete old cover image from Cloudinary
    if (oldCover?.publicId) {
        await deleteFromCloudinary(oldCover.publicId);
    }

    // 8️⃣ Delete temp uploaded file
    await fs.promises.unlink(req.file.path);
    await fs.promises.unlink(processedCoverPath);

    return res.status(200).json(
        new ApiResponse(200, { coverImage: user.coverImage }, "Cover image updated successfully")
    );
});

/* =========================================================
   USER getUserProfile CONTROLLER
========================================================= */
// Controller to fetch a user's public channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {

    // 1️⃣ Extract username from route params
    const { username } = req.params;

    // 2️⃣ Validate username
    // If username is missing or only contains spaces, throw an error
    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    // 3️⃣ Get logged-in user's ObjectId (if authenticated)
    // This is needed to check whether the current user is subscribed
    const userId = req.user
        ? new mongoose.Types.ObjectId(req.user._id)
        : null;

    // 4️⃣ Aggregate user data to build channel profile
    const channel = await User.aggregate([

        // 🔹 STEP 1: Match the channel by username (case-insensitive)
        {
            $match: { username: username.toLowerCase() }
        },

        // 🔹 STEP 2: Find all subscribers of this channel
        // subscriptions.channel → current user's _id
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },

        // 🔹 STEP 3: Find all channels this user has subscribed to
        // subscriptions.subscriber → current user's _id
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },

        // 🔹 STEP 4: Add computed fields
        {
            $addFields: {

                // Total number of subscribers
                subscribersCount: { $size: "$subscribers" },

                // Total number of channels this user subscribed to
                channelsSubscribedToCount: { $size: "$subscribedTo" },

                // Check if the logged-in user is subscribed to this channel
                isSubscribed: {
                    $cond: {
                        if: {
                            $and: [
                                // User must be logged in
                                { $ne: [userId, null] },

                                // User's ID exists in subscribers list
                                { $in: [userId, "$subscribers.subscriber"] }
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },

        // 🔹 STEP 5: Return only required public fields
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ]);

    // 5️⃣ If no channel found, throw 404 error
    if (!channel.length) {
        throw new ApiError(404, "Channel not found");
    }

    // 6️⃣ Send successful response with channel profile
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "Channel fetched successfully"
            )
        );
});


/* =========================================================
   USER getWatchHistory CONTROLLER
========================================================= */
const getWatchHistory = asyncHandler(async (req, res) => {

    // 1️⃣ Check if user is authenticated
    // req.user is usually attached by auth middleware
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized");
    }

    // 2️⃣ Aggregate user data from User collection
    // We use aggregation because watchHistory is an array of video ObjectIds
    const user = await User.aggregate([
        {
            // 3️⃣ Match the currently logged-in user by _id
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            // 4️⃣ Lookup videos based on watchHistory array
            $lookup: {
                from: "videos",                 // Target collection
                localField: "watchHistory",     // Array of video IDs in User
                foreignField: "_id",            // Match with Video _id
                as: "watchHistory",             // Output field
                pipeline: [
                    {
                        // 5️⃣ Populate video owner details
                        $lookup: {
                            from: "users",      // Owner is also a user
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    // 6️⃣ Select only required owner fields
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        // 7️⃣ Convert owner array into a single object
                        // Because a video has only one owner
                        $addFields: {
                            owner: { $first: "$owner" },
                        },
                    },
                ],
            },
        },
    ]);

    // 8️⃣ If user not found or aggregation returns empty
    if (!user.length) {
        throw new ApiError(404, "User watchHistory not found");
    }

    // 9️⃣ Send successful response with watch history
    return res.status(200).json(
        new ApiResponse(
            200,
            user[0].watchHistory || [],   // Fallback to empty array
            "Get watch history successfully"
        )
    );
});

/* =========================================================
   EXPORT CONTROLLERS
========================================================= */

export { registerUser, loginUser, getUserChannelProfile, getWatchHistory, logoutUser, refreshAccessToken, googleAuthCallback, changePassword, getCurrentUser, userNameUpdate, userEmailUpdate, fullNameUpdate, updateCoverImage, updateAvatar };
