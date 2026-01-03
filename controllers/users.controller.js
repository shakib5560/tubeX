import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

const registerUser = asyncHandler(async (req, res) => {
    const { email, password, username, fullName } = req.body;

    console.log("email:", email);

    // Empty field check
    if ([fullName, email, username, password].some(x => !x || x.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Email validation
    if (!email.includes("@")) {
        throw new ApiError(400, "Invalid email address");
    }

    // Check existing user
    const userExist = await User.findOne({
        $or: [{ email }, { username }],
    });

    if (userExist) {
        throw new ApiError(409, "User already exists");
    }

    // Images handling
    const userAvatarLocal = req.files?.avatar?.[0]?.path;
    const userCoverLocal = req.files?.coverImage?.[0]?.path;

    if (!userAvatarLocal) {
        throw new ApiError(400, "Avatar is required");
    }

    res.status(201).json({
        success: true,
        message: "User registered successfully",
    });
});

export { registerUser };
