import { DateTime } from 'luxon';
import { ParsedReminder } from './parser.types.js';
import { ReminderRepeatType } from '../reminder/reminder.types.js';
import { parseWithGemini } from '../ai/ai.service.js';

interface MatchRange {
  start: number;
  end: number;
}

interface DayMatch {
  offset: 0 | 1 | 2;
  range: MatchRange;
}

interface ClockMatch {
  hour: number;
  minute: number;
  range: MatchRange;
}

interface RelativeMatch {
  totalMinutes: number;
  range: MatchRange;
}

interface RemindBeforeMatch {
  minutes: number;
  range: MatchRange;
}

interface RepeatMatch {
  repeat: ReminderRepeatType;
  range: MatchRange;
}

interface CalendarDateMatch {
  day: number;
  month: number;
  year: number | undefined;
  range: MatchRange;
}

interface WeekdayMatch {
  weekday: number; // luxon convention: 1 = Monday ... 7 = Sunday
  nextWeek: boolean;
  range: MatchRange;
}

interface MonthDayMatch {
  day: number;
  range: MatchRange;
}

interface YearlyDateMatch {
  month: number;
  day: number;
  range: MatchRange;
}

const TITLE_MAX_LENGTH = 100;

const BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}])';
const BOUNDARY_AFTER = '(?![\\p{L}\\p{N}])';

const bounded = (pattern: string): RegExp =>
  new RegExp(`${BOUNDARY_BEFORE}${pattern}${BOUNDARY_AFTER}`, 'iu');

const toRange = (match: RegExpExecArray): MatchRange => ({
  start: match.index,
  end: match.index + match[0].length,
});

const maskRange = (text: string, range: MatchRange): string =>
  text.slice(0, range.start) + ' '.repeat(range.end - range.start) + text.slice(range.end);

const DAY_MARKERS: Array<{ regex: RegExp; offset: 0 | 1 | 2 }> = [
  { regex: bounded('bugun'), offset: 0 },
  { regex: bounded('ertaga'), offset: 1 },
  { regex: bounded('indinga'), offset: 2 },
  { regex: bounded('сегодня'), offset: 0 },
  { regex: bounded('завтра'), offset: 1 },
  { regex: bounded('послезавтра'), offset: 2 },
  { regex: bounded('today'), offset: 0 },
  { regex: bounded('tomorrow'), offset: 1 },
];

const matchDayMarker = (text: string): DayMatch | null => {
  for (const { regex, offset } of DAY_MARKERS) {
    const match = regex.exec(text);
    if (match) {
      return { offset, range: toRange(match) };
    }
  }
  return null;
};

// --- weekdays ---

const WEEKDAY_NAMES: Array<[string, number]> = [
  ['dushanba', 1], ['seshanba', 2], ['chorshanba', 3], ['payshanba', 4],
  ['juma', 5], ['shanba', 6], ['yakshanba', 7],

  ['понедельника', 1], ['понедельник', 1],
  ['вторника', 2], ['вторник', 2],
  ['среду', 3], ['среды', 3], ['среда', 3],
  ['четверга', 4], ['четверг', 4],
  ['пятницу', 5], ['пятницы', 5], ['пятница', 5],
  ['субботу', 6], ['субботы', 6], ['суббота', 6],
  ['воскресенья', 7], ['воскресенье', 7],

  ['monday', 1], ['mon', 1],
  ['tuesday', 2], ['tue', 2],
  ['wednesday', 3], ['wed', 3],
  ['thursday', 4], ['thu', 4],
  ['friday', 5], ['fri', 5],
  ['saturday', 6], ['sat', 6],
  ['sunday', 7], ['sun', 7],
];

const WEEKDAY_LOOKUP = new Map<string, number>(WEEKDAY_NAMES);
// Longest first so "shanba" cannot win over "yakshanba", nor "mon" over "monday".
const WEEKDAY_ALTERNATION = [...WEEKDAY_NAMES]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([name]) => name)
  .join('|');

const NEXT_WEEK_ALTERNATION = "keyingi\\s+hafta|следующ\\S*\\s+недел\\S*|next\\s+week";

// captures: 1 = "next week" marker (optional), 2 = weekday name
const WEEKDAY_REGEX = bounded(
  `(?:(${NEXT_WEEK_ALTERNATION})\\s+)?(${WEEKDAY_ALTERNATION})(?:\\s+kuni)?`,
);

const matchWeekday = (text: string): WeekdayMatch | null => {
  const match = WEEKDAY_REGEX.exec(text);
  if (!match) return null;

  const weekday = WEEKDAY_LOOKUP.get(match[2].toLowerCase());
  if (!weekday) return null;

  return { weekday, nextWeek: match[1] !== undefined, range: toRange(match) };
};

// --- day of month with a monthly recurrence ---

const APOSTROPHE = "['’]";

const ORDINAL_WORDS: Array<[string, number]> = [
  ['birinchi', 1], ['ikkinchi', 2], ['uchinchi', 3], ['beshinchi', 5],
  ['oltinchi', 6], ['yettinchi', 7], ['sakkizinchi', 8],

  ['первого', 1], ['второго', 2], ['третьего', 3], ['пятого', 5],
  ['шестого', 6], ['седьмого', 7], ['восьмого', 8], ['девятого', 9],
  ['десятого', 10], ['пятнадцатого', 15], ['четвертого', 4], ['четвёртого', 4],
];

// Written with an apostrophe class so both ' and ’ are accepted. Compound
// forms come first so "o'n ikkinchi" cannot lose to a shorter alternative.
const APOSTROPHE_ORDINALS: Array<[string, number]> = [
  [`o${APOSTROPHE}n\\s+ikkinchi`, 12],
  [`o${APOSTROPHE}n\\s+birinchi`, 11],
  [`to${APOSTROPHE}qqizinchi`, 9],
  [`to${APOSTROPHE}rtinchi`, 4],
  [`o${APOSTROPHE}ninchi`, 10],
];

const normalizeOrdinal = (word: string): string =>
  word.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');

