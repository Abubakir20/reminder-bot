import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { DateTime } from 'luxon';
import { env } from '../../config/env.js';
import { ReminderRepeatType } from '../reminder/reminder.types.js';
import { AI_REPEAT_VALUES, AiRepeat, AiReminderResponse } from './ai.types.js';
import type { ParsedReminder } from '../parser/parser.types.js';

// A warm connection answers in 1-4s, but the first call after a restart
// goes over a cold TLS handshake and has measured at 5.6-9.4s. 5s would
// silently degrade that first message to the regex result.
const REQUEST_TIMEOUT_MS = 8_000;
const AI_CONFIDENCE = 0.85;
const REMIND_BEFORE_MIN = 1;
const REMIND_BEFORE_MAX = 10080;
const DEFAULT_REMIND_BEFORE = [60];

const SYSTEM_INSTRUCTION = `You extract reminder details from short chat messages written in Uzbek, Russian, or English.

You are given the user's current local time and IANA timezone. Interpret every relative expression ("tomorrow", "keyingi hafta dushanba", "послезавтра", "har oyning birinchi kunida") against that local time.

Rules:
- Return the date as "YYYY-MM-DD" and the time as "HH:mm", both as LOCAL wall-clock values in the user's timezone. Never convert to UTC and never append a timezone offset.
- If the message names a day but no clock time, return the date and set time to null.
- If the message names neither, set both to null.
- "title" is the task itself, with the date/time wording and any command verb ("eslat", "напомни", "remind me") removed. Keep it in the user's original language.
- A weekday name ("chorshanba", "среду", "Wednesday", "Wed") means the NEAREST FUTURE date falling on that weekday, counted from the current local time you were given. Work the date out by counting forward from today — never substitute tomorrow's date. If the named weekday is today and the stated time has not passed yet, use today; if it has already passed, use the same weekday next week.
- "next week" / "keyingi hafta" / "следующая неделя" before a weekday means that weekday of the FOLLOWING calendar week, not the nearest one.
- A weekday combined with a recurrence word ("har hafta chorshanba", "каждую среду", "every Wednesday") is repeat WEEKLY, with the date set to the nearest future occurrence.
- "repeat" describes recurrence: NONE, DAILY, WEEKLY, MONTHLY, or YEARLY. A monthly recurrence may legitimately come with a date (e.g. "har oyning birinchi kunida" -> the first of the month, repeat MONTHLY). For a day-of-month phrase use the nearest future occurrence of that day; if this month's has passed, use next month's.
- "remindBeforeMinutes" is how long BEFORE the deadline the user wants a warning ("2 soat oldin", "за час до", "30 minutes before"). Use null when the message doesn't ask for one.
- If the message is not a request to be reminded of anything (a greeting, small talk, a question), set isReminder to false and leave the other fields at their neutral values.

Reply with JSON only. No markdown fences, no commentary.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isReminder: { type: 'boolean' },
    title: { type: 'string' },
    date: { type: 'string', nullable: true },
    time: { type: 'string', nullable: true },
    repeat: { type: 'string', enum: [...AI_REPEAT_VALUES] },
    remindBeforeMinutes: { type: 'integer', nullable: true },
  },
  required: ['isReminder', 'title', 'date', 'time', 'repeat', 'remindBeforeMinutes'],
};

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const QUOTA_EXCEEDED_STATUS = 429;
const RETRY_INFO_TYPE = 'type.googleapis.com/google.rpc.RetryInfo';

interface ApiErrorPayload {
  error?: {
    details?: Array<{ '@type'?: string; retryDelay?: string }>;
  };
}

// The SDK packs the whole error payload into the message as JSON; the
// retry hint lives in a RetryInfo entry inside its details array.
const extractRetryDelay = (message: string): string | undefined => {
  try {
    const payload = JSON.parse(message) as ApiErrorPayload;
    return payload.error?.details?.find((d) => d['@type'] === RETRY_INFO_TYPE)?.retryDelay;
  } catch {
    return undefined;
  }
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Accepts HH:mm and HH:mm:ss — the seconds variant is a format the model
// occasionally emits for the same value, not a different value.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

const isValidDate = (date: string, timezone: string): boolean => {
  if (!DATE_PATTERN.test(date)) return false;

  // Round-trip catches real-looking but nonexistent dates like 2026-02-31.
  const dt = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: timezone });
  return dt.isValid && dt.toFormat('yyyy-MM-dd') === date;
};

const toRepeatType = (repeat: AiRepeat): ReminderRepeatType =>
  ReminderRepeatType[repeat];

const buildRemindAt = (date: string, time: string, timezone: string): Date | null => {
  const hhmm = time.slice(0, 5);
  const dt = DateTime.fromFormat(`${date} ${hhmm}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
  return dt.isValid ? dt.toJSDate() : null;
};

