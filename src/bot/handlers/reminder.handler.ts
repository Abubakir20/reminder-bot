import { Bot } from 'grammy';
import { findUserByTelegramId } from '../../modules/user/user.service.js';
import { createReminder } from '../../modules/reminder/reminder.service.js';
import { ReminderRepeatType } from '../../modules/reminder/reminder.types.js';
import { parse } from '../../modules/parser/parser.service.js';
import { getTranslations } from '../../locales/index.js';
import { formatReminderTime } from '../../utils/date.util.js';
import type { Translations } from '../../shared/types/translation.js';

const REPEAT_LABEL_KEY: Partial<Record<ReminderRepeatType, keyof Translations['reminder']['repeatLabels']>> = {
  [ReminderRepeatType.DAILY]: 'daily',
  [ReminderRepeatType.WEEKLY]: 'weekly',
  [ReminderRepeatType.MONTHLY]: 'monthly',
  [ReminderRepeatType.YEARLY]: 'yearly',
};

export const registerReminderHandler = (bot: Bot): void => {
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
      const parsed = parse(text, new Date(), user.timezone);

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
          await createReminder({
            userId: user._id,
            title: parsed.title,
            originalText: parsed.originalText,
            remindAt: parsed.remindAt,
            repeat: parsed.repeat,
          });

          const time = formatReminderTime(parsed.remindAt, user.timezone, user.language ?? 'uz');
          let reply = t.reminder.details(parsed.title, time);

          const labelKey = REPEAT_LABEL_KEY[parsed.repeat];
          if (labelKey) {
            reply += `\n${t.reminder.repeatLabels[labelKey]}`;
          }

          await ctx.reply(reply);
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
