import express from 'express';
import { connectDB } from './database/connection.js';
import { env } from './config/env.js';
// import { bot } from './bot'; // We will wire the bot up in the next step

const app = express();
app.use(express.json());

const bootstrap = async () => {
  // 1. Connect to Database
  await connectDB();

  // 2. Start Express Server (useful for cloud health checks)
  app.listen(env.PORT, () => {
    console.log(`🚀 Express server running on port ${env.PORT}`);
  });

  // 3. Start Bot
  // await bot.start();
};

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});