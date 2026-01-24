import mongoose from "mongoose";

const subscriptionsSchema = new mongoose.Schema({
  subscription: [
      {
          type: mongoose.Schema.Types.ObjectId, // one who is subscribing
          ref: "User",
      }
  ],
  channels: [
      {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
      }
  ]
}, { timestamps: true})

export  const Subscription = mongoose.model("Subscription", subscriptionsSchema);