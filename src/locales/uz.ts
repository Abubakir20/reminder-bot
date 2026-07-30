import { Translations } from "../shared/types/translation.js";

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
  },

  language: {
    select: "🌍 Iltimos, tilni tanlang.",
    changed: "✅ Til muvaffaqiyatli o'zgartirildi.",
  },

  help: {
    message: `📚 Buyruqlar

/start - Botni ishga tushirish
/help - Yordam
/language - Tilni o'zgartirish`,
  },

  errors: {
    unknown: "❌ Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    notRegistered: "⚠️ Avval ro'yxatdan o'tish uchun /start yuboring.",
  },

  reminder: {
    created: "✅ Eslatma yaratildi.",
    updated: "✏️ Eslatma yangilandi.",
    deleted: "🗑 Eslatma o'chirildi.",
    cancelled: "🚫 Eslatma bekor qilindi.",

    needTime: "🕐 Iltimos, vaqtni ko'rsating, masalan: \"ertaga 18:00\" yoki \"2 soatdan keyin\".",
    needDate: "🗓 Vaqtni tushundim, lekin sanani tushunmadim. Masalan: \"9-avgust\", \"01.08\" yoki \"ertaga\" deb yozing.",
    notUnderstood: "🤔 Tushunmadim. Masalan: \"ertaga 18:00 da dori ichish\" deb yozing.",
    ambiguous: (token: string, asTime: string, asDate: string) =>
      `🤔 "${token}" vaqtmi yoki sanami, tushunmadim. ${asTime} (vaqt) yoki ${asDate} (sana) nazarda tutgandingizmi?`,
    details: (title: string, time: string) => `✅ Eslatma o'rnatildi: "${title}" — ${time}.`,
    repeatLabels: {
      daily: "🔁 Har kuni takrorlanadi",
      weekly: "🔁 Har hafta takrorlanadi",
      monthly: "🔁 Har oy takrorlanadi",
      yearly: "🔁 Har yili takrorlanadi",
    },
  },
};