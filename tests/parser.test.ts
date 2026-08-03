import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { parse } from '../src/modules/parser/parser.service.js';
import { ReminderRepeatType } from '../src/modules/reminder/reminder.types.js';
import { getTranslations } from '../src/locales/index.js';
import { SUPPORTED_LANGUAGES } from '../src/shared/types/translation.js';

const NOW = new Date('2026-07-30T16:15:00+05:00');
const TZ = 'Asia/Tashkent';

interface Moment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Compared in the user's zone rather than via toISOString so the result
// doesn't depend on the timezone of the machine running the tests.
const momentOf = (date: Date | undefined): Moment => {
  assert.ok(date instanceof Date, 'expected remindAt to be a Date');
  const dt = DateTime.fromJSDate(date, { zone: TZ });
  return { year: dt.year, month: dt.month, day: dt.day, hour: dt.hour, minute: dt.minute };
};

const run = (text: string) => parse(text, NOW, TZ);

describe('parser: absolute date and time', () => {
  it('resolves a day marker with a clock time', () => {
    const r = run('ertaga 18:00 da dori olish');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 31, hour: 18, minute: 0 });
    assert.equal(r.confidence, 0.9);
    assert.equal(r.title, 'dori olish');
  });

  it('strips the trailing command verb and its object', () => {
    const r = run('bugun soat 18:00 da darsga kirishim kere eslat menga');

    assert.equal(r.title, 'darsga kirishim kere');
  });

  it('keeps hyphenated words in the title while cutting a hyphenated date', () => {
    const r = run('9-Avgust Spider-man kinosiga borish soat 11:00 da');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 9, hour: 11, minute: 0 });
    assert.match(r.title, /Spider-man/);
  });

  it('cuts the "kuni" particle together with the date', () => {
    const r = run('9 - Avgust kuni, soat 11.00 da, Spider-man kinosiga borishni eslat');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 9, hour: 11, minute: 0 });
    assert.doesNotMatch(r.title, /kuni/);
  });

  it('parses a Russian day-month-name date', () => {
    const r = run('1 августа в 09:20 выпить кофе');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 1, hour: 9, minute: 20 });
    assert.equal(r.title, 'выпить кофе');
  });

  it('parses an English ordinal month-day date', () => {
    const r = run('August 9th at 11:00 watch Spider-man');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 9, hour: 11, minute: 0 });
    assert.equal(r.title, 'watch Spider-man');
  });

  it('strips a dangling article left by the date expression', () => {
    const r = run('Call my mom at 17:28 in the 31th of July');

    assert.equal(r.title, 'Call my mom');
  });
});

describe('parser: title cleanup keeps meaningful words', () => {
  it('does not mistake a possessive for the Uzbek subject pronoun', () => {
    const r = run("men's haircut tomorrow at 15:00");

    assert.equal(r.title, "men's haircut");
  });

  it('keeps a bare imperative that sits mid-sentence', () => {
    const r = run('tomorrow remind the team about standup at 14:00');

    assert.equal(r.title, 'remind the team about standup');
  });

  it('drops a bare imperative that starts the message', () => {
    const r = run('напомни команде о встрече завтра в 15:00');

    assert.equal(r.title, 'команде о встрече');
  });

  it('keeps a bare Russian imperative that sits mid-sentence', () => {
    const r = run('завтра напомни команде о встрече в 15:00');

    assert.equal(r.title, 'напомни команде о встрече');
  });

  it('drops a verb-plus-pronoun cluster wherever it appears', () => {
    const r = run('ertaga 18:00 da dori olish, eslat menga');

    assert.equal(r.title, 'dori olish');
  });

  it('keeps a pronoun that belongs to a non-command verb', () => {
    const r = run('email me the report tomorrow');

    assert.equal(r.title, 'email me the report');
  });
});

