import { InlineKeyboard } from 'grammy';
import { buildCancelReminderPayload } from '../constants/callbacks.js';

export const createCancelKeyboard = (
  reminderId: string,
  label: string,
): InlineKeyboard => {
  return new InlineKeyboard().text(label, buildCancelReminderPayload(reminderId));
};

export const createRemindersKeyboard = (
  items: Array<{ id: string; label: string }>,
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  items.forEach((item, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(item.label, buildCancelReminderPayload(item.id));
  });

  return keyboard;
};
