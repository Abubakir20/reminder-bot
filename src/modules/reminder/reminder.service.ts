import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import {
  ReminderDocument,
  CreateReminderDto,
  ReminderStatus,
  ReminderRepeatType,
} from './reminder.types.js';
import { ReminderModel } from './reminder.model.js';

// Collects every send-moment for a reminder (each remindBefore lead-time
// plus the deadline itself) and returns the nearest one still ahead of
// `from`. Falls back to the deadline itself if everything is already past.
const computeNextRun = (remindAt: Date, remindBefore: number[], from: Date): Date => {
  const candidates = [
    ...remindBefore.map((minutes) => new Date(remindAt.getTime() - minutes * 60_000)),
    remindAt,
  ];

  const future = candidates
    .filter((candidate) => candidate > from)
    .sort((a, b) => a.getTime() - b.getTime());

  return future.length > 0 ? future[0] : remindAt;
};

export const createReminder = async (
  data: CreateReminderDto,
): Promise<ReminderDocument> => {
  const remindBefore = data.remindBefore ?? [60];
  const nextRunAt = computeNextRun(data.remindAt, remindBefore, new Date());

  return ReminderModel.create({ ...data, remindBefore, nextRunAt });
};

export const findReminderById = async (
  id: string,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findById(id);
};

export const getUserReminders = async (
  userId: Types.ObjectId,
): Promise<ReminderDocument[]> => {
  return ReminderModel.find({
    userId,
    status: ReminderStatus.ACTIVE,
  }).sort({
    remindAt: 1,
  });
};

export const deleteReminder = async (
  id: string,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndDelete(id);
};

export const completeReminder = async (
  id: string,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndUpdate(
    id,
    {
      status: ReminderStatus.COMPLETED,
    },
    {
      returnDocument: 'after',
    },
  );
};

export const cancelReminder = async (
  id: string,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndUpdate(
    id,
    {
      status: ReminderStatus.CANCELLED,
    },
    {
      returnDocument: 'after',
    },
  );
};

export const findDueReminders = async (now: Date): Promise<ReminderDocument[]> => {
  return ReminderModel.find({
    status: ReminderStatus.ACTIVE,
    nextRunAt: { $lte: now },
  })
    .sort({ nextRunAt: 1 })
    .limit(100);
};

export const recordNotification = async (
  id: string,
  sentAt: Date,
  nextRunAt: Date,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndUpdate(
    id,
    {
      lastNotificationAt: sentAt,
      nextRunAt,
    },
    {
      returnDocument: 'after',
    },
  );
};

export const markMissed = async (
  id: string,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndUpdate(
    id,
    {
      status: ReminderStatus.MISSED,
    },
    {
      returnDocument: 'after',
    },
  );
};

// Thin wrapper so external callers (the scheduler) can get the same
// computation createReminder/advanceRepeat use internally, without
// exposing computeNextRun itself or letting callers touch ReminderModel.
export const getNextRunAt = (
  remindAt: Date,
  remindBefore: number[],
  from: Date,
): Date => computeNextRun(remindAt, remindBefore, from);

export const rescheduleReminder = async (
  id: string,
  nextRunAt: Date,
): Promise<ReminderDocument | null> => {
  return ReminderModel.findByIdAndUpdate(
    id,
    {
      nextRunAt,
    },
    {
      returnDocument: 'after',
    },
  );
};

const advanceOnce = (dt: DateTime, reminder: ReminderDocument): DateTime => {
  switch (reminder.repeat) {
    case ReminderRepeatType.DAILY:
      return dt.plus({ days: 1 });
    case ReminderRepeatType.WEEKLY:
      return dt.plus({ weeks: 1 });
    case ReminderRepeatType.MONTHLY:
      return dt.plus({ months: 1 });
    case ReminderRepeatType.YEARLY:
      return dt.plus({ years: 1 });
    case ReminderRepeatType.CUSTOM:
      return dt.plus({ days: reminder.customRepeatDays ?? 1 });
    default:
      return dt;
  }
};

export const advanceRepeat = async (
  reminder: ReminderDocument,
  now: Date,
): Promise<ReminderDocument | null> => {
  if (reminder.repeat === ReminderRepeatType.NONE) {
    return null;
  }

  // Advance in a loop, not a single step: after downtime, a daily reminder
  // must catch up to the current day, not fire dozens of times in a row.
  let next: DateTime = DateTime.fromJSDate(reminder.remindAt, { zone: reminder.timezone });
  do {
    next = advanceOnce(next, reminder);
  } while (next.toJSDate() <= now);

  const remindAt = next.toJSDate();
  const nextRunAt = computeNextRun(remindAt, reminder.remindBefore, now);

  return ReminderModel.findByIdAndUpdate(
    reminder._id,
    {
      $set: { remindAt, nextRunAt, status: ReminderStatus.ACTIVE },
      $unset: { lastNotificationAt: '' },
    },
    {
      returnDocument: 'after',
    },
  );
};