const ORDINAL_LOOKUP = new Map<string, number>([
  ...ORDINAL_WORDS,
  ["to'rtinchi", 4],
  ["to'qqizinchi", 9],
  ["o'ninchi", 10],
  ["o'n birinchi", 11],
  ["o'n ikkinchi", 12],
]);

const ORDINAL_ALTERNATION = [
  ...APOSTROPHE_ORDINALS.map(([pattern]) => pattern),
  ...[...ORDINAL_WORDS].sort((a, b) => b[0].length - a[0].length).map(([word]) => word),
].join('|');

const dayFromMatch = (digits: string | undefined, word: string | undefined): number | null => {
  if (digits !== undefined) {
    const day = Number(digits);
    return day >= 1 && day <= 31 ? day : null;
  }
  if (word !== undefined) {
    return ORDINAL_LOOKUP.get(normalizeOrdinal(word)) ?? null;
  }
  return null;
};

// Every pattern here already carries its own "monthly" wording, so a match
// implies MONTHLY and the whole phrase is cut from the title.
const MONTH_DAY_PATTERNS: Array<{ regex: RegExp; digits: number; word: number }> = [
  {
    // har oyning birinchi kunida / har oyning 15-kunida / har oy 1-sanada
    regex: bounded(
      `har\\s+oy(?:ning|da)?\\s+(?:(\\d{1,2})\\s*-?\\s*|(${ORDINAL_ALTERNATION})\\s+)(?:kunida|kunlari|kuni|sanada|sanasida|sana)`,
    ),
    digits: 1,
    word: 2,
  },
  {
    // первого числа каждого месяца / 15 числа каждого месяца
    regex: bounded(
      `(?:(\\d{1,2})|(${ORDINAL_ALTERNATION}))\\s+числ[аоу]\\s+кажд\\S+\\s+месяца`,
    ),
    digits: 1,
    word: 2,
  },
  {
    // каждое 1 число / каждого 15 числа
    regex: bounded(`кажд\\S+\\s+(?:(\\d{1,2})|(${ORDINAL_ALTERNATION}))\\s+числ[аоу]`),
    digits: 1,
    word: 2,
  },
  {
    // on the 1st of every month
    regex: bounded(`(?:on\\s+the\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\s+of\\s+(?:every|each)\\s+month`),
    digits: 1,
    word: 2,
  },
  {
    // every month on the 15th
    regex: bounded(
      `(?:every|each)\\s+month\\s+(?:on\\s+the\\s+)?(\\d{1,2})(?:st|nd|rd|th)`,
    ),
    digits: 1,
    word: 2,
  },
];

const matchMonthDay = (text: string): MonthDayMatch | null => {
  for (const { regex, digits, word } of MONTH_DAY_PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;

    const day = dayFromMatch(match[digits], match[word]);
    if (day !== null) {
      return { day, range: toRange(match) };
    }
  }
  return null;
};

// Colon form is always safe (unconditional). Space form requires a trailing
// "da" as its anchor — without it, "buy 2 4 apples" would misparse as 2:04.
const DIGIT_CLOCK_REGEX = bounded(
  "(?:([01]?\\d|2[0-3]):([0-5]\\d)(?:\\s*da)?|([01]?\\d|2[0-3])\\s+([0-5]\\d)\\s*da)",
);
const AM_PM_REGEX = bounded('([01]?\\d)\\s*(am|pm)');
// soat / в / at, followed by the hour and an optional minute — the minute
// separator accepts ':', '.', or a bare space (e.g. "soat 11 00 da").
const KEYWORD_TIME_REGEX = bounded(
  "(?:soat|в|at)\\s+([01]?\\d|2[0-3])(?:[\\s:.]([0-5]\\d))?\\s*(?:da)?",
);

const matchClockTime = (text: string): ClockMatch | null => {
  // Keyword-anchored formats are tried first: they're more specific than the
  // bare digit pattern, which would otherwise match just the "09:20" part of
  // "soat 09:20 da" and leave "soat" dangling as an orphan word.
  const keywordMatch = KEYWORD_TIME_REGEX.exec(text);
  if (keywordMatch) {
    return {
      hour: Number(keywordMatch[1]),
      minute: keywordMatch[2] ? Number(keywordMatch[2]) : 0,
      range: toRange(keywordMatch),
    };
  }

  const amPmMatch = AM_PM_REGEX.exec(text);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const period = amPmMatch[2].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { hour, minute: 0, range: toRange(amPmMatch) };
  }

  const digitMatch = DIGIT_CLOCK_REGEX.exec(text);
  if (digitMatch) {
    const hour = digitMatch[1] ?? digitMatch[3];
    const minute = digitMatch[2] ?? digitMatch[4];
    return { hour: Number(hour), minute: Number(minute), range: toRange(digitMatch) };
  }

  return null;
};

// Unit spellings are shared between the "deadline" patterns below and the
// "lead time" ones further down, so a synonym only has to be added once.
// Longest spelling first so a shorter one can't win on a prefix.
const UZ_HOUR_UNIT = '(?:soatlik|soat)';
const UZ_MINUTE_UNIT = '(?:daqiqa|minutlik|minut|min|daq)';
const RU_HOUR_UNIT = '(?:час(?:а|ов)?)';
const RU_MINUTE_UNIT = '(?:минуту|минуты|минут|мин)';
const EN_HOUR_UNIT = '(?:hours|hour|hrs|hr)';
const EN_MINUTE_UNIT = '(?:minutes|minute|mins|min)';

const UZ_HOURS_REGEX = bounded(`(\\d+)\\s*${UZ_HOUR_UNIT}dan\\s+keyin`);
const UZ_MINUTES_REGEX = bounded(`(\\d+)\\s*${UZ_MINUTE_UNIT}dan\\s+keyin`);
const RU_HOURS_REGEX = bounded(`через\\s+(\\d+)\\s*${RU_HOUR_UNIT}`);
const RU_MINUTES_REGEX = bounded(`через\\s+(\\d+)\\s*${RU_MINUTE_UNIT}`);
const EN_HOURS_REGEX = bounded(`in\\s+(\\d+)\\s*${EN_HOUR_UNIT}`);
const EN_MINUTES_REGEX = bounded(`in\\s+(\\d+)\\s*${EN_MINUTE_UNIT}`);

