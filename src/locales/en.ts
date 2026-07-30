import { Translations } from "../shared/types/translation.js";

export const en: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Welcome ${name}!

I am Smart Reminder Bot 🤖

I will remind you about your important tasks on time.

ℹ️ Type /help to see all commands.`,

    welcomeBack: (name: string) =>
      `👋 Welcome back ${name}!

Ready to create new reminders? 😊

ℹ️ Type /help to see all commands.`,
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
    notRegistered: "⚠️ Please send /start first to register.",
  },

  reminder: {
    created: "✅ Reminder created.",
    updated: "✏️ Reminder updated.",
    deleted: "🗑 Reminder deleted.",
    cancelled: "🚫 Reminder cancelled.",

    needTime: "🕐 Please specify a time, e.g. \"tomorrow 18:00\" or \"in 2 hours\".",
    needDate: "🗓 I got the time, but not the date. Try formats like \"9th August\", \"01.08\", or \"tomorrow\".",
    notUnderstood: "🤔 I didn't understand that. Try something like \"tomorrow 18:00 buy medicine\".",
    ambiguous: (token: string, asTime: string, asDate: string) =>
      `🤔 Not sure if "${token}" is a time or a date. Did you mean ${asTime} (time) or ${asDate} (date)?`,
    details: (title: string, time: string) => `✅ Reminder set: "${title}" at ${time}.`,
    repeatLabels: {
      daily: "🔁 Repeats daily",
      weekly: "🔁 Repeats weekly",
      monthly: "🔁 Repeats monthly",
      yearly: "🔁 Repeats yearly",
    },
  },
};