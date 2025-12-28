import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const UserSchema = new mongoose.Schema(
    {
        watchHistory: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video",
                default: [],
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

        coverImage: String,
        avatar: String,

        refreshToken: {
            type: String,
            select: false, // 🔐 important
        },
    },
    { timestamps: true }
);

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 12);
    next();
});

UserSchema.methods.isPasswordCorrect = function (password) {
    return bcrypt.compare(password, this.password);
}


export const User = mongoose.model("User", UserSchema);


