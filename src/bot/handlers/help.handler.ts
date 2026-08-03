import { Bot, Context } from 'grammy';
import { findUserByTelegramId } from '../../modules/user/user.service.js';
import { getTranslations } from '../../locales/index.js';

// Shared by the /help command and the menu button, so both stay in sync.
export const sendHelp = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;

  const user = await findUserByTelegramId(ctx.from.id);
  const t = getTranslations(user?.language ?? ctx.from.language_code);

  await ctx.reply(t.help.message);
};

export const registerHelpHandler = (bot: Bot): void => {
  bot.command('help', async (ctx) => {
    try {
      await sendHelp(ctx);
    } catch (error) {
      console.error('[Help Handler Error]:', error);

      const t = getTranslations('en');
      await ctx.reply(t.errors.unknown);
    }
  });
};
