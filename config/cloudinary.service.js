import cloudinary from "cloudinary";
import fs from "fs";

const { v2 } = cloudinary;

const connectCloudinary = () => {
    if (
        !process.env.CLOUD_NAME ||
        !process.env.API_KEY ||
        !process.env.API_SECRET
    ) {
        throw new Error("Cloudinary environment variables are missing");
    }

    v2.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    });

    console.log("✅ Cloudinary connected successfully");
};


const uploadOn = async (filePath) => {
    try {
        if (!filePath) return null;

        const response = await v2.uploader.upload(filePath, {
            resource_type: "auto",
            folder: "users",
        });

        fs.unlinkSync(filePath);

        return {
            url: response.secure_url,
            publicId: response.public_id,
        };

    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); //for unlink url
        }
        throw error;
    }
};


const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return;

    await v2.uploader.destroy(publicId, {
        resource_type: "image",
    });
};

export { v2 as cloudinary, connectCloudinary, uploadOn, deleteFromCloudinary };

