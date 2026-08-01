import { cleanEnv, str, port } from 'envalid';
import { config } from 'dotenv';

// Load variables from .env into process.env
config(); 

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production'], default: 'development' }),
  PORT: port({ default: 3000 }),
  MONGO_URI: str(),
  TELEGRAM_BOT_TOKEN: str(),
  GEMINI_API_KEY: str(),
  GEMINI_MODEL: str({ default: 'gemini-3.5-flash' }),
});