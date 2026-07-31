import {
  findDueReminders,
  recordNotification,
  markMissed,
  completeReminder,
  advanceRepeat,
  getNextRunAt,
  rescheduleReminder,
} from '../reminder/reminder.service.js';
import { ReminderDocument, ReminderRepeatType } from '../reminder/reminder.types.js';
import { findUserById } from '../user/user.service.js';
import { sendReminderNotification } from '../notification/notification.service.js';
import { MessageSender, NotificationKind } from '../notification/notification.types.js';
import { OVERDUE_THRESHOLD_MINUTES } from '../../shared/constants/scheduler.constants.js';

const TICK_INTERVAL_MS = 60_000;
// A send-moment this close to `now` is just normal tick granularity, not a
// noticeable delay — distinguishes 'due' from 'overdue' for the main moment.
const DUE_GRACE_MINUTES = 1;

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const processReminder = async (
  reminder: ReminderDocument,
  now: Date,
  sender: MessageSender,
): Promise<void> => {
  const user = await findUserById(reminder.userId);
  if (!user) {
    await markMissed(reminder._id.toString());
    console.log(`[Scheduler] ${reminder._id}: user not found, marked MISSED.`);
    return;
  }

  // Collect every send-moment (each remindBefore lead-time plus the
  // deadline itself), keep only what's due and not already sent, and take
  // the latest one — earlier missed moments are skipped so a user coming
  // back after downtime doesn't get a backlog of messages.
  const chosenMoment = [
    ...reminder.remindBefore.map((minutes) => new Date(reminder.remindAt.getTime() - minutes * 60_000)),
    reminder.remindAt,
  ]
    .filter((moment) => moment.getTime() <= now.getTime())
    .filter((moment) => !reminder.lastNotificationAt || moment.getTime() > reminder.lastNotificationAt.getTime())
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (!chosenMoment) return;

  const isMainMoment = chosenMoment.getTime() === reminder.remindAt.getTime();
  const lateMinutes = (now.getTime() - chosenMoment.getTime()) / 60_000;

  console.log(
    `[Scheduler] ${reminder._id}: chosen=${chosenMoment.toISOString()} lateMin=${lateMinutes.toFixed(1)} main=${isMainMoment}`,
  );

  if (lateMinutes > OVERDUE_THRESHOLD_MINUTES) {
    if (!isMainMoment) {
      const nextRunAt = getNextRunAt(reminder.remindAt, reminder.remindBefore, now);
      await rescheduleReminder(reminder._id.toString(), nextRunAt);
      console.log(`[Scheduler] ${reminder._id}: advance warning too late, rescheduled to ${nextRunAt.toISOString()}.`);
    } else if (reminder.repeat !== ReminderRepeatType.NONE) {
      await advanceRepeat(reminder, now);
      console.log(`[Scheduler] ${reminder._id}: main moment too late, repeat advanced.`);
    } else {
      await markMissed(reminder._id.toString());
      console.log(`[Scheduler] ${reminder._id}: main moment too late, marked MISSED.`);
    }
    return;
  }

  const isAdvanceWarning = !isMainMoment;
  const kind: NotificationKind = isAdvanceWarning
    ? 'advance'
    : lateMinutes <= DUE_GRACE_MINUTES
      ? 'due'
      : 'overdue';
  const minutesLeft = isAdvanceWarning
    ? Math.max(0, Math.round((reminder.remindAt.getTime() - now.getTime()) / 60_000))
    : 0;

  try {
    await sendReminderNotification(sender, {
      telegramId: user.telegramId,
      language: user.language ?? 'uz',
      title: reminder.title,
      remindAt: reminder.remindAt,
      timezone: reminder.timezone,
      kind,
      minutesLeft,
    });
  } catch (error) {
    console.error(`[Scheduler] ${reminder._id}: failed to send notification:`, error);
    return;
  }

  console.log(`[Scheduler] ${reminder._id}: sent (${kind}).`);

  if (isAdvanceWarning) {
    const nextRunAt = getNextRunAt(reminder.remindAt, reminder.remindBefore, now);
    await recordNotification(reminder._id.toString(), now, nextRunAt);
  } else if (reminder.repeat !== ReminderRepeatType.NONE) {
    await advanceRepeat(reminder, now);
  } else {
    await completeReminder(reminder._id.toString());
  }
};

const runTick = async (sender: MessageSender): Promise<void> => {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const due = await findDueReminders(now);
    console.log(`[Scheduler] Tick ${now.toISOString()} — ${due.length} due.`);

    for (const reminder of due) {
      try {
        await processReminder(reminder, now, sender);
      } catch (error) {
        console.error(`[Scheduler] Failed processing reminder ${reminder._id}:`, error);
      }
    }
  } finally {
    isRunning = false;
  }
};

export const startScheduler = (sender: MessageSender): void => {
  if (intervalHandle) return;

  intervalHandle = setInterval(() => void runTick(sender), TICK_INTERVAL_MS);
  console.log('⏰ Scheduler started (60s interval).');
};

export const stopScheduler = (): void => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
