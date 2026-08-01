import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatReminderTime } from '../src/utils/date.util.js';

// 2026-07-31T18:00 in Asia/Tashkent (UTC+5) is 13:00 the same day in UTC.
const MOMENT = new Date('2026-07-31T18:00:00+05:00');
const TASHKENT = 'Asia/Tashkent';

describe('formatReminderTime: localisation', () => {
  it('uses English month names', () => {
    assert.equal(formatReminderTime(MOMENT, TASHKENT, 'en'), '31 July, 18:00');
  });

  it('uses Russian month names in the genitive case', () => {
    assert.equal(formatReminderTime(MOMENT, TASHKENT, 'ru'), '31 июля, 18:00');
  });

  it('uses Uzbek month names', () => {
    assert.equal(formatReminderTime(MOMENT, TASHKENT, 'uz'), '31 iyul, 18:00');
  });
});

describe('formatReminderTime: timezone handling', () => {
  it('renders the same instant differently per zone', () => {
    const inTashkent = formatReminderTime(MOMENT, TASHKENT, 'en');
    const inUtc = formatReminderTime(MOMENT, 'UTC', 'en');

    assert.equal(inTashkent, '31 July, 18:00');
    assert.equal(inUtc, '31 July, 13:00');
    assert.notEqual(inTashkent, inUtc);
  });

  it('rolls the calendar day over when the zone pushes past midnight', () => {
    // 00:30 in Tashkent is still 19:30 the previous day in UTC.
    const justAfterMidnight = new Date('2026-08-01T00:30:00+05:00');

    assert.equal(formatReminderTime(justAfterMidnight, TASHKENT, 'en'), '1 August, 00:30');
    assert.equal(formatReminderTime(justAfterMidnight, 'UTC', 'en'), '31 July, 19:30');
  });
});
