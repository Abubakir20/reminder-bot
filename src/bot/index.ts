import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env.js';
import { findOrCreateUser } from '../modules/user/user.service.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// --- Commands ---

bot.command('start', async (ctx) => {
    // Telegram context might not always have 'from' (e.g. in channels), so we guard against it
    if (!ctx.from) return;

    const {
        id: telegramId,
        username,
        first_name: firstName,
        language_code: languageCode
    } = ctx.from;

    try {
        const { isNew } = await findOrCreateUser({
            telegramId,
            username,
            firstName,
            languageCode,
            timezone: 'Asia/Tashkent'
        });

        if (isNew) {
            await ctx.reply(
                `👋 Assalomu alaykum ${firstName || 'foydalanuvchi'}!

Men Smart Reminder Botman 🤖

Sizga kerakli narsalarni o'z vaqtida eslatib turaman.

/help orqali imkoniyatlarni ko'rishingiz mumkin.`
            );
        } else {
            await ctx.reply(
                `👋 Qaytganingiz bilan ${firstName || 'foydalanuvchi'}!

Yangi eslatma yaratishga tayyorman. 😊

Yordam kerak bo'lsa:
/help`
            );
        }
    } catch (error) {
        console.error('Database error during /start command:', error);
        await ctx.reply(
            `❌ Xatolik yuz berdi.

Iltimos, birozdan keyin qayta urinib ko'ring.`
        );
    }
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