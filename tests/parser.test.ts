import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { parse } from '../src/modules/parser/parser.service.js';
import { ReminderRepeatType } from '../src/modules/reminder/reminder.types.js';

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
