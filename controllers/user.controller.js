import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOn } from "../config/cloudinary.service.js";
import { processImage } from "../utils/imageProcessor.js";
import fs from "fs";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * Default cover image
 * Should ideally be a Cloudinary URL or a publicly served static file
 */
const DEFAULT_COVER = "public/images/cover.webp";

/**
 * User Registration Controller
 */
const registerUser = asyncHandler(async (req, res) => {

    /* ----------------------------------------------------
       1. Extract required fields from request body
    ---------------------------------------------------- */
    const { email, password, username, fullName } = req.body;

    /* ----------------------------------------------------
       2. Basic empty field validation
    ---------------------------------------------------- */
    if ([fullName, email, username, password].some(v => !v || v.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    /* ----------------------------------------------------
       3. Email format validation
    ---------------------------------------------------- */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email address");
    }

    /* ----------------------------------------------------
       4. Normalize username (case-insensitive uniqueness)
    ---------------------------------------------------- */
    const normalizedUsername = username.toLowerCase();

    /* ----------------------------------------------------
       5. Check if user already exists
    ---------------------------------------------------- */
    const userExist = await User.findOne({
        $or: [{ email }, { username: normalizedUsername }],
    });

    if (userExist) {
        throw new ApiError(409, "User already exists");
    }

    /* ----------------------------------------------------
       6. Avatar validation (required)
    ---------------------------------------------------- */
    if (!req.files?.avatar?.[0]) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatarFile = req.files.avatar[0];

    /* ----------------------------------------------------
       7. File size validation (2MB max)
    ---------------------------------------------------- */
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (avatarFile.size > MAX_SIZE) {
        throw new ApiError(400, "Avatar too large");
    }

    /* ----------------------------------------------------
       8. MIME type validation
    ---------------------------------------------------- */
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowedMimeTypes.includes(avatarFile.mimetype)) {
        throw new ApiError(400, "Invalid format for user avatar");
    }

    /* ----------------------------------------------------
       9. Process avatar image (resize + convert to webp)
    ---------------------------------------------------- */
    const avatarWebpPath = await processImage({
        inputPath: avatarFile.path,
        width: 256,
        height: 256,
    });

    /* ----------------------------------------------------
       10. Upload avatar to Cloudinary
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
       11. Handle optional cover image
    ---------------------------------------------------- */
    let coverUrl = DEFAULT_COVER;

    if (req.files?.coverImage?.[0]) {
        const coverFile = req.files.coverImage[0];

        if (!allowedMimeTypes.includes(coverFile.mimetype)) {
            throw new ApiError(400, "Invalid format for user cover image");
        }

        const coverWebpPath = await processImage({
            inputPath: coverFile.path,
        });

        let uploadedCover;
        try {
            uploadedCover = await uploadOn(coverWebpPath);
        } finally {
            // ✅ SAFE CLEANUP (no crash if missing)
            await Promise.allSettled([
                fs.promises.unlink(coverWebpPath),
                fs.promises.unlink(coverFile.path),
            ]);
        }

        if (uploadedCover?.url) {
            coverUrl = uploadedCover.url;
        }
    }


    /* ----------------------------------------------------
       12. Create user in database
       (password hashing should happen in user model pre-save hook)
    ---------------------------------------------------- */
    const user = await User.create({
        fullName,
        email,
        username: normalizedUsername,
        password,
        avatar: uploadedAvatar.url,
        coverImage: coverUrl,
    });

    /* ----------------------------------------------------
       13. Fetch user without sensitive fields
    ---------------------------------------------------- */
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(403, "User not found");
    }

    /* ----------------------------------------------------
       14. Send success response
    ---------------------------------------------------- */
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

export { registerUser };
