import { ReminderRepeatType } from '../reminder/reminder.types.js';

export interface ParsedReminder {

    title: string;

    remindAt: Date | undefined;

    remindBefore: number[];

    repeat: ReminderRepeatType;

    confidence: number;

    originalText: string;

    ambiguousToken?: string;

    unclear?: 'time' | 'date' | 'ambiguous';
}