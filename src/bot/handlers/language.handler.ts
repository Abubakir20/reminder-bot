import { Bot, Context } from 'grammy';
import { findUserByTelegramId, updateUserLanguage } from '../../modules/user/user.service.js';
import { countUserReminders } from '../../modules/reminder/reminder.service.js';
import { getTranslations } from '../../locales/index.js';
import {
  createLanguageKeyboard,
  extractLanguageCode,
} from '../../shared/keyboards/language.keyboard.js';
import { createMenuKeyboard } from '../../shared/keyboards/menu.keyboard.js';

// Shared by the /language command and the menu button.
export const sendLanguageSelector = async (ctx: Context): Promise<void> => {
  const user = ctx.from ? await findUserByTelegramId(ctx.from.id) : null;
  const t = getTranslations(user?.language ?? ctx.from?.language_code);

  await ctx.reply(t.language.select, {
    reply_markup: createLanguageKeyboard(),
  });
};

export const registerLanguageHandler = (bot: Bot): void => {
  bot.command('language', async (ctx) => {
    try {
      await sendLanguageSelector(ctx);
    } catch (error) {
      console.error('[Language Command Error]:', error);
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });

  bot.on('callback_query:data', async (ctx, next) => {
    const callbackData = ctx.callbackQuery.data;
    const langCode = extractLanguageCode(callbackData);

    // If it's not a language callback query, pass control to the next handler
    if (!langCode) {
      return next();
    }

    try {
      // 1. Answer the callback query immediately to remove the loading icon on the user's client
      await ctx.answerCallbackQuery();

      const telegramId = ctx.from.id;
      const firstName = ctx.from.first_name || 'User';

      // 2. Read before updating: `language` stays empty until the very
      // first explicit choice, which is what marks a brand-new user
      // without needing an extra flag on the schema.
      const existing = await findUserByTelegramId(telegramId);
      const isFirstLanguageChoice = !existing?.language;

      // 3. Delegate the business logic (database update) to the User service
      await updateUserLanguage(telegramId, langCode);

      // 4. Retrieve the translations for the newly selected language
      const t = getTranslations(langCode);

      // 5. Edit the previous message (the language selection keyboard) to confirm the change
      if (ctx.msg) {
        await ctx.editMessageText(t.language.changed);
      }

      // 6. Send the welcome message in the newly selected language, with the
      // menu keyboard relabelled to match it.
      await ctx.reply(t.start.welcome(firstName), {
        reply_markup: createMenuKeyboard(t.menu.buttons),
      });

      // 7. Onboarding, as a separate follow-up message. The two hints are
      // independent: someone who wrote a reminder before ever picking a
      // language would otherwise never see the notification hint.
      const onboarding: string[] = [];

      if (isFirstLanguageChoice) {
        onboarding.push(t.start.notificationHint);
      }

      if (existing) {
        // Counts cancelled and completed ones too, so someone who already
        // used the bot is not shown the introduction again.
        const reminderCount = await countUserReminders(existing._id);
        if (reminderCount === 0) {
          onboarding.push(t.reminder.howTo);
        }
      }

      if (onboarding.length > 0) {
        await ctx.reply(onboarding.join('\n\n'));
      }

    } catch (error) {
      console.error('[Language Handler Error]:', error);
      
      // Provide a safe fallback error message
      const t = getTranslations('en'); // Safe fallback
      await ctx.reply(t.errors.unknown);
    }
  });
};