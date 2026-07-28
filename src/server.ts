import express from 'express';
import { connectDB } from './database/connection.js';
import { env } from './config/env.js';
import { bot } from './bot/index.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Reminder Bot is running'
  });
});

const bootstrap = async () => {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Start Express
  app.listen(env.PORT, () => {
    console.log(`🚀 Express server running on port ${env.PORT}`);
  });

  // 3. Start Telegram Bot
  await bot.start({
    onStart: (botInfo) => {
      console.log(`🤖 Bot @${botInfo.username} started successfully.`);
    },
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});