import { Bot, Context, GrammyError, InlineKeyboard } from 'grammy';
import { findUserByTelegramId } from '../../modules/user/user.service.js';
import { SUPPORTED_LANGUAGES } from '../../shared/types/translation.js';
import { sendHelp } from './help.handler.js';
import { sendLanguageSelector } from './language.handler.js';
import {
  createReminder,
  getUserReminders,
  cancelReminder,
  updateReminder,
} from '../../modules/reminder/reminder.service.js';
import { ReminderRepeatType } from '../../modules/reminder/reminder.types.js';
import { parseWithFallback } from '../../modules/parser/parser.service.js';
import type { ParsedReminder } from '../../modules/parser/parser.types.js';
import { getTranslations } from '../../locales/index.js';
import { formatReminderTime } from '../../utils/date.util.js';
import type { Translations } from '../../shared/types/translation.js';
import {
  CALLBACKS,
  parseCancelReminderPayload,
  parseEditReminderPayload,
} from '../../shared/constants/callbacks.js';
import {
  createCancelKeyboard,
  createRemindersKeyboard,
  createEditListKeyboard,
} from '../../shared/keyboards/reminder.keyboard.js';
import { createMenuKeyboard } from '../../shared/keyboards/menu.keyboard.js';

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

// Shared by the /list command and the menu button.
const sendReminderList = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;

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
};

// Shared by the /edit command and the menu button.
const sendEditList = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;

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

  const text = `${t.reminder.editListHeader}\n\n${lines.join('\n')}`;
  const keyboard = createEditListKeyboard(
    reminders.map((reminder, index) => ({
      id: reminder._id.toString(),
      label: `✏️ ${index + 1}`,
    })),
  );

  await ctx.reply(text, { reply_markup: keyboard });
};

// Shared by the "new reminder" menu button; the same text is also sent
// unprompted right after the first language choice.
const sendHowTo = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;

  const user = await findUserByTelegramId(ctx.from.id);
  const t = getTranslations(user?.language ?? ctx.from.language_code);

  await ctx.reply(t.reminder.howTo);
};

// Creating and editing judge a parse the same way, so the replies for a
// message we can't act on live in one place. Returns the validated remindAt,
// or null once it has already answered the user.
const resolveRemindAt = async (
  ctx: Context,
  t: Translations,
  parsed: ParsedReminder,
): Promise<Date | null> => {
  if (parsed.unclear === 'ambiguous') {
    const token = parsed.ambiguousToken!;
    const asTime = token.replace(/[./]/, ':');
    const asDate = token.replace('/', '.');
    await ctx.reply(t.reminder.ambiguous(token, asTime, asDate));
    return null;
  }

  if (parsed.unclear === 'date') {
    await ctx.reply(t.reminder.needDate);
    return null;
  }

  if (parsed.unclear === 'time') {
    await ctx.reply(t.reminder.needTime);
    return null;
  }

  const { remindAt } = parsed;

  // A title equal to the whole message means every recognised word was the
  // date/time expression — there is no actual reminder content left.
  if (!remindAt || parsed.confidence < 0.7 || parsed.title === parsed.originalText.trim()) {
    await ctx.reply(t.reminder.notUnderstood);
    return null;
  }

  return remindAt;
};

// The prompt carries the reminder id so the reply can be tied back to it
// without any server-side conversation state.
const EDIT_ID_PATTERN = /\[id:([a-f0-9]{24})\]/i;

const extractEditTargetId = (ctx: Context): string | null => {
  const repliedTo = ctx.message?.reply_to_message;
  if (!repliedTo?.text) return null;

  return repliedTo.text.match(EDIT_ID_PATTERN)?.[1] ?? null;
};

const applyEdit = async (ctx: Context, reminderId: string, text: string): Promise<void> => {
  if (!ctx.from) return;

  const user = await findUserByTelegramId(ctx.from.id);

  if (!user) {
    const t = getTranslations(ctx.from.language_code);
    await ctx.reply(t.errors.notRegistered);
    return;
  }

  const t = getTranslations(user.language);

  const parsed = await withTypingIndicator(ctx, () =>
    parseWithFallback(text, new Date(), user.timezone),
  );

  // An unusable rewrite leaves the stored reminder untouched.
  const remindAt = await resolveRemindAt(ctx, t, parsed);
  if (!remindAt) return;

  const updated = await updateReminder(reminderId, user._id, {
    title: parsed.title,
    originalText: parsed.originalText,
    remindAt,
    repeat: parsed.repeat,
    remindBefore: parsed.remindBefore,
  });

  if (!updated) {
    await ctx.reply(t.reminder.editFailed);
    return;
  }

  const time = formatReminderTime(updated.remindAt, user.timezone, user.language ?? 'uz');
  let reply = t.reminder.editSuccess(updated.title, time);

  const labelKey = REPEAT_LABEL_KEY[updated.repeat];
  if (labelKey) {
    reply += `\n${t.reminder.repeatLabels[labelKey]}`;
  }

  await ctx.reply(reply, {
    reply_markup: createCancelKeyboard(updated._id.toString(), t.reminder.cancelButton),
  });
};

