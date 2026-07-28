import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env.js';

// Initialize the bot using the strictly typed environment variable
export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// --- Commands ---

bot.command('start', async (ctx) => {
  const welcomeMessage = `
👋 Assalomu alaykum!

Men Smart Reminder Botman.

Men sizga:

✅ Eslatmalar yaratish
✅ Vaqtida xabar yuborish
✅ Oldindan ogohlantirish

imkonini beraman.

Boshlash uchun /help ni yuboring.
`;
  await ctx.reply(welcomeMessage);
});

// --- Global Error Handler ---

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Bot Error] Error while handling update ${ctx.update.update_id}:`);
  
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description);
  } else if (e instanceof HttpError) {
    console.error('Could not contact Telegram:', e);
  } else {
    console.error('Unknown error:', e);
  }
});