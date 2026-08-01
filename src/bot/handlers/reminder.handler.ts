import { Bot, Context, GrammyError, InlineKeyboard } from 'grammy';
import { findUserByTelegramId } from '../../modules/user/user.service.js';
import {
  createReminder,
  getUserReminders,
  cancelReminder,
} from '../../modules/reminder/reminder.service.js';
import { ReminderRepeatType } from '../../modules/reminder/reminder.types.js';
import { parseWithFallback } from '../../modules/parser/parser.service.js';
import { getTranslations } from '../../locales/index.js';
import { formatReminderTime } from '../../utils/date.util.js';
import type { Translations } from '../../shared/types/translation.js';
import { parseCancelReminderPayload } from '../../shared/constants/callbacks.js';
import {
  createCancelKeyboard,
  createRemindersKeyboard,
} from '../../shared/keyboards/reminder.keyboard.js';

const REPEAT_LABEL_KEY: Partial<Record<ReminderRepeatType, keyof Translations['reminder']['repeatLabels']>> = {
  [ReminderRepeatType.DAILY]: 'daily',
  [ReminderRepeatType.WEEKLY]: 'weekly',
  [ReminderRepeatType.MONTHLY]: 'monthly',
  [ReminderRepeatType.YEARLY]: 'yearly',
};

// Telegram clears the typing indicator after ~5s, so it has to be resent
// while a slower call is still in flight or the bot looks frozen.
const TYPING_REFRESH_MS = 4_000;

const withTypingIndicator = async <T>(
  ctx: Context,
  work: () => Promise<T>,
): Promise<T> => {
  // The indicator is cosmetic — a failure to show it must never take down
  // the actual work, so every send is swallowed, the first one included.
  const sendTyping = () => ctx.replyWithChatAction('typing').catch(() => undefined);

  await sendTyping();
  const interval = setInterval(() => void sendTyping(), TYPING_REFRESH_MS);

  try {
    return await work();
  } finally {
    clearInterval(interval);
  }
};

export const registerReminderHandler = (bot: Bot): void => {
  bot.command('list', async (ctx) => {
    if (!ctx.from) return;

    try {
      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        const t = getTranslations(ctx.from.language_code);
        await ctx.reply(t.errors.notRegistered);
        return;
      }

      const t = getTranslations(user.language);
      const reminders = await getUserReminders(user._id);

      if (reminders.length === 0) {
        await ctx.reply(t.reminder.listEmpty);
        return;
      }

      const lines = reminders.map((reminder, index) => {
        const time = formatReminderTime(reminder.remindAt, user.timezone, user.language ?? 'uz');
        return t.reminder.listItem(index + 1, reminder.title, time);
      });

      const text = `${t.reminder.listHeader(reminders.length)}\n\n${lines.join('\n')}`;
      const keyboard = createRemindersKeyboard(
        reminders.map((reminder, index) => ({
          id: reminder._id.toString(),
          label: `❌ ${index + 1}`,
        })),
      );

      await ctx.reply(text, { reply_markup: keyboard });
    } catch (error) {
      console.error('[Reminder List Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });

  bot.on('callback_query:data', async (ctx, next) => {
    const reminderId = parseCancelReminderPayload(ctx.callbackQuery.data);

    if (!reminderId) {
      return next();
    }

    try {
      await ctx.answerCallbackQuery();

      const user = await findUserByTelegramId(ctx.from.id);
      const t = getTranslations(user?.language ?? ctx.from.language_code);

      if (!user) {
        await ctx.reply(t.errors.notRegistered);
        return;
      }

      const cancelled = await cancelReminder(reminderId, user._id);

      if (!cancelled) {
        await ctx.reply(t.reminder.cancelFailed);
        return;
      }

      try {
        // Telegram keeps the existing inline keyboard on an edit unless an
        // explicit (even empty) reply_markup is supplied — pass one so the
        // cancel button actually disappears instead of staying clickable.
        await ctx.editMessageText(t.reminder.cancelled(cancelled.title), {
          reply_markup: new InlineKeyboard(),
        });
      } catch (editError) {
        // editMessageText throws if the new text is identical to the
        // current one — not an actual failure, safe to ignore.
        if (!(editError instanceof GrammyError) || !editError.description.includes('message is not modified')) {
          throw editError;
        }
      }
    } catch (error) {
      console.error('[Reminder Cancel Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });

  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text;

    // Not a reminder, but an unrecognized command — let it fall through
    if (text.startsWith('/')) {
      return next();
    }

    if (!ctx.from) return;

    try {
      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        const t = getTranslations(ctx.from.language_code);
        await ctx.reply(t.errors.notRegistered);
        return;
      }

      const t = getTranslations(user.language);

      // The model call takes seconds — without this the bot looks frozen.
      const parsed = await withTypingIndicator(ctx, () =>
        parseWithFallback(text, new Date(), user.timezone),
      );

      if (parsed.unclear === 'ambiguous') {
        const token = parsed.ambiguousToken!;
        const asTime = token.replace(/[./]/, ':');
        const asDate = token.replace('/', '.');
        await ctx.reply(t.reminder.ambiguous(token, asTime, asDate));
      } else if (parsed.unclear === 'date') {
        await ctx.reply(t.reminder.needDate);
      } else if (parsed.unclear === 'time') {
        await ctx.reply(t.reminder.needTime);
      } else if (parsed.remindAt && parsed.confidence >= 0.7) {
        // Everything recognized was consumed as the date/time expression —
        // there's no actual reminder content left to save.
        if (parsed.title === parsed.originalText.trim()) {
          await ctx.reply(t.reminder.notUnderstood);
        } else {
          const reminder = await createReminder({
            userId: user._id,
            title: parsed.title,
            originalText: parsed.originalText,
            remindAt: parsed.remindAt,
            repeat: parsed.repeat,
            remindBefore: parsed.remindBefore,
            timezone: user.timezone,
          });

          const time = formatReminderTime(parsed.remindAt, user.timezone, user.language ?? 'uz');
          let reply = t.reminder.details(parsed.title, time, parsed.remindBefore[0]);

          const labelKey = REPEAT_LABEL_KEY[parsed.repeat];
          if (labelKey) {
            reply += `\n${t.reminder.repeatLabels[labelKey]}`;
          }

          await ctx.reply(reply, {
            reply_markup: createCancelKeyboard(reminder._id.toString(), t.reminder.cancelButton),
          });
        }
      } else {
        await ctx.reply(t.reminder.notUnderstood);
      }
    } catch (error) {
      console.error('[Reminder Handler Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });
};