const toParsedReminder = (
  payload: AiReminderResponse,
  text: string,
  timezone: string,
): ParsedReminder | null => {
  if (!AI_REPEAT_VALUES.includes(payload.repeat)) {
    console.error(`[AI] discarded response: repeat not in enum (${String(payload.repeat)})`);
    return null;
  }

  // null is an allowed value for this field — only a present-but-out-of-range
  // number is a reason to reject the whole answer.
  const { remindBeforeMinutes } = payload;
  if (
    remindBeforeMinutes !== null &&
    (!Number.isInteger(remindBeforeMinutes) ||
      remindBeforeMinutes < REMIND_BEFORE_MIN ||
      remindBeforeMinutes > REMIND_BEFORE_MAX)
  ) {
    console.error(`[AI] discarded response: remindBeforeMinutes out of range (${String(remindBeforeMinutes)})`);
    return null;
  }

  if (payload.date !== null && !isValidDate(payload.date, timezone)) {
    console.error(`[AI] discarded response: bad date (${String(payload.date)})`);
    return null;
  }

  if (payload.time !== null && !TIME_PATTERN.test(payload.time)) {
    console.error(`[AI] discarded response: bad time (${String(payload.time)})`);
    return null;
  }

  const base = {
    title: payload.title.trim(),
    originalText: text,
    remindBefore: remindBeforeMinutes === null ? DEFAULT_REMIND_BEFORE : [remindBeforeMinutes],
    repeat: toRepeatType(payload.repeat),
  };

  if (payload.date !== null && payload.time !== null) {
    const remindAt = buildRemindAt(payload.date, payload.time, timezone);
    if (!remindAt) {
      console.error(`[AI] discarded response: could not build remindAt from ${payload.date} ${payload.time}`);
      return null;
    }
    return { ...base, remindAt, confidence: AI_CONFIDENCE };
  }

  // A day without a clock time isn't actionable — ask the user for the time.
  return { ...base, remindAt: undefined, confidence: AI_CONFIDENCE, unclear: 'time' };
};

export const parseWithGemini = async (
  text: string,
  now: Date,
  timezone: string,
): Promise<ParsedReminder | null> => {
  const localNow = DateTime.fromJSDate(now, { zone: timezone }).toFormat('yyyy-MM-dd HH:mm');
  const prompt = `Current local time: ${localNow}\nTimezone: ${timezone}\nMessage: ${text}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // Extracting fields from one short sentence needs no deep reasoning,
        // and this measurably cuts latency.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: controller.signal,
      },
    });

    const raw = response.text;

    if (!raw || raw.trim().length === 0) {
      console.error('[AI] discarded response: empty response text');
      return null;
    }

    let payload: AiReminderResponse;
    try {
      payload = JSON.parse(raw) as AiReminderResponse;
    } catch (parseError) {
      console.error('[AI] discarded response: invalid JSON:', parseError);
      return null;
    }

    if (payload.isReminder === false) {
      return {
        title: text,
        originalText: text,
        remindAt: undefined,
        remindBefore: DEFAULT_REMIND_BEFORE,
        repeat: ReminderRepeatType.NONE,
        confidence: 0.1,
      };
    }

    return toParsedReminder(payload, text, timezone);
  } catch (error) {
    if (controller.signal.aborted) {
      console.error(`[AI] request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    } else if (error instanceof ApiError && error.status === QUOTA_EXCEEDED_STATUS) {
      // Quota exhaustion is an expected operating condition, not a defect —
      // one line, no stack trace.
      const retryDelay = extractRetryDelay(error.message);
      console.error(
        `[AI] quota exceeded (429) for model ${env.GEMINI_MODEL}` +
          (retryDelay ? `, retry after ${retryDelay}` : ''),
      );
    } else {
      console.error('[AI] request failed:', error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
};