describe('parser: dotted DD.MM vs HH.MM ambiguity', () => {
  it('reports a genuinely ambiguous token instead of guessing', () => {
    const r = run('18.05 qahva ichish');

    assert.equal(r.ambiguousToken, '18.05');
    assert.equal(r.unclear, 'ambiguous');
    assert.equal(r.remindAt, undefined);
  });

  it('resolves to a time when preceded by the "soat" keyword', () => {
    const r = run('soat 18.05 da qahva ichish');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 30, hour: 18, minute: 5 });
  });

  it('resolves to a time when a day marker is present', () => {
    const r = run('ertaga 18.05 da qahva');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 31, hour: 18, minute: 5 });
  });

  it('resolves to a date when the first number cannot be an hour', () => {
    const r = run("25.06 tug'ilgan kun");

    assert.equal(r.remindAt, undefined);
    assert.equal(r.unclear, 'time');
  });

  it('resolves to a time when the second number cannot be a month', () => {
    const r = run('18.45 uchrashuv');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 30, hour: 18, minute: 45 });
  });

  it('treats the dotted token as a date when a separate colon time exists', () => {
    const r = run('01.08 09:20 qahva');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 1, hour: 9, minute: 20 });
  });

  it('treats the dotted token as a time when a month name is present', () => {
    const r = run('1 avgust 18.05 da qahva');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 1, hour: 18, minute: 5 });
  });
});

describe('parser: relative deadline vs lead time', () => {
  it('reads "N soatdan keyin" as the deadline, not a lead time', () => {
    const r = run('2 soatdan keyin onamga telefon qilish');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 30, hour: 18, minute: 15 });
    assert.deepEqual(r.remindBefore, [60]);
  });

  it('reads "N soat oldin" as a lead time, not the deadline', () => {
    const r = run('ertaga 18:00 da dori olish, 2 soat oldin eslat');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 31, hour: 18, minute: 0 });
    assert.deepEqual(r.remindBefore, [120]);
  });

  it('reads an Uzbek lead time in minutes', () => {
    const r = run('ertaga 18:00 da dori olish, 30 daqiqa oldin eslat');

    assert.deepEqual(r.remindBefore, [30]);
  });

  it('reads a lead time embedded mid-sentence', () => {
    const r = run('men ertaga soat 12.15 da masjidga borishim kerak menga 15 minut oldin eslat');

    assert.deepEqual(r.remindBefore, [15]);
    assert.equal(r.title, 'masjidga borishim kerak');
  });

  it('reads a Russian relative deadline', () => {
    const r = run('через 2 часа позвонить маме');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 30, hour: 18, minute: 15 });
  });

  it('reads a Russian lead time', () => {
    const r = run('завтра в 18:00 забрать лекарства, предупреди за 15 минут');

    assert.deepEqual(r.remindBefore, [15]);
  });

  it('keeps a large lead time that is still inside the 7-day limit', () => {
    // 100 hours = 6000 minutes, below the 10080-minute cap.
    const r = run('ertaga 18:00 da dori olish, 100 soat oldin eslat');

    assert.deepEqual(r.remindBefore, [6000]);
    assert.doesNotMatch(r.title, /oldin/);
  });

  it('falls back to the default lead time when the value exceeds the limit', () => {
    // 200 hours = 12000 minutes, above the 10080-minute cap.
    const r = run('ertaga 18:00 da dori olish, 200 soat oldin eslat');

    assert.deepEqual(r.remindBefore, [60]);
    assert.doesNotMatch(r.title, /oldin/);
  });
});

describe('parser: recurrence', () => {
  it('recognises a daily repeat', () => {
    assert.equal(run('har kuni 8:00 da suv ichish').repeat, ReminderRepeatType.DAILY);
  });

  it('recognises a weekly repeat', () => {
    assert.equal(run('каждую неделю в 10:00 планёрка').repeat, ReminderRepeatType.WEEKLY);
  });

  it('recognises a monthly repeat', () => {
    assert.equal(run('every month on the 1st pay bills').repeat, ReminderRepeatType.MONTHLY);
  });
});

describe('parser: rolling a bare time to the next day', () => {
  it('moves a time that already passed today to tomorrow', () => {
    const r = run('09:00 da yugurish');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 31, hour: 9, minute: 0 });
  });

  it('keeps a time that has not passed yet on today', () => {
    const r = run("23:00 da kitob o'qish");

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 7, day: 30, hour: 23, minute: 0 });
  });
});

