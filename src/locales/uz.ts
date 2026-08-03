import { Translations } from "../shared/types/translation.js";

const humanizeMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} soat`);
  if (minutes > 0) parts.push(`${minutes} daqiqa`);

  return parts.length > 0 ? parts.join(" ") : "0 daqiqa";
};

export const uz: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Assalomu alaykum ${name}!

Men Smart Reminder Botman 🤖

Sizga kerakli narsalarni o'z vaqtida eslatib turaman.

ℹ️ Barcha buyruqlarni ko'rish uchun /help ni yuboring.`,

    welcomeBack: (name: string) =>
      `👋 Qaytganingiz bilan ${name}!

Yangi eslatmalar yaratishga tayyorman 😊

ℹ️ Barcha buyruqlarni ko'rish uchun /help ni yuboring.`,

    notificationHint:
      "🔔 Eslatmalar xabar sifatida keladi, shuning uchun bu chat uchun Telegram bildirishnomalarini o'chirmang — chatlar ro'yxatida uni bosib turing va ovoz o'chirilmaganini tekshiring.",
  },

  language: {
    select: "🌍 Iltimos, tilni tanlang.",
    changed: "✅ Til muvaffaqiyatli o'zgartirildi.",
  },

  help: {
    message: `📚 Buyruqlar

/start - Botni ishga tushirish
/list - Eslatmalarim
/edit - Eslatmani o'zgartirish
/language - Tilni o'zgartirish
/help - Yordam`,
  },

  errors: {
    unknown: "❌ Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    notRegistered: "⚠️ Avval ro'yxatdan o'tish uchun /start yuboring.",
  },

  menu: {
    commands: {
      start: "Botni ishga tushirish",
      list: "Eslatmalarim",
      edit: "Eslatmani o'zgartirish",
      language: "Tilni o'zgartirish",
      help: "Yordam",
    },
    buttons: {
      create: "➕ Yangi eslatma",
      list: "📋 Eslatmalarim",
      edit: "✏️ O'zgartirish",
      language: "🌐 Til",
      help: "❓ Yordam",
    },
  },

  reminder: {
    created: "✅ Eslatma yaratildi.",
    updated: "✏️ Eslatma yangilandi.",
    deleted: "🗑 Eslatma o'chirildi.",

    needTime: "🕐 Iltimos, vaqtni ko'rsating, masalan: \"ertaga 18:00\" yoki \"2 soatdan keyin\".",
    needDate: "🗓 Vaqtni tushundim, lekin sanani tushunmadim. Masalan: \"9-avgust\", \"01.08\" yoki \"ertaga\" deb yozing.",
    notUnderstood: "🤔 Tushunmadim. Masalan: \"ertaga 18:00 da dori ichish\" deb yozing.",
    howTo: `✍️ Nima haqida va qachon eslatishni yozing. Masalan:

ertaga 18:00 da dori olish
2 soatdan keyin onamga telefon qilish
har kuni 8:00 da suv ichish`,
    ambiguous: (token: string, asTime: string, asDate: string) =>
      `🤔 "${token}" vaqtmi yoki sanami, tushunmadim. ${asTime} (vaqt) yoki ${asDate} (sana) nazarda tutgandingizmi?`,
    details: (title: string, time: string, leadMinutes: number) =>
      `✅ Eslatma o'rnatildi: "${title}" — ${time}. ${humanizeMinutes(leadMinutes)} oldin ogohlantiraman.`,
    repeatLabels: {
      daily: "🔁 Har kuni takrorlanadi",
      weekly: "🔁 Har hafta takrorlanadi",
      monthly: "🔁 Har oy takrorlanadi",
      yearly: "🔁 Har yili takrorlanadi",
    },

    listEmpty: "📭 Sizda faol eslatmalar yo'q.",
    listHeader: (count: number) => `📋 Eslatmalaringiz (${count}):`,
    listItem: (index: number, title: string, time: string) => `${index}. ${title} — ${time}`,
    cancelButton: "❌ Bekor qilish",
    cancelled: (title: string) => `🚫 Bekor qilindi: "${title}".`,
    cancelFailed: "⚠️ Bekor qilib bo'lmadi — ehtimol, eslatma allaqachon bekor qilingan.",

    editListHeader: "✏️ O'zgartirmoqchi bo'lgan eslatmani tanlang:",
    editPrompt: (title: string, time: string) =>
      `✏️ Hozir: "${title}" — ${time}.\n\nShu xabarga javob qilib yangi matnni yozing, masalan "ertaga 10:00 da shifokorga borish".`,
    editSuccess: (title: string, time: string) => `✅ Yangilandi: "${title}" — ${time}.`,
    editFailed: "⚠️ Eslatmani o'zgartirib bo'lmadi — ehtimol, u endi faol emas.",
  },

  notification: {
    advance: (title: string, time: string, minutesLeft: number) =>
      `⏰ Eslatma: "${title}" — ${time}, ${humanizeMinutes(minutesLeft)} qoldi.`,
    due: (title: string) => `🔔 Vaqt keldi: "${title}".`,
    overdue: (title: string, time: string) =>
      `⏰ Siz "${title}" ni ${time} da bajarishingiz kerak edi — bu kechikkan eslatma.`,
  },
};