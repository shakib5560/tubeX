import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {deleteFromCloudinary} from "../config/cloudinary.service.js";

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

        googleId: {
            type: String,
            unique: true,
            sparse: true
        },
        isGoogleAuth: {
            type: Boolean,
            default: false
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
            url: {
                type: String,
            },
            publicId: {
                type: String,
            },
        },

        avatar: {
            url: {
                type: String,
                required: true,
            },
            publicId: {
                type: String,
                required: true,
            },
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
// UserSchema.pre("save", async function (next) {
//     if (!this.isModified("password")) return next();
//
//     this.password = await bcrypt.hash(this.password, 12);
//     return next();
// });
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
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

UserSchema.post("findOneAndDelete", async function (doc) {
    if (!doc) return;

    await Promise.allSettled([
        deleteFromCloudinary(doc.avatar?.publicId),
        deleteFromCloudinary(doc.coverImage?.publicId),
    ]);
});


export const User = mongoose.model("User", UserSchema);
