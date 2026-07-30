import { DateTime } from 'luxon';
import { LanguageCode } from '../shared/types/translation.js';

const MONTH_NAMES: Record<LanguageCode, string[]> = {
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  // Genitive case (used after a day number, e.g. "31 июля")
  ru: [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ],
  uz: [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ],
};

export const formatReminderTime = (
  date: Date,
  timezone: string,
  locale: LanguageCode,
): string => {
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  const month = MONTH_NAMES[locale][dt.month - 1];

  return `${dt.day} ${month}, ${dt.toFormat('HH:mm')}`;
};
