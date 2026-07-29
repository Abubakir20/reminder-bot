import mongoose, { Schema } from "mongoose";
import { IUser } from "./user.types.js";
import { SUPPORTED_LANGUAGES } from "../../shared/types/translation.js";

const userSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
    },

    firstName: {
      type: String,
    },

    languageCode: {
      type: String,
    },

    language: {
      type: String,
      enum: SUPPORTED_LANGUAGES,
      default: null,
    },

    timezone: {
      type: String,
      default: "Asia/Tashkent",
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);