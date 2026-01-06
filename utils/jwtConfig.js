import { ApiError } from "./ApiError.js";
import { User } from "../models/user.model.js";

const genAccessAndRefreshTokens = async (userID) => {
    try {
        const user = await User.findById(userID);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // assign refresh token
        user.refreshToken = refreshToken;

        // save without validation
        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken,
        };
    } catch (e) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        );
    }
};

export { genAccessAndRefreshTokens };