const matchRelativeTime = (text: string): RelativeMatch | null => {
  const hourMatches = [UZ_HOURS_REGEX, RU_HOURS_REGEX, EN_HOURS_REGEX];
  for (const regex of hourMatches) {
    const match = regex.exec(text);
    if (match) {
      return { totalMinutes: Number(match[1]) * 60, range: toRange(match) };
    }
  }

  const minuteMatches = [UZ_MINUTES_REGEX, RU_MINUTES_REGEX, EN_MINUTES_REGEX];
  for (const regex of minuteMatches) {
    const match = regex.exec(text);
    if (match) {
      return { totalMinutes: Number(match[1]), range: toRange(match) };
    }
  }

  return null;
};

// "Oldin"/"до"/"before" mark a lead-time (warn N before the deadline), as
// opposed to "keyin"/"через"/"in" which mark the deadline itself. These are
// checked (and masked) before matchRelativeTime so "2 soat oldin" can never
// be misread as "2 soatdan keyin" losing the "oldin" and leaking into remindAt.
const UZ_REMIND_BEFORE_HOURS_REGEX = bounded(`(?:(\\d+)\\s*)?${UZ_HOUR_UNIT}\\s+oldin`);
const UZ_REMIND_BEFORE_MINUTES_REGEX = bounded(`(\\d+)\\s*${UZ_MINUTE_UNIT}\\s+oldin`);
const RU_REMIND_BEFORE_HOURS_REGEX = bounded(
  `(?:предупреди\\s+)?за\\s+(?:(\\d+)\\s*)?${RU_HOUR_UNIT}(?:\\s+до)?`,
);
const RU_REMIND_BEFORE_MINUTES_REGEX = bounded(
  `(?:предупреди\\s+)?за\\s+(\\d+)\\s*${RU_MINUTE_UNIT}(?:\\s+до)?`,
);
const EN_REMIND_BEFORE_HOURS_REGEX = bounded(
  `(?:remind\\s+me\\s+)?(?:(\\d+)\\s*)?${EN_HOUR_UNIT}\\s+before`,
);
const EN_REMIND_BEFORE_MINUTES_REGEX = bounded(
  `(?:remind\\s+me\\s+)?(\\d+)\\s*${EN_MINUTE_UNIT}\\s+before`,
);

const matchRemindBefore = (text: string): RemindBeforeMatch | null => {
  const hourMatches = [
    UZ_REMIND_BEFORE_HOURS_REGEX,
    RU_REMIND_BEFORE_HOURS_REGEX,
    EN_REMIND_BEFORE_HOURS_REGEX,
  ];
  for (const regex of hourMatches) {
    const match = regex.exec(text);
    if (match) {
      const amount = match[1] ? Number(match[1]) : 1;
      return { minutes: amount * 60, range: toRange(match) };
    }
  }

  const minuteMatches = [
    UZ_REMIND_BEFORE_MINUTES_REGEX,
    RU_REMIND_BEFORE_MINUTES_REGEX,
    EN_REMIND_BEFORE_MINUTES_REGEX,
  ];
  for (const regex of minuteMatches) {
    const match = regex.exec(text);
    if (match) {
      return { minutes: Number(match[1]), range: toRange(match) };
    }
  }

  return null;
};

const REMIND_BEFORE_MIN_MINUTES = 1;
const REMIND_BEFORE_MAX_MINUTES = 10080; // 7 days
const DEFAULT_REMIND_BEFORE = [60];

// Each period carries the same four shapes in every language: "har X",
// "каждый X", the single-word adverb, and "every/each X".
const REPEAT_MARKERS: Array<{ regex: RegExp; repeat: ReminderRepeatType }> = [
  {
    regex: bounded(
      '(?:har\\s+kuni|каждый\\s+день|ежедневно|(?:every|each)\\s+day|daily)',
    ),
    repeat: ReminderRepeatType.DAILY,
  },
  {
    // The weekday-qualified forms ("каждую среду", "every Wednesday") match
    // only the determiner via lookahead — the weekday itself belongs to
    // matchWeekday, and letting both claim it would overlap their ranges.
    regex: bounded(
      '(?:har\\s+hafta(?:ning|da)?|каждую\\s+неделю|еженедельно|(?:every|each)\\s+week|weekly' +
        `|(?:кажд\\S+)(?=\\s+(?:${WEEKDAY_ALTERNATION}))` +
        `|(?:every|each)(?=\\s+(?:${WEEKDAY_ALTERNATION}))` +
        `|har(?=\\s+(?:${WEEKDAY_ALTERNATION}))` +
        ')',
    ),
    repeat: ReminderRepeatType.WEEKLY,
  },
  {
    regex: bounded(
      '(?:har\\s+oy(?:ning|da)?|каждый\\s+месяц|ежемесячно|(?:every|each)\\s+month|monthly)',
    ),
    repeat: ReminderRepeatType.MONTHLY,
  },
  {
    regex: bounded(
      '(?:har\\s+yili|каждый\\s+год|ежегодно|(?:every|each)\\s+year|annually|yearly)',
    ),
    repeat: ReminderRepeatType.YEARLY,
  },
];

const matchRepeat = (text: string): RepeatMatch | null => {
  for (const { regex, repeat } of REPEAT_MARKERS) {
    const match = regex.exec(text);
    if (match) {
      return { repeat, range: toRange(match) };
    }
  }
  return null;
};

// --- Calendar dates ---

const UZ_MONTHS: Array<[string, number]> = [
  ['yanvar', 1], ['fevral', 2], ['mart', 3], ['aprel', 4], ['may', 5], ['iyun', 6],
  ['iyul', 7], ['avgust', 8], ['sentyabr', 9], ['oktyabr', 10], ['noyabr', 11], ['dekabr', 12],
];

