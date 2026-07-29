import { Translations } from "../shared/types/translation.js";

export const ru: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Добро пожаловать, ${name}!\n\nЯ Smart Reminder Bot 🤖`,

    welcomeBack: (name: string) =>
      `👋 С возвращением, ${name}!`,
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