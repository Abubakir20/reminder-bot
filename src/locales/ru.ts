import { Translations } from "../shared/types/translation.js";

const pluralizeRu = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

const humanizeMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(
      hours === 1 && minutes === 0 ? "час" : `${hours} ${pluralizeRu(hours, "час", "часа", "часов")}`,
    );
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${pluralizeRu(minutes, "минуту", "минуты", "минут")}`);
  }

  return parts.length > 0 ? parts.join(" ") : "0 минут";
};

export const ru: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Добро пожаловать, ${name}!\n\nЯ Smart Reminder Bot 🤖\n\nℹ️ Введите /help, чтобы увидеть все команды.`,

    welcomeBack: (name: string) =>
      `👋 С возвращением, ${name}!\n\nℹ️ Введите /help, чтобы увидеть все команды.`,

    notificationHint:
      "🔔 Напоминания приходят сообщениями, поэтому не отключайте уведомления Telegram для этого чата — задержите на нём палец в списке чатов и проверьте, что звук не выключен.",
  },

  language: {
    select: "🌍 Выберите язык",
    changed: "✅ Язык успешно изменён.",
  },

  help: {
    message: `ℹ️ Команды

/start - Запустить бота
/list - Мои напоминания
/edit - Изменить напоминание
/language - Сменить язык
/help - Помощь`,
  },

  errors: {
    unknown: "❌ Произошла ошибка. Попробуйте позже.",
    notRegistered: "⚠️ Сначала отправьте /start для регистрации.",
  },

  menu: {
    commands: {
      start: "Запустить бота",
      list: "Мои напоминания",
      edit: "Изменить напоминание",
      language: "Сменить язык",
      help: "Помощь",
    },
    buttons: {
      create: "➕ Новое напоминание",
      list: "📋 Мои напоминания",
      edit: "✏️ Изменить",
      language: "🌐 Язык",
      help: "❓ Помощь",
    },
  },

  reminder: {
    created: "✅ Напоминание создано.",
    updated: "✅ Напоминание обновлено.",
    deleted: "🗑 Напоминание удалено.",

    needTime: "🕐 Уточните время, например: «завтра в 18:00» или «через 2 часа».",
    needDate: "🗓 Время распознано, а дата — нет. Попробуйте так: «9-е августа», «01.08» или «завтра».",
    notUnderstood: "🤔 Не удалось разобрать. Попробуйте так: «завтра в 18:00 купить лекарство».",
    howTo: `✍️ Просто напишите, о чём и когда напомнить. Например:

завтра в 18:00 забрать лекарства
через 2 часа позвонить маме
каждую неделю в 10:00 планёрка`,
    ambiguous: (token: string, asTime: string, asDate: string) =>
      `🤔 Непонятно, «${token}» — это время или дата? Вы имели в виду ${asTime} (время) или ${asDate} (дату)?`,
    details: (title: string, time: string, leadMinutes: number) =>
      `✅ Напоминание установлено: «${title}» на ${time}. Уведомление придёт за ${humanizeMinutes(leadMinutes)} до срока.`,
    repeatLabels: {
      daily: "🔁 Повторяется ежедневно",
      weekly: "🔁 Повторяется еженедельно",
      monthly: "🔁 Повторяется ежемесячно",
      yearly: "🔁 Повторяется ежегодно",
    },

    listEmpty: "📭 У вас нет активных напоминаний.",
    listHeader: (count: number) => `📋 Ваши напоминания (${count}):`,
    listItem: (index: number, title: string, time: string) => `${index}. ${title} — ${time}`,
    cancelButton: "❌ Отменить",
    cancelled: (title: string) => `🚫 Отменено: «${title}».`,
    cancelFailed: "⚠️ Не удалось отменить — возможно, напоминание уже отменено.",

    editListHeader: "✏️ Выберите напоминание, которое нужно изменить:",
    editPrompt: (title: string, time: string) =>
      `✏️ Сейчас: «${title}» на ${time}.\n\nОтветьте на это сообщение новой формулировкой, например «завтра в 10:00 позвонить врачу».`,
    editSuccess: (title: string, time: string) => `✅ Обновлено: «${title}» на ${time}.`,
    editFailed: "⚠️ Не удалось изменить напоминание — возможно, оно больше не активно.",
  },

  notification: {
    advance: (title: string, time: string, minutesLeft: number) =>
      `⏰ Напоминание: «${title}» в ${time} — осталось ${humanizeMinutes(minutesLeft)}.`,
    due: (title: string) => `🔔 Время пришло: «${title}».`,
    overdue: (title: string, time: string) =>
      `⏰ Вы собирались «${title}» в ${time} — напоминание с опозданием.`,
  },
};