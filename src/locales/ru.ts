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
    notRegistered: "⚠️ Сначала отправьте /start для регистрации.",
  },

  reminder: {
    created: "✅ Напоминание создано.",
    updated: "✅ Напоминание обновлено.",
    deleted: "🗑 Напоминание удалено.",
    cancelled: "🚫 Напоминание отменено.",

    needTime: "🕐 Уточните время, например: «завтра в 18:00» или «через 2 часа».",
    needDate: "🗓 Поняла время, но не дату. Попробуйте так: «9-е августа», «01.08» или «завтра».",
    notUnderstood: "🤔 Не поняла. Попробуйте так: «завтра в 18:00 купить лекарство».",
    ambiguous: (token: string, asTime: string, asDate: string) =>
      `🤔 Не поняла, «${token}» — это время или дата? Вы имели в виду ${asTime} (время) или ${asDate} (дату)?`,
    details: (title: string, time: string) => `✅ Напоминание установлено: «${title}» на ${time}.`,
    repeatLabels: {
      daily: "🔁 Повторяется ежедневно",
      weekly: "🔁 Повторяется еженедельно",
      monthly: "🔁 Повторяется ежемесячно",
      yearly: "🔁 Повторяется ежегодно",
    },
  },
};