type MenuAction = (ctx: Context) => Promise<void>;

// A reply keyboard sends its label as an ordinary text message, so those
// labels must never reach the parser. Every language is registered, not
// just the user's current one: an old keyboard stays in the chat history
// after a language switch and its buttons still work.
const MENU_BUTTON_ACTIONS: ReadonlyMap<string, MenuAction> = new Map(
  SUPPORTED_LANGUAGES.flatMap((language): Array<[string, MenuAction]> => {
    const { buttons } = getTranslations(language).menu;
    return [
      [buttons.create, sendHowTo],
      [buttons.list, sendReminderList],
      [buttons.edit, sendEditList],
      [buttons.language, sendLanguageSelector],
      [buttons.help, sendHelp],
    ];
  }),
);

export const registerReminderHandler = (bot: Bot): void => {
  bot.command('list', async (ctx) => {
    try {
      await sendReminderList(ctx);
    } catch (error) {
      console.error('[Reminder List Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });

  bot.command('edit', async (ctx) => {
    try {
      await sendEditList(ctx);
    } catch (error) {
      console.error('[Reminder Edit List Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });

  bot.callbackQuery(new RegExp(`^${CALLBACKS.REMINDER.EDIT}:`), async (ctx) => {
    try {
      // Answered exactly once, here. The catch below must not answer again:
      // Telegram rejects the second call and the error would escape the catch.
      await ctx.answerCallbackQuery();

      const reminderId = parseEditReminderPayload(ctx.callbackQuery.data);
      const user = await findUserByTelegramId(ctx.from.id);
      const t = getTranslations(user?.language ?? ctx.from.language_code);

      if (!user) {
        await ctx.reply(t.errors.notRegistered);
        return;
      }

      // Looked up among this user's own active reminders, so a forged id
      // belonging to someone else simply isn't found.
      const reminders = await getUserReminders(user._id);
      const target = reminders.find((reminder) => reminder._id.toString() === reminderId);

      if (!target) {
        await ctx.reply(t.reminder.editFailed);
        return;
      }

      const time = formatReminderTime(target.remindAt, user.timezone, user.language ?? 'uz');

      await ctx.reply(
        `${t.reminder.editPrompt(target.title, time)}\n\n[id:${target._id.toString()}]`,
        { reply_markup: { force_reply: true } },
      );
    } catch (error) {
      console.error('[Reminder Edit Prompt Error]:', error);
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

    // A reply to an edit prompt rewrites that reminder instead of creating a
    // new one. Checked before the menu buttons so the branch is unambiguous.
    const editTargetId = extractEditTargetId(ctx);
    if (editTargetId) {
      try {
        await applyEdit(ctx, editTargetId, text);
      } catch (error) {
        console.error('[Reminder Edit Error]:', error);
        const t = getTranslations('en');
        await ctx.reply(t.errors.unknown);
      }
      return;
    }

    // A menu button press arrives as plain text — run its action instead of
    // saving a reminder titled after the button.
    const menuAction = MENU_BUTTON_ACTIONS.get(text.trim());
    if (menuAction) {
      try {
        await menuAction(ctx);
      } catch (error) {
        console.error('[Menu Button Error]:', error);
        const t = getTranslations('en');
        await ctx.reply(t.errors.unknown);
      }
      return;
    }

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

      const remindAt = await resolveRemindAt(ctx, t, parsed);
      if (!remindAt) return;

      const reminder = await createReminder({
        userId: user._id,
        title: parsed.title,
        originalText: parsed.originalText,
        remindAt,
        repeat: parsed.repeat,
        remindBefore: parsed.remindBefore,
        timezone: user.timezone,
      });

      const time = formatReminderTime(remindAt, user.timezone, user.language ?? 'uz');
      let reply = t.reminder.details(parsed.title, time, parsed.remindBefore[0]);

      const labelKey = REPEAT_LABEL_KEY[parsed.repeat];
      if (labelKey) {
        reply += `\n${t.reminder.repeatLabels[labelKey]}`;
      }

      await ctx.reply(reply, {
        reply_markup: createCancelKeyboard(reminder._id.toString(), t.reminder.cancelButton),
      });
    } catch (error) {
      console.error('[Reminder Handler Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });
};
