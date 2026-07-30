import { ParsedReminder } from './parser.types.js';
import { ReminderRepeatType } from '../reminder/reminder.types.js';

export const parse = (text: string): ParsedReminder => {
  const lowerText = text.toLowerCase();

  let repeat: ReminderRepeatType = ReminderRepeatType.NONE;

  if (lowerText.includes('har kuni')) {
    repeat = ReminderRepeatType.DAILY;
  }

  if (lowerText.includes('har hafta')) {
    repeat = ReminderRepeatType.WEEKLY;
  }

  if (lowerText.includes('har oy')) {
    repeat = ReminderRepeatType.MONTHLY;
  }

  return {
    title: text,
    originalText: text,
    remindAt: undefined,
    remindBefore: [60],
    repeat,
    confidence: 0.2,
  };
};
