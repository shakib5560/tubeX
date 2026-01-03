import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const VideoSchema = new mongoose.Schema({
    videoFile: {
        type: String,
        required: true,
        unique: true,
    },
    thumbnail: {
        type: String,
    },
    title: {
        type: String,
        required: [true, "Title is required"],
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    description: {
        type: String,
        limit: [500, "Description must be less than 100 characters"],
    },
    duration: {
        type: Number,
        default: 0,
        required: true,
    },
    views: {
        type: Number,
        default: 0,
    },
    isPublished: {
        type: String,
        options: ["published", "unpublished"],
        default: "published",
    },

},{timestamps: true})

VideoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", VideoSchema);