// Monday 2026-08-03 21:45 in Tashkent — chosen so "today" is a weekday that
// several cases refer to, with an evening time that some clock times have
// already passed and others have not.
const MONDAY_NOW = new Date('2026-08-03T21:45:00+05:00');
const runOnMonday = (text: string) => parse(text, MONDAY_NOW, TZ);

describe('parser: weekday names', () => {
  it('resolves a weekday with a weekly repeat marker', () => {
    const r = runOnMonday('har hafta chorshanba kuni soat 18:00 da dori ichish');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 5, hour: 18, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.WEEKLY);
    assert.equal(r.title, 'dori ichish');
  });

  it('handles mixed case and a weekday later in the week', () => {
    const r = runOnMonday('Har hafta Yakshanba kuni soat 01:00 da uhlash');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 9, hour: 1, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.WEEKLY);
    assert.equal(r.title, 'uhlash');
  });

  it('resolves a bare weekday as a one-off', () => {
    const r = runOnMonday('chorshanba kuni soat 18:00 da uchrashuv');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 5, hour: 18, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.NONE);
    assert.equal(r.title, 'uchrashuv');
  });

  it('treats "каждую <weekday>" as a weekly repeat', () => {
    const r = runOnMonday('каждую среду в 18:00 таблетки');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 5, hour: 18, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.WEEKLY);
    assert.equal(r.title, 'таблетки');
  });

  it('treats "every <weekday>" as a weekly repeat', () => {
    const r = runOnMonday('every Wednesday at 18:00 pills');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 5, hour: 18, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.WEEKLY);
    assert.equal(r.title, 'pills');
  });

  it('keeps today when the named weekday is today and the time has not passed', () => {
    const r = runOnMonday("dushanba kuni soat 23:00 da yig'ilish");

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 3, hour: 23, minute: 0 });
  });

  it('rolls to next week when the named weekday is today but the time has passed', () => {
    const r = runOnMonday("dushanba kuni soat 10:00 da yig'ilish");

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 10, hour: 10, minute: 0 });
  });

  it('reads "keyingi hafta <weekday>" as next week, not the nearest one', () => {
    const r = runOnMonday('keyingi hafta dushanba kuni soat 10:00 da uchrashuv');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 10, hour: 10, minute: 0 });
    assert.equal(r.title, 'uchrashuv');
  });
});

describe('parser: day of month with a monthly repeat', () => {
  it('reads an Uzbek ordinal word and rolls past a date already gone', () => {
    const r = runOnMonday("har oyning birinchi kunida soat 7:00 da soliq to'lash");

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 9, day: 1, hour: 7, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.MONTHLY);
    assert.equal(r.title, "soliq to'lash");
  });

  it('reads a numeric Uzbek day still ahead this month', () => {
    const r = runOnMonday('har oyning 15-kunida soat 10:00 da hisobot');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 15, hour: 10, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.MONTHLY);
    assert.equal(r.title, 'hisobot');
  });

  it('reads the Russian "первого числа каждого месяца" form', () => {
    const r = runOnMonday('первого числа каждого месяца в 09:00 оплатить счета');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 9, day: 1, hour: 9, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.MONTHLY);
    assert.equal(r.title, 'оплатить счета');
  });

  it('reads the English "on the 1st of every month" form', () => {
    const r = runOnMonday('on the 1st of every month at 09:00 pay bills');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 9, day: 1, hour: 9, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.MONTHLY);
    assert.equal(r.title, 'pay bills');
  });

  it('clamps a day the target month does not have instead of overflowing', () => {
    // From 31 Jan the next occurrence of "the 31st" is February, which has
    // only 28 days in 2026 — it must land on the 28th, not spill into March.
    const lateJanuary = new Date('2026-01-31T23:30:00+05:00');
    const r = parse('har oyning 31-kunida soat 10:00 da hisobot', lateJanuary, TZ);

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 2, day: 28, hour: 10, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.MONTHLY);
  });
});

// Late on 3 August 2026, so a January date is always next year while an
// August one is still ahead in the current year.
const YEARLY_NOW = new Date('2026-08-03T23:29:00+05:00');
const runYearly = (text: string) => parse(text, YEARLY_NOW, TZ);

