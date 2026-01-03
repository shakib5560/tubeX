import sharp from "sharp";
import fs from "fs";
import path from "path";

const ALLOWED_FORMATS = ["jpeg", "jpg", "png"];

const processImage = async ({
                                inputPath,
                                width = null,
                                height = null,
                            }) => {
    const image = sharp(inputPath);

    // 🔍 Read image metadata
    const metadata = await image.metadata();

    if (!ALLOWED_FORMATS.includes(metadata.format)) {
        fs.unlinkSync(inputPath); // remove invalid file
        throw new Error("Only JPG, JPEG, and PNG images are allowed");
    }

    const outputPath = inputPath.replace(
        path.extname(inputPath),
        ".webp"
    );

    let processedImage = image;

    if (width && height) {
        processedImage = processedImage.resize(width, height, {
            fit: "cover",
        });
    }

    await processedImage.webp({ quality: 80 }).toFile(outputPath);

    fs.unlinkSync(inputPath); // remove original file
    return outputPath;
};

export { processImage };
