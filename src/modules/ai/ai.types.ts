export const AI_REPEAT_VALUES = [
  'NONE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const;

export type AiRepeat = (typeof AI_REPEAT_VALUES)[number];

// Shape the model is asked to return. Date and time come back as local
// wall-clock strings in the user's zone, not ISO — the conversion to UTC
// is done here with luxon rather than trusting the model with zone math.
export interface AiReminderResponse {
  isReminder: boolean;
  title: string;
  date: string | null;
  time: string | null;
  repeat: AiRepeat;
  remindBeforeMinutes: number | null;
}
