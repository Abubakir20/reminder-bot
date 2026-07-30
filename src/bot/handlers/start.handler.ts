import { Bot } from 'grammy';
import { findOrCreateUser } from '../../modules/user/user.service.js';
import { getTranslations } from '../../locales/index.js';
import { createLanguageKeyboard } from '../../shared/keyboards/language.keyboard.js';

export const registerStartHandler = (bot: Bot): void => {
  bot.command('start', async (ctx) => {
    // Guard clause: Telegram context might not always have 'from'
    if (!ctx.from) return;

    const { 
      id: telegramId, 
      username, 
      first_name: fullName 
    } = ctx.from;

    try {
      // Delegate DB logic to the user service
      const { user, isNew } = await findOrCreateUser({
        telegramId,
        username,
        fullName,
        // Language remains undefined here until explicitly set via inline keyboard
      });

      // 1. User has no explicitly selected language yet
      if (!user.language) {
        // Fallback to Telegram's default language code to ask for selection
        const t = getTranslations();
        
        await ctx.reply(t.language.select, {
          reply_markup: createLanguageKeyboard(),
        });
        return;
      }

      // 2. User already has a language selected
      const t = getTranslations(user.language);
      
      const displayName = fullName ?? username ?? "User";

      // Select the appropriate welcome message
      const welcomeMessage = isNew 
        ? t.start.welcome(displayName) 
        : t.start.welcomeBack(displayName);

      await ctx.reply(welcomeMessage);

    } catch (error) {
      console.error('[Start Handler Error]:', error);
      
      // Safe fallback for critical errors using the new nested interface
      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });
};