const RU_MONTHS: Array<[string, number]> = [
  ['январь', 1], ['января', 1],
  ['февраль', 2], ['февраля', 2],
  ['март', 3], ['марта', 3],
  ['апрель', 4], ['апреля', 4],
  ['май', 5], ['мая', 5],
  ['июнь', 6], ['июня', 6],
  ['июль', 7], ['июля', 7],
  ['август', 8], ['августа', 8],
  ['сентябрь', 9], ['сентября', 9],
  ['октябрь', 10], ['октября', 10],
  ['ноябрь', 11], ['ноября', 11],
  ['декабрь', 12], ['декабря', 12],
];

const EN_MONTHS: Array<[string, number]> = [
  ['january', 1], ['jan', 1],
  ['february', 2], ['feb', 2],
  ['march', 3], ['mar', 3],
  ['april', 4], ['apr', 4],
  ['may', 5],
  ['june', 6], ['jun', 6],
  ['july', 7], ['jul', 7],
  ['august', 8], ['aug', 8],
  ['september', 9], ['sep', 9],
  ['october', 10], ['oct', 10],
  ['november', 11], ['nov', 11],
  ['december', 12], ['dec', 12],
];

const ALL_MONTHS: Array<[string, number]> = [...UZ_MONTHS, ...RU_MONTHS, ...EN_MONTHS];
const MONTH_LOOKUP = new Map<string, number>(ALL_MONTHS);
const MONTH_ALTERNATION = ALL_MONTHS.map(([name]) => name).join('|');

const DAY_NUM_PATTERN = '(0?[1-9]|[12]\\d|3[01])';
const MONTH_NUM_PATTERN = '(0?[1-9]|1[0-2])';
const YEAR_PATTERN = '(\\d{4})';
const MONTH_SUFFIX = '(?:da|ga|dan|gacha)?';

// uz: 9-chi/9-i/9-si avgust ; ru: 9-е/9-ое/9го августа
const ORDINAL_SUFFIX_ALTERNATION = 'chi|si|i|го|ое|е';
const HYPHEN_SEP = '\\s*-\\s*';

// captures: 1=day, 2=month word (no suffix), 3=year?
// Day and month may be joined by a hyphen (with or without surrounding
// spaces) or plain whitespace, optionally with an ordinal suffix on the day
// ("9-chi avgust", "9го августа") and/or a trailing "kuni".
const DAY_MONTH_NAME_REGEX = bounded(
  `${DAY_NUM_PATTERN}(?:(?:${HYPHEN_SEP}|\\s*)(?:${ORDINAL_SUFFIX_ALTERNATION})\\s+|(?:${HYPHEN_SEP}|\\s+))` +
    `(${MONTH_ALTERNATION})${MONTH_SUFFIX}(?:\\s+(?:kuni|числа))?(?:,?\\s+${YEAR_PATTERN})?`,
);
// captures: 1=month word (no suffix), 2=day, 3=year?
// Day may carry an English ordinal suffix: "August 9th", "Aug 9th".
const MONTH_NAME_DAY_REGEX = bounded(
  `(${MONTH_ALTERNATION})${MONTH_SUFFIX}\\s+${DAY_NUM_PATTERN}(?:st|nd|rd|th)?(?:,?\\s+${YEAR_PATTERN})?`,
);
// captures: 1=day, 2=month word, 3=year? — "9th of August" (ordinal mandatory,
// otherwise "9 of August" isn't a natural date expression).
const EN_DAY_OF_MONTH_REGEX = bounded(
  `${DAY_NUM_PATTERN}(?:st|nd|rd|th)\\s+of\\s+(${MONTH_ALTERNATION})${MONTH_SUFFIX}(?:,?\\s+${YEAR_PATTERN})?`,
);
// captures: 1=year, 2=month, 3=day
const ISO_DATE_REGEX = bounded(`${YEAR_PATTERN}-${MONTH_NUM_PATTERN}-${DAY_NUM_PATTERN}`);

const matchCalendarDate = (text: string): CalendarDateMatch | null => {
  const isoMatch = ISO_DATE_REGEX.exec(text);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
      range: toRange(isoMatch),
    };
  }

  const dayMonthMatch = DAY_MONTH_NAME_REGEX.exec(text);
  if (dayMonthMatch) {
    const month = MONTH_LOOKUP.get(dayMonthMatch[2].toLowerCase());
    if (month) {
      return {
        day: Number(dayMonthMatch[1]),
        month,
        year: dayMonthMatch[3] ? Number(dayMonthMatch[3]) : undefined,
        range: toRange(dayMonthMatch),
      };
    }
  }

  const monthDayMatch = MONTH_NAME_DAY_REGEX.exec(text);
  if (monthDayMatch) {
    const month = MONTH_LOOKUP.get(monthDayMatch[1].toLowerCase());
    if (month) {
      return {
        day: Number(monthDayMatch[2]),
        month,
        year: monthDayMatch[3] ? Number(monthDayMatch[3]) : undefined,
        range: toRange(monthDayMatch),
      };
    }
  }

  const dayOfMatch = EN_DAY_OF_MONTH_REGEX.exec(text);
  if (dayOfMatch) {
    const month = MONTH_LOOKUP.get(dayOfMatch[2].toLowerCase());
    if (month) {
      return {
        day: Number(dayOfMatch[1]),
        month,
        year: dayOfMatch[3] ? Number(dayOfMatch[3]) : undefined,
        range: toRange(dayOfMatch),
      };
    }
  }

  return null;
};

// --- yearly recurrence with an explicit month and day ---

const monthFromName = (name: string | undefined): number | null => {
  if (name === undefined) return null;
  return MONTH_LOOKUP.get(name.toLowerCase()) ?? null;
};

const monthFromOrdinal = (digits: string | undefined, word: string | undefined): number | null => {
  const month = dayFromMatch(digits, word);
  return month !== null && month >= 1 && month <= 12 ? month : null;
};

type YearlyExtractor = (match: RegExpExecArray) => { month: number; day: number } | null;

