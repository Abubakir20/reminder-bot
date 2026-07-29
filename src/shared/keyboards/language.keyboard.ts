import { InlineKeyboard } from 'grammy';
import { CALLBACKS } from '../constants/callbacks.js';
import { LanguageCode } from '../types/translation.js';

export const createLanguageKeyboard = (): InlineKeyboard => {
  return new InlineKeyboard()
    .text("🇺🇿 O'zbek", CALLBACKS.LANGUAGE.UZ)
    .text('🇷🇺 Русский', CALLBACKS.LANGUAGE.RU)
    .row()
    .text('🇬🇧 English', CALLBACKS.LANGUAGE.EN);
};

export const extractLanguageCode = (
  callbackData: string,
): LanguageCode | null => {
  switch (callbackData) {
    case CALLBACKS.LANGUAGE.UZ:
      return 'uz';

    case CALLBACKS.LANGUAGE.RU:
      return 'ru';

    case CALLBACKS.LANGUAGE.EN:
      return 'en';

    default:
      return null;
  }
};