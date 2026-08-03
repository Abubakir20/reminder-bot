import { InlineKeyboard } from 'grammy';
import {
  buildCancelReminderPayload,
  buildEditReminderPayload,
} from '../constants/callbacks.js';

export interface ReminderKeyboardItem {
  id: string;
  label: string;
}

export const createCancelKeyboard = (
  reminderId: string,
  label: string,
): InlineKeyboard => {
  return new InlineKeyboard().text(label, buildCancelReminderPayload(reminderId));
};

// One button per row, so long reminder lists stay readable.
const createIdListKeyboard = (
  items: ReminderKeyboardItem[],
  buildPayload: (id: string) => string,
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  items.forEach((item, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(item.label, buildPayload(item.id));
  });

  return keyboard;
};

export const createRemindersKeyboard = (items: ReminderKeyboardItem[]): InlineKeyboard =>
  createIdListKeyboard(items, buildCancelReminderPayload);

export const createEditListKeyboard = (items: ReminderKeyboardItem[]): InlineKeyboard =>
  createIdListKeyboard(items, buildEditReminderPayload);