const YEARLY_PATTERNS: Array<{ regex: RegExp; extract: YearlyExtractor }> = [
  {
    // har yilning birinchi oyining 2-kuni / har yilning 8-oyining 15-kunida
    regex: bounded(
      `har\\s+yil(?:ning|da)?\\s+(?:(\\d{1,2})\\s*-?\\s*|(${ORDINAL_ALTERNATION})\\s+)` +
        `oy(?:ining|ning|ida|i|da)?\\s+(?:(\\d{1,2})\\s*-?\\s*|(${ORDINAL_ALTERNATION})\\s+)` +
        `kun(?:ida|lari|i)?`,
    ),
    extract: (m) => {
      const month = monthFromOrdinal(m[1], m[2]);
      const day = dayFromMatch(m[3], m[4]);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
  {
    // har yil 2-yanvarda / har yilning 5-mart kuni
    regex: bounded(
      `har\\s+yil(?:ning|da)?\\s+(\\d{1,2})\\s*-?\\s*(${MONTH_ALTERNATION})` +
        `(?:da|ga|dan|gacha)?(?:\\s+kun(?:ida|i)?)?`,
    ),
    extract: (m) => {
      const month = monthFromName(m[2]);
      const day = dayFromMatch(m[1], undefined);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
  {
    // каждый год 2 января
    regex: bounded(
      `кажд\\S+\\s+год\\S*\\s+(?:(\\d{1,2})|(${ORDINAL_ALTERNATION}))\\s+(${MONTH_ALTERNATION})`,
    ),
    extract: (m) => {
      const month = monthFromName(m[3]);
      const day = dayFromMatch(m[1], m[2]);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
  {
    // второго января каждого года
    regex: bounded(
      `(?:(\\d{1,2})|(${ORDINAL_ALTERNATION}))\\s+(${MONTH_ALTERNATION})\\s+кажд\\S+\\s+года`,
    ),
    extract: (m) => {
      const month = monthFromName(m[3]);
      const day = dayFromMatch(m[1], m[2]);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
  {
    // every year on January 2
    regex: bounded(
      `(?:every|each)\\s+year\\s+(?:on\\s+(?:the\\s+)?)?(${MONTH_ALTERNATION})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    ),
    extract: (m) => {
      const month = monthFromName(m[1]);
      const day = dayFromMatch(m[2], undefined);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
  {
    // on the 2nd of January every year
    regex: bounded(
      `(?:on\\s+the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(${MONTH_ALTERNATION})\\s+(?:every|each)\\s+year`,
    ),
    extract: (m) => {
      const month = monthFromName(m[2]);
      const day = dayFromMatch(m[1], undefined);
      return month !== null && day !== null ? { month, day } : null;
    },
  },
];

const matchYearlyDate = (text: string): YearlyDateMatch | null => {
  for (const { regex, extract } of YEARLY_PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;

    const parsed = extract(match);
    if (parsed) {
      return { ...parsed, range: toRange(match) };
    }
  }
  return null;
};

// --- remindAt builders ---

const buildAbsoluteRemindAt = (
  now: Date,
  timezone: string,
  dayOffset: number,
  hour: number,
  minute: number,
  dayExplicit: boolean,
): Date => {
  const nowInZone = DateTime.fromJSDate(now, { zone: timezone });
  let candidate = nowInZone.set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });

  if (dayExplicit) {
    candidate = candidate.plus({ days: dayOffset });
  } else if (candidate <= nowInZone) {
    candidate = candidate.plus({ days: 1 });
  }

  return candidate.toJSDate();
};

const buildRelativeRemindAt = (
  now: Date,
  timezone: string,
  totalMinutes: number,
): Date => {
  return DateTime.fromJSDate(now, { zone: timezone })
    .plus({ minutes: totalMinutes })
    .toJSDate();
};

const buildCalendarRemindAt = (
  now: Date,
  timezone: string,
  calendarMatch: CalendarDateMatch,
  hour: number,
  minute: number,
): Date => {
  const nowInZone = DateTime.fromJSDate(now, { zone: timezone });
  const year = calendarMatch.year ?? nowInZone.year;

  let candidate = nowInZone.set({
    year,
    month: calendarMatch.month,
    day: calendarMatch.day,
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });

  // Only roll to next year when the year was inferred (not explicit) and the
  // resulting moment has already passed. An explicit date/time is taken as-is
  // — no "already passed, push forward" rollover for explicit dates.
  if (calendarMatch.year === undefined && candidate <= nowInZone) {
    candidate = candidate.plus({ years: 1 });
  }

  return candidate.toJSDate();
};

const buildWeekdayRemindAt = (
  now: Date,
  timezone: string,
  weekday: number,
  hour: number,
  minute: number,
  nextWeek: boolean,
): Date => {
  const nowInZone = DateTime.fromJSDate(now, { zone: timezone });
  const atTime = (dt: DateTime): DateTime =>
    dt.set({ hour, minute, second: 0, millisecond: 0 });

  if (nextWeek) {
    // Anchored to the start of next week rather than "now + 7 days", so
    // "next week Monday" means that week's Monday no matter which day it
    // is said on. startOf('week') is Monday-based.
    const weekStart = nowInZone.plus({ weeks: 1 }).startOf('week');
    return atTime(weekStart.plus({ days: weekday - 1 })).toJSDate();
  }

  const daysAhead = (weekday - nowInZone.weekday + 7) % 7;
  let candidate = atTime(nowInZone.plus({ days: daysAhead }));

  // Same weekday as today but the time has passed — take next week's.
  if (candidate <= nowInZone) {
    candidate = candidate.plus({ weeks: 1 });
  }

  return candidate.toJSDate();
};

const buildYearlyRemindAt = (
  now: Date,
  timezone: string,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date => {
  const nowInZone = DateTime.fromJSDate(now, { zone: timezone });

  // Built from an explicit year rather than by adding a year to a candidate:
  // 29 February only exists in leap years, and the day is clamped to the
  // month's real length so a non-leap year lands on the 28th.
  const at = (year: number): DateTime => {
    const base = DateTime.fromObject(
      { year, month, day: 1, hour, minute, second: 0, millisecond: 0 },
      { zone: timezone },
    );
    return base.set({ day: Math.min(day, base.daysInMonth ?? 28) });
  };

  const candidate = at(nowInZone.year);

  return candidate > nowInZone ? candidate.toJSDate() : at(nowInZone.year + 1).toJSDate();
};

const buildMonthDayRemindAt = (
  now: Date,
  timezone: string,
  day: number,
  hour: number,
  minute: number,
): Date => {
  const nowInZone = DateTime.fromJSDate(now, { zone: timezone });

  // Clamped explicitly: luxon's set({ day }) rolls a 31st in February over
  // into March instead of clamping, which would silently move the reminder
  // into the wrong month.
  const atDay = (base: DateTime): DateTime =>
    base.set({
      day: Math.min(day, base.daysInMonth ?? 28),
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

  const candidate = atDay(nowInZone);

  return candidate > nowInZone
    ? candidate.toJSDate()
    : atDay(nowInZone.plus({ months: 1 })).toJSDate();
};

// --- title extraction & cleanup ---

// Articles are stripped alongside prepositions: removing a date expression
// like "the 31st of July" leaves the article stranded at the edge.
const PREPOSITION_WORDS = [
  'at', 'on', 'in', 'by', 'a', 'an', 'the',
  'da', 'ga', 'gacha', 'kuni',
  'в', 'во', 'на', 'к',
];
const PREPOSITION_ALTERNATION = PREPOSITION_WORDS.join('|');

const TRAILING_PREPOSITION_REGEX = new RegExp(
  `${BOUNDARY_BEFORE}(?:${PREPOSITION_ALTERNATION})\\s*$`,
  'iu',
);
const LEADING_PREPOSITION_REGEX = new RegExp(
  `^\\s*(?:${PREPOSITION_ALTERNATION})${BOUNDARY_AFTER}`,
  'iu',
);
const TRAILING_EDGE_PUNCTUATION_REGEX = /[\s,.\-:]+$/;
const LEADING_EDGE_PUNCTUATION_REGEX = /^[\s,.\-:]+/;

// "Remind me" isn't part of the task. The verb is not always last —
// "eslat menga" puts a pronoun after it — so the verb and an adjacent
// pronoun are removed as one cluster wherever they appear.
const COMMAND_VERB_ALTERNATION = [
  "eslatib\\s+qo'ying",
  "eslatib\\s+qo'y",
  'eslatgin',
  'eslat',
  'напомнить',
  'напоминай',
  'напомни',
  'remind',
].join('|');
// Only stripped when adjacent to an imperative; standalone ones are handled
// by the edge rules below.
const OBJECT_PRONOUN_ALTERNATION = ['menga', 'мне', 'me'].join('|');

// Verb bound to a pronoun is unambiguously "remind me" phrasing, so it can
// go from anywhere in the sentence.
const COMMAND_CLUSTER_REGEX = new RegExp(
  `${BOUNDARY_BEFORE}(?:` +
    `(?:${COMMAND_VERB_ALTERNATION})\\s+(?:${OBJECT_PRONOUN_ALTERNATION})` +
    `|(?:${OBJECT_PRONOUN_ALTERNATION})\\s+(?:${COMMAND_VERB_ALTERNATION})` +
    `)${BOUNDARY_AFTER}`,
  'giu',
);

// A bare verb with no pronoun is only noise at the very edges of the
// message. In the middle it is almost always the task's own verb —
// "remind the team", "напомни команде о встрече".
const LEADING_COMMAND_VERB_REGEX = new RegExp(
  `^\\s*(?:${COMMAND_VERB_ALTERNATION})${BOUNDARY_AFTER}`,
  'iu',
);
const TRAILING_COMMAND_VERB_REGEX = new RegExp(
  `${BOUNDARY_BEFORE}(?:${COMMAND_VERB_ALTERNATION})\\s*$`,
  'iu',
);

// An apostrophe must not count as a word break, or the possessive "men's"
// would lose its "men".
const SUBJECT_BOUNDARY_AFTER = "(?![\\p{L}\\p{N}'’])";
// "men/я/I" is a sentence subject: only meaningful to drop at the very start.
const LEADING_SUBJECT_REGEX = new RegExp(`^\\s*(?:men|я|i)${SUBJECT_BOUNDARY_AFTER}`, 'iu');
// "menga/мне" ("to me") carries no task content at either edge.
const LEADING_DATIVE_REGEX = new RegExp(`^\\s*(?:menga|мне)${BOUNDARY_AFTER}`, 'iu');
const TRAILING_DATIVE_REGEX = new RegExp(`${BOUNDARY_BEFORE}(?:menga|мне)\\s*$`, 'iu');

// Two passes: a preposition can be exposed only after the punctuation next to
// it is stripped (or vice versa), e.g. ", at " -> ", " -> "" needs both steps.
const stripTrailingEdge = (segment: string): string => {
  let result = segment;
  for (let i = 0; i < 2; i++) {
    result = result.replace(TRAILING_PREPOSITION_REGEX, '');
    result = result.replace(TRAILING_EDGE_PUNCTUATION_REGEX, '');
  }
  return result;
};

const stripLeadingEdge = (segment: string): string => {
  let result = segment;
  for (let i = 0; i < 2; i++) {
    result = result.replace(LEADING_EDGE_PUNCTUATION_REGEX, '');
    result = result.replace(LEADING_PREPOSITION_REGEX, '');
  }
  return result;
};

const extractTitle = (originalText: string, ranges: MatchRange[]): string => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  const segments: string[] = [];
  let cursor = 0;
  for (const range of sorted) {
    // Ranges may overlap (a repeat marker sitting next to a weekday);
    // never let the cursor walk backwards and re-emit removed text.
    if (range.end <= cursor) continue;
    segments.push(originalText.slice(cursor, Math.max(cursor, range.start)));
    cursor = range.end;
  }
  segments.push(originalText.slice(cursor));

  const cleanedSegments = segments.map((segment, index) => {
    const isFirst = index === 0;
    const isLast = index === segments.length - 1;

    let result = segment;

    // Clusters go first: stripping a bare leading verb before this would
    // break "remind me" apart and strand the pronoun.
    result = result.replace(COMMAND_CLUSTER_REGEX, ' ');

    if (!isLast) result = stripTrailingEdge(result);
    if (!isFirst) result = stripLeadingEdge(result);

    // Only the first and last segments touch the edges of the original
    // message, so only they may drop a bare imperative.
    if (isFirst) result = result.replace(LEADING_COMMAND_VERB_REGEX, '');
    if (isLast) result = result.replace(TRAILING_COMMAND_VERB_REGEX, '');

    return result;
  });

  const collapsed = cleanedSegments.join(' ').replace(/\s+/g, ' ').trim();
  const finalCleaned = collapsed
    .replace(LEADING_EDGE_PUNCTUATION_REGEX, '')
    .replace(TRAILING_EDGE_PUNCTUATION_REGEX, '')
    .trim();

  let title = finalCleaned.length > 0 ? finalCleaned : originalText.trim();

  // Drop the "remind me" phrasing and bare pronouns that carry no task
  // content. If that empties the title out, it wasn't real content to
  // begin with — keep the pre-strip version instead of losing everything.
  const beforeCommandStrip = title;

  title = title.replace(COMMAND_CLUSTER_REGEX, ' ').replace(/\s+/g, ' ').trim();
  title = title.replace(LEADING_SUBJECT_REGEX, '').replace(LEADING_DATIVE_REGEX, '');
  title = title.replace(TRAILING_DATIVE_REGEX, '');
  title = title
    .replace(LEADING_EDGE_PUNCTUATION_REGEX, '')
    .replace(TRAILING_EDGE_PUNCTUATION_REGEX, '')
    .trim();

  if (title.length === 0) {
    title = beforeCommandStrip;
  }

  return title.slice(0, TITLE_MAX_LENGTH);
};

// --- silent-error guard ---

const RESIDUAL_MONTH_REGEX = bounded(`(?:${MONTH_ALTERNATION})`);
const RESIDUAL_NUMERIC_DATE_REGEX = /\d+[./]\d+/;
const RESIDUAL_YEAR_REGEX = /\b\d{4}\b/;

const hasUnparsedDateResidue = (title: string): boolean =>
  RESIDUAL_MONTH_REGEX.test(title) ||
  RESIDUAL_NUMERIC_DATE_REGEX.test(title) ||
  RESIDUAL_YEAR_REGEX.test(title);

// --- first.second / first/second ambiguity (could be a date or a time) ---

type TokenClassification =
  | { kind: 'date'; day: number; month: number }
  | { kind: 'time'; hour: number; minute: number }
  | { kind: 'invalid' }
  | { kind: 'ambiguous'; day: number; month: number; hour: number; minute: number };

interface AmbiguousTokenMatch {
  classification: TokenClassification;
  raw: string;
  range: MatchRange;
}

const AMBIGUOUS_TOKEN_REGEX = bounded('(\\d{1,2})[./](\\d{1,2})');
const PRECEDING_TIME_KEYWORD_REGEX = new RegExp(
  `${BOUNDARY_BEFORE}(?:soat|в|во|at)\\s*$`,
  'iu',
);

// A bare "first.second" token is only unambiguous when just one of the two
// readings is numerically valid; otherwise it needs context (see parse()).
const classifyNumericToken = (first: number, second: number): TokenClassification => {
  const validAsDate = first >= 1 && first <= 31 && second >= 1 && second <= 12;
  const validAsTime = first >= 0 && first <= 23 && second >= 0 && second <= 59;

  if (validAsDate && !validAsTime) return { kind: 'date', day: first, month: second };
  if (validAsTime && !validAsDate) return { kind: 'time', hour: first, minute: second };
  if (!validAsDate && !validAsTime) return { kind: 'invalid' };
  return { kind: 'ambiguous', day: first, month: second, hour: first, minute: second };
};

const findAmbiguousToken = (text: string): AmbiguousTokenMatch | null => {
  const match = AMBIGUOUS_TOKEN_REGEX.exec(text);
  if (!match) return null;

  return {
    classification: classifyNumericToken(Number(match[1]), Number(match[2])),
    raw: match[0],
    range: toRange(match),
  };
};

export const parse = (
  text: string,
  now: Date,
  timezone: string,
): ParsedReminder => {
  // First: it spans a month name and a day number, so leaving it until after
  // matchCalendarDate would let "2 января" be taken as a one-off date.
  const yearlyMatch = matchYearlyDate(text);
  const afterYearly = yearlyMatch ? maskRange(text, yearlyMatch.range) : text;

  const calendarMatchFromNames = matchCalendarDate(afterYearly);
  let workingText = calendarMatchFromNames
    ? maskRange(afterYearly, calendarMatchFromNames.range)
    : afterYearly;

  // Carries its own recurrence wording ("har oyning 15-kunida"), so it is
  // resolved and masked before the clock and repeat matchers see its digits.
  const monthDayMatch = matchMonthDay(workingText);
  workingText = monthDayMatch ? maskRange(workingText, monthDayMatch.range) : workingText;

  // Keyword-anchored / colon time is always unambiguous, so it's resolved
  // before we ever look at the bare "first.second" token.
  const clockMatchFromKeywords = matchClockTime(workingText);
  workingText = clockMatchFromKeywords
    ? maskRange(workingText, clockMatchFromKeywords.range)
    : workingText;

  // Lead-time ("2 soat oldin") is masked before matchRelativeTime runs, so
  // "2 soat oldin" can never be mistaken for the start of "2 soatdan keyin".
  const remindBeforeMatch = matchRemindBefore(workingText);
  workingText = remindBeforeMatch
    ? maskRange(workingText, remindBeforeMatch.range)
    : workingText;

  const dayMatch = matchDayMarker(workingText);
  const relativeMatch = matchRelativeTime(workingText);

  // matchRepeat runs while the weekday is still visible: its weekday-qualified
  // alternatives use a lookahead onto that word.
  const repeatMatch = matchRepeat(workingText);
  const weekdayMatch = matchWeekday(workingText);

  let calendarMatch = calendarMatchFromNames;
  let clockMatch = clockMatchFromKeywords;
  let ambiguousToken: string | undefined;
  let ambiguousRange: MatchRange | undefined;

  const ambiguousFound = findAmbiguousToken(workingText);
  if (ambiguousFound) {
    const { classification, raw, range } = ambiguousFound;

    if (classification.kind === 'date') {
      calendarMatch ??= { day: classification.day, month: classification.month, year: undefined, range };
    } else if (classification.kind === 'time') {
      clockMatch ??= { hour: classification.hour, minute: classification.minute, range };
    } else if (classification.kind === 'ambiguous') {
      const signalOtherTime = clockMatchFromKeywords !== null;
      const signalMonthName = calendarMatchFromNames !== null;
      const signalDayMarker = dayMatch !== null;
      const signalPreceding = PRECEDING_TIME_KEYWORD_REGEX.test(text.slice(0, range.start));

      if (signalOtherTime) {
        calendarMatch ??= { day: classification.day, month: classification.month, year: undefined, range };
      } else if (signalMonthName || signalDayMarker || signalPreceding) {
        clockMatch ??= { hour: classification.hour, minute: classification.minute, range };
      } else {
        ambiguousToken = raw;
        ambiguousRange = range;
      }
    }
    // 'invalid' -> neither a valid day nor a valid hour; leave it in the
    // title as-is, hasUnparsedDateResidue() below will flag it.
  }

  let remindAt: Date | undefined;
  let confidence: number;
  let unclear: 'time' | 'date' | 'ambiguous' | undefined;

  if (relativeMatch) {
    remindAt = buildRelativeRemindAt(now, timezone, relativeMatch.totalMinutes);
    confidence = 0.7;
  } else if (yearlyMatch && clockMatch) {
    remindAt = buildYearlyRemindAt(
      now,
      timezone,
      yearlyMatch.month,
      yearlyMatch.day,
      clockMatch.hour,
      clockMatch.minute,
    );
    confidence = 0.9;
  } else if (yearlyMatch) {
    confidence = 0.5;
    unclear = 'time';
  } else if (monthDayMatch && clockMatch) {
    remindAt = buildMonthDayRemindAt(now, timezone, monthDayMatch.day, clockMatch.hour, clockMatch.minute);
    confidence = 0.9;
  } else if (monthDayMatch) {
    confidence = 0.5;
    unclear = 'time';
  } else if (weekdayMatch && clockMatch) {
    remindAt = buildWeekdayRemindAt(
      now,
      timezone,
      weekdayMatch.weekday,
      clockMatch.hour,
      clockMatch.minute,
      weekdayMatch.nextWeek,
    );
    confidence = 0.9;
  } else if (weekdayMatch) {
    confidence = 0.5;
    unclear = 'time';
  } else if (calendarMatch && clockMatch) {
    remindAt = buildCalendarRemindAt(now, timezone, calendarMatch, clockMatch.hour, clockMatch.minute);
    confidence = 0.9;
  } else if (calendarMatch) {
    confidence = 0.5;
    unclear = 'time';
  } else if (clockMatch) {
    remindAt = buildAbsoluteRemindAt(
      now,
      timezone,
      dayMatch?.offset ?? 0,
      clockMatch.hour,
      clockMatch.minute,
      dayMatch !== null,
    );
    confidence = dayMatch ? 0.9 : 0.7;
  } else if (dayMatch) {
    confidence = 0.5;
    unclear = 'time';
  } else if (repeatMatch) {
    confidence = 0.3;
  } else {
    confidence = 0.1;
  }

  if (ambiguousToken) {
    remindAt = undefined;
    confidence = 0.4;
    unclear = 'ambiguous';
  }

  // Day-of-month and month-and-day phrases state their own recurrence.
  let repeat = repeatMatch?.repeat ?? ReminderRepeatType.NONE;
  if (monthDayMatch) repeat = ReminderRepeatType.MONTHLY;
  if (yearlyMatch) repeat = ReminderRepeatType.YEARLY;

  // Out-of-range lead-time is ignored (falls back to the default) but the
  // expression is still cut from the title either way.
  const remindBefore =
    remindBeforeMatch &&
    remindBeforeMatch.minutes >= REMIND_BEFORE_MIN_MINUTES &&
    remindBeforeMatch.minutes <= REMIND_BEFORE_MAX_MINUTES
      ? [remindBeforeMatch.minutes]
      : DEFAULT_REMIND_BEFORE;

  const ranges = [
    calendarMatch?.range,
    dayMatch?.range,
    clockMatch?.range,
    relativeMatch?.range,
    repeatMatch?.range,
    ambiguousRange,
    remindBeforeMatch?.range,
    weekdayMatch?.range,
    monthDayMatch?.range,
    yearlyMatch?.range,
  ].filter((range): range is MatchRange => range != null);

  const title = extractTitle(text, ranges);

  // Better to re-ask than to silently save the wrong day: if something that
  // looks like an unparsed date fragment survived into the title, cap
  // confidence at 0.5 even if a time was otherwise recognized.
  if (hasUnparsedDateResidue(title)) {
    confidence = Math.min(confidence, 0.5);
    if (!ambiguousToken) {
      unclear = 'date';
    }
  }

  return {
    title,
    originalText: text,
    remindAt,
    remindBefore,
    repeat,
    confidence,
    ambiguousToken,
    unclear,
  };
};

const AI_FALLBACK_CONFIDENCE_THRESHOLD = 0.7;
const AI_FALLBACK_MIN_TEXT_LENGTH = 3;

// Regex first; the model is only consulted when the regex result is weak.
// The threshold is confidence alone — a set `unclear` must NOT keep a
// message away from the model, since "day recognized, time missing" is
// exactly the case the model is there to resolve.
export const parseWithFallback = async (
  text: string,
  now: Date,
  timezone: string,
): Promise<ParsedReminder> => {
  const result = parse(text, now, timezone);

  if (result.confidence >= AI_FALLBACK_CONFIDENCE_THRESHOLD) {
    return result;
  }

  if (text.trim().length < AI_FALLBACK_MIN_TEXT_LENGTH) {
    return result;
  }

  const aiResult = await parseWithGemini(text, now, timezone);

  return aiResult ?? result;
};