describe('parser: yearly recurrence with a month and day', () => {
  it('reads the nested Uzbek "year > month > day" form with ordinal words', () => {
    const r = runYearly("har yilning birinchi oyining 2-kuni soat 22:20 da kino ko'rish");

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, "kino ko'rish");
  });

  it('reads the same nested form written with digits', () => {
    const r = runYearly('har yilning 1-oyining 2-kunida soat 22:20 da kino');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
  });

  it('keeps the current year when the date has not passed yet', () => {
    const r = runYearly('har yilning 8-oyining 15-kunida soat 10:00 da bayram');

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 8, day: 15, hour: 10, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'bayram');
  });

  it('reads an Uzbek month name with a day number', () => {
    const r = runYearly('har yil 2-yanvarda soat 22:20 da kino');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'kino');
  });

  it('reads the Russian "каждый год <day> <month>" form', () => {
    const r = runYearly('каждый год 2 января в 22:20 смотреть кино');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'смотреть кино');
  });

  it('reads the Russian "<ordinal> <month> каждого года" form', () => {
    const r = runYearly('второго января каждого года в 22:20 смотреть кино');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'смотреть кино');
  });

  it('reads the English "every year on <month> <day>" form', () => {
    const r = runYearly('every year on January 2 at 22:20 watch a movie');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'watch a movie');
  });

  it('reads the English "on the Nth of <month> every year" form', () => {
    const r = runYearly('on the 2nd of January every year at 22:20 watch a movie');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 1, day: 2, hour: 22, minute: 20 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'watch a movie');
  });

  it('reads a two-word Uzbek month ordinal', () => {
    const r = runYearly("har yilning o'n ikkinchi oyining 25-kuni soat 12:00 da bayram");

    assert.deepEqual(momentOf(r.remindAt), { year: 2026, month: 12, day: 25, hour: 12, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
    assert.equal(r.title, 'bayram');
  });

  it('clamps 29 February to the 28th in a non-leap year', () => {
    // 2027 is not a leap year, matching luxon's own plus({years:1}) result.
    const r = runYearly('har yil 29-fevralda soat 10:00 da tekshiruv');

    assert.deepEqual(momentOf(r.remindAt), { year: 2027, month: 2, day: 28, hour: 10, minute: 0 });
    assert.equal(r.repeat, ReminderRepeatType.YEARLY);
  });
});

// The onboarding message advertises these lines as copy-paste ready, so the
// parser has to actually handle them. Read out of the locales rather than
// duplicated here, otherwise the test drifts from what users are shown.
const howToExamples = (language: (typeof SUPPORTED_LANGUAGES)[number]): string[] => {
  const [, ...rest] = getTranslations(language).reminder.howTo.split('\n');
  return rest.map((line) => line.trim()).filter((line) => line.length > 0);
};

describe('parser: every advertised howTo example works', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    it(`parses all ${language} examples into a usable reminder`, () => {
      const examples = howToExamples(language);

      // Guards against a formatting change silently emptying the list and
      // turning this suite into a no-op.
      assert.ok(examples.length > 0, `no examples found in ${language} howTo`);

      for (const example of examples) {
        const r = run(example);
        const hasSchedule = r.remindAt !== undefined || r.repeat !== ReminderRepeatType.NONE;

        assert.ok(
          r.confidence >= 0.7,
          `${language}: ${JSON.stringify(example)} parsed with confidence ${r.confidence}`,
        );
        assert.ok(
          hasSchedule,
          `${language}: ${JSON.stringify(example)} produced neither remindAt nor a repeat`,
        );
      }
    });
  }
});

describe('parser: nothing recognisable', () => {
  it('returns the lowest confidence for Russian small talk', () => {
    const r = run('привет как дела');

    assert.equal(r.confidence, 0.1);
    assert.equal(r.remindAt, undefined);
  });

  it('returns the lowest confidence for Uzbek small talk', () => {
    assert.equal(run('salom qalesan').confidence, 0.1);
  });

  it('leaves no meaningful title when the message is only a time', () => {
    const r = run('11:00');

    assert.equal(r.title, r.originalText.trim());
  });
});
