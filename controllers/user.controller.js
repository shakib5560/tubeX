import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOn} from "../config/cloudinary.service.js";
import { processImage } from "../utils/imageProcessor.js";
import fs from "fs";
import path from "path";
import ApiResponse from "../utils/ApiResponse.js";

const DEFAULT_COVER = "public/images/cover.webp";

const registerUser = asyncHandler(async (req, res) => {
    const { email, password, username, fullName } = req.body;

    console.log("email:", email);

    // Empty field check
    if ([fullName, email, username, password].some(x => !x || x.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email address");
    }


    // Check existing user
    const normalizedUsername = username.toLowerCase();

    const userExist = await User.findOne({
        $or: [{ email }, { username: normalizedUsername }],
    });


    if (userExist) {
        throw new ApiError(409, "User already exists");
    }

    // Images handling

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB

    if (req.files.avatar[0].size > MAX_SIZE) {
        throw new ApiError(400, "Avatar too large");
    }

    const userAvatarLocal = req.files?.avatar?.[0]?.path;
    const userCoverLocal = req.files?.coverImage?.[0]?.path;

    if (!userAvatarLocal) {
        throw new ApiError(400, "Avatar is required");
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    if (!allowedMimeTypes.includes(req.files.avatar[0].mimetype)) {
        throw new ApiError(400, "Invalid format for user avatar");
    }

    if (userCoverLocal && !allowedMimeTypes.includes(req.files.coverImage[0].mimetype)) {
        throw new ApiError(400, "Invalid format for user cover image");
    }


// ✅ Avatar: resize + webp
    const avatarWebpPath = await processImage({
        inputPath: userAvatarLocal,
        width: 256,
        height: 256,
    });



// Upload avatar
    const upAvatar = await uploadOn(avatarWebpPath);
    if (!upAvatar?.url) {
        fs.unlinkSync(avatarWebpPath);
        fs.unlinkSync(userAvatarLocal);
        throw new ApiError(500, "Avatar upload failed");
    } else {
        console.log(upAvatar.url);
    }

    // Handle cover image
    let coverUrl = DEFAULT_COVER;
    if (req.files?.coverImage?.[0]) {
        const coverFile = req.files.coverImage[0];

        if (!allowedMimeTypes.includes(coverFile.mimetype)) {
            throw new ApiError(400, "Invalid format for user cover image");
        }

        const coverWebpPath = await processImage({
            inputPath: coverFile.path,
        });

        const uploadedCover = await uploadOn(coverWebpPath);
        if (uploadedCover?.url) {
            coverUrl = uploadedCover.url;
            fs.unlinkSync(avatarWebpPath);
            fs.unlinkSync(userAvatarLocal);
        }
    }

    const user =await User.create({
        fullName,
        avatar: upAvatar.url,
        coverImage: coverUrl,
        email,
        username: normalizedUsername,
        password,
    })

    const userFind = await User.findById(user._id).select(
        "-password -refreshToken", //syntax
    )

    if (!userFind) {
        throw new ApiError(403, "User not found");
    }

    return res.status(201).json(
        new ApiResponse(201, userFind, "User registered")
    );


});

export { registerUser };
