import express from 'express';
import mongoose from 'mongoose';
import { connectDB } from './database/connection.js';
import { env } from './config/env.js';
import { bot } from './bot/index.js';
import { startScheduler, stopScheduler } from './modules/scheduler/scheduler.service.js';

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
  // bot.start() blocks until long polling stops — anything meant to run
  // right after startup must go in onStart, not after this await.
  await bot.start({
    onStart: (botInfo) => {
      console.log(`🤖 Bot @${botInfo.username} started successfully.`);
      startScheduler(bot.api);
    },
  });
};

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  // A second signal (or SIGINT followed by SIGTERM) would otherwise run the
  // teardown twice and throw on closing an already-closed mongoose connection.
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down...`);
  stopScheduler();
  await bot.stop();
  await mongoose.connection.close();
  console.log('Shutdown complete.');
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});