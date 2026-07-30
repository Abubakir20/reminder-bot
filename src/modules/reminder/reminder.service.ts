import { Types } from 'mongoose';
import {
  ReminderDocument,
  CreateReminderDto,
  ReminderStatus,
} from './reminder.types.js';
import { ReminderModel } from './reminder.model.js';

export const createReminder = async (
  data: CreateReminderDto,
): Promise<ReminderDocument> => {
  return ReminderModel.create(data);
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