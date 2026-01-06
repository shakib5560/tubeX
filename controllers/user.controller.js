import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOn } from "../config/cloudinary.service.js";
import { processImage } from "../utils/imageProcessor.js";
import fs from "fs";
import ApiResponse from "../utils/ApiResponse.js";
import {genAccessAndRefreshTokens} from "../utils/jwtConfig.js";

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
       12. Create user in database
       (password hashing should happen in user model pre-save hook)
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
       13. Fetch user without sensitive fields
    ---------------------------------------------------- */
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(403, "User not found");
    }

    /* ----------------------------------------------------
       14. Send success response (DONE)
    ---------------------------------------------------- */
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

/**
 * User Login Controller
 */
const loginUser = asyncHandler(async (req, res) => {
    // password match according to the username/email
    // find the user
    // access and refresh token
    //send cookie

    /* -- get data from frontend request body -- */
    const { email, username, password } = req.body;
    if (!email && !username ) {
        throw new ApiError(400, "username or email is required")
    }
    if (!password) {
        throw new ApiError(400, "Password is required")
    }

    /* -- try to match from DB and check exiting  -- */
    const userFind = await User.findOne({  // Search data in side databased
        $or: [{ email }, { username }],
    })
    if (!userFind) {
        throw new ApiError(401, "Invalid credentials");
    }

    /* -- check password valid or not (using bcrypt) -- */
    const  isPasswordValid = await userFind.isPasswordCorrect(password)
    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    /* generate accessToken & refreshToken */
    const {accessToken, refreshToken} = await genAccessAndRefreshTokens(userFind?._id);

    const  loggedInUser = await User.findById(userFind?._id).
    select("-password -refreshToken"); // find user according to the id, ignore filed because don't wanna send password inside cookies

    /* -- Sending cookies -- */
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
    }


    return res
        .status(200)
        .cookies("accessToken", accessToken, options)
        .cookies("refreshToken", refreshToken, options )
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
                "User logged in successfully")
        )
})

/**
 * User Logout Controller
 */
const logoutUser = asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized request");
    }

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        }
    );

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "None", // MUST match login cookie
        path: "/",        // MUST match login cookie
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        );
});

export { registerUser, loginUser, logoutUser };
