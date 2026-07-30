import { Bot } from 'grammy';
import { findUserByTelegramId } from '../../modules/user/user.service.js';
import { getTranslations } from '../../locales/index.js';

export const registerHelpHandler = (bot: Bot): void => {
  bot.command('help', async (ctx) => {
    if (!ctx.from) return;

    try {
      const user = await findUserByTelegramId(ctx.from.id);
      const t = getTranslations(user?.language);

      await ctx.reply(t.help.message);
    } catch (error) {
      console.error('[Help Handler Error]:', error);

      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });
};
