import { Bot } from 'grammy';
import { updateUserLanguage } from '../../modules/user/user.service.js';
import { getTranslations } from '../../locales/index.js';
import { extractLanguageCode } from '../../shared/keyboards/language.keyboard.js';

export const registerLanguageHandler = (bot: Bot): void => {
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

      // 2. Delegate the business logic (database update) to the User service
      await updateUserLanguage(telegramId, langCode);

      // 3. Retrieve the translations for the newly selected language
      const t = getTranslations(langCode);

      // 4. Edit the previous message (the language selection keyboard) to confirm the change
      if (ctx.msg) {
        await ctx.editMessageText(t.language.changed);
      }

      // 5. Send the welcome message in the newly selected language
      await ctx.reply(t.start.welcome(firstName));

    } catch (error) {
      console.error('[Language Handler Error]:', error);
      
      // Provide a safe fallback error message
      const t = getTranslations('en'); // Safe fallback
      await ctx.reply(t.errors.unknown);
    }
  });
};