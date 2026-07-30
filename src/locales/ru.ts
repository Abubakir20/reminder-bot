import { Translations } from "../shared/types/translation.js";

export const ru: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Добро пожаловать, ${name}!\n\nЯ Smart Reminder Bot 🤖\n\nℹ️ Введите /help, чтобы увидеть все команды.`,

    welcomeBack: (name: string) =>
      `👋 С возвращением, ${name}!\n\nℹ️ Введите /help, чтобы увидеть все команды.`,
  },

  language: {
    select: "🌍 Выберите язык",
    changed: "✅ Язык успешно изменён.",
  },

  help: {
    message: `ℹ️ Команды

/start
/help
/language`,
  },

  errors: {
    unknown: "❌ Произошла ошибка. Попробуйте позже.",
  },

  reminder: {
    created: "✅ Напоминание создано.",
    updated: "✅ Напоминание обновлено.",
    deleted: "🗑 Напоминание удалено.",
    cancelled: "🚫 Напоминание отменено.",
  },
};