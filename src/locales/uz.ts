import { Translations } from "../shared/types/translation.js";

export const uz: Translations = {
  start: {
    welcome: (name: string) =>
      `👋 Assalomu alaykum ${name}!

Men Smart Reminder Botman 🤖

Sizga kerakli narsalarni o'z vaqtida eslatib turaman.`,

    welcomeBack: (name: string) =>
      `👋 Qaytganingiz bilan ${name}!

Yangi eslatmalar yaratishga tayyorman 😊`,
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
  },

  reminder: {
    created: "✅ Eslatma yaratildi.",
    updated: "✏️ Eslatma yangilandi.",
    deleted: "🗑 Eslatma o'chirildi.",
    cancelled: "🚫 Eslatma bekor qilindi.",
  },
};