import {asyncHandler} from "../utils/asyncHandler.js";
import connectDB from "../config/db.js";

const registerUser = asyncHandler( async (req, res) => {
    res.status(200).json({
        message: "User already registered",
    })
})

export {registerUser}