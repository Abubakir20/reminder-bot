import { HydratedDocument, Types } from "mongoose";

export enum ReminderStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  MISSED = "MISSED",
}

export enum ReminderRepeatType {
  NONE = "NONE",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
  CUSTOM = "CUSTOM",
}

export interface IReminder {
  userId: Types.ObjectId;

  title: string;

  originalText: string;

  description?: string;

  remindAt: Date;

  remindBefore: number[];

  repeat: ReminderRepeatType;

  customRepeatDays?: number;

  timezone: string;

  status: ReminderStatus;

  isConfirmed: boolean;

  lastNotificationAt?: Date;

  nextRunAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateReminderDto {
  userId: Types.ObjectId;

  title: string;

  originalText: string;

  description?: string;

  remindAt: Date;

  remindBefore?: number[];

  repeat?: ReminderRepeatType;

  customRepeatDays?: number;

  timezone?: string;
}

// Re-parsed content replacing an existing reminder. Ownership and status are
// enforced by the query filter, so they are deliberately not fields here.
export interface UpdateReminderDto {
  title: string;

  originalText: string;

  remindAt: Date;

  remindBefore?: number[];

  repeat?: ReminderRepeatType;
}

export type ReminderDocument = HydratedDocument<IReminder>;