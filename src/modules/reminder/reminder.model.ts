import mongoose, { Schema } from "mongoose";
import {
  IReminder,
  ReminderRepeatType,
  ReminderStatus,
} from "./reminder.types.js";

const reminderSchema = new Schema<IReminder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    originalText: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    remindAt: {
      type: Date,
      required: true,
      index: true,
    },

    remindBefore: {
      type: [Number],
      default: [60],
    },

    repeat: {
      type: String,
      enum: Object.values(ReminderRepeatType),
      default: ReminderRepeatType.NONE,
    },

    customRepeatDays: {
      type: Number,
    },

    timezone: {
      type: String,
      default: "Asia/Tashkent",
    },

    status: {
      type: String,
      enum: Object.values(ReminderStatus),
      default: ReminderStatus.ACTIVE,
      index: true,
    },

    isConfirmed: {
      type: Boolean,
      default: false,
    },

    lastNotificationAt: {
      type: Date,
    },

    nextRunAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export const ReminderModel = mongoose.model<IReminder>(
  "Reminder",
  reminderSchema,
);