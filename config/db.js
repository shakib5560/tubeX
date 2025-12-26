import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import app from "../app.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            `${process.env.DB_URL}/${DB_NAME}`
        );

        console.log(
            `MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
        );

        mongoose.connection.on("error", (error) => {
            console.error("MongoDB connection error:", error);
        });


        return connectionInstance;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1); // recommended for backend apps
    }
};

export default connectDB;
