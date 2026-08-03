import { Bot, GrammyError, HttpError } from 'grammy';
import type { BotCommand } from 'grammy/types';
import { env } from '../config/env.js';
import { getTranslations } from '../locales/index.js';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../shared/types/translation.js';

import { registerStartHandler } from './handlers/start.handler.js';
import { registerHelpHandler } from './handlers/help.handler.js';
import { registerLanguageHandler } from './handlers/language.handler.js';
import { registerReminderHandler } from './handlers/reminder.handler.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Register handlers
registerStartHandler(bot);
registerHelpHandler(bot);
registerLanguageHandler(bot);
registerReminderHandler(bot);

const buildCommands = (language: LanguageCode): BotCommand[] => {
  const { commands } = getTranslations(language).menu;

  return [
    { command: 'start', description: commands.start },
    { command: 'list', description: commands.list },
    { command: 'edit', description: commands.edit },
    { command: 'language', description: commands.language },
    { command: 'help', description: commands.help },
  ];
};

// Fills the "Menu" button next to the input field. A network hiccup at
// startup must not prevent the bot from running, so failures are logged
// and swallowed.
const registerCommandMenu = async (): Promise<void> => {
  try {
    // Default set for clients whose language has no dedicated list.
    await bot.api.setMyCommands(buildCommands('en'));

    for (const language of SUPPORTED_LANGUAGES) {
      await bot.api.setMyCommands(buildCommands(language), { language_code: language });
    }
  } catch (error) {
    console.error('[Bot] Failed to publish the command menu:', error);
  }
};

void registerCommandMenu();

// Global Error Handler
bot.catch((err) => {
  const ctx = err.ctx;

  console.error(
    `[Bot Error] Error while handling update ${ctx.update.update_id}:`
  );

  const e = err.error;

  if (e instanceof GrammyError) {
    console.error('Telegram Error:', e.description);
  } else if (e instanceof HttpError) {
    console.error('HTTP Error:', e);
  } else {
    console.error('Unknown Error:', e);
  }
});