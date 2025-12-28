import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const UserSchema = new mongoose.Schema(
    {
        watchHistory: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video",
            },
        ],

        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please add a valid email",
            ],
        },

        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            index: true,
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            select: false, // 🔐 never expose
        },

        coverImage: {
            type: String,
            default: "",
        },

        avatar: {
            type: String,
            default: "",
        },

        refreshToken: {
            type: String,
            select: false, // 🔐 never expose
        },
    },
    { timestamps: true }
);

/* =========================
   Password Hash Middleware
========================= */
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 12);
    return next();
});

/* =========================
   Instance Methods
========================= */

// 🔐 Compare password
UserSchema.methods.isPasswordCorrect = function (password) {
    return bcrypt.compare(password, this.password);
};

// 🔑 Generate Access Token
UserSchema.methods.generateAccessToken = function () {
    const accessToken = jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    );

    return accessToken;
};

// 🔁 Generate Refresh Token
UserSchema.methods.generateRefreshToken = function () {
    const refreshToken = jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    );

    return refreshToken;
};

export const User = mongoose.model("User", UserSchema);
