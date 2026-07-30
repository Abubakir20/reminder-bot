import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env.js';

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