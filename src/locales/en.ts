import { Translations } from "../shared/types/translation.js";

export const en: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Welcome ${name}!

I am Smart Reminder Bot 🤖

I will remind you about your important tasks on time.`,

    welcomeBack: (name: string) =>
      `👋 Welcome back ${name}!

Ready to create new reminders? 😊`,
  },

  language: {
    select: "🌍 Please choose your language.",
    changed: "✅ Language has been changed successfully.",
  },

  help: {
    message: `📚 Commands

/start - Start the bot
/help - Help
/language - Change language`,
  },

  errors: {
    unknown: "❌ Something went wrong. Please try again later.",
  },

  reminder: {
    created: "✅ Reminder created.",
    updated: "✏️ Reminder updated.",
    deleted: "🗑 Reminder deleted.",
    cancelled: "🚫 Reminder cancelled.",
  },
};