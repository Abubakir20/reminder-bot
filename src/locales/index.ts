import { LanguageCode, Translations } from '../shared/types/translation.js';
import { en } from './en.js';
import { ru } from './ru.js';
import { uz } from './uz.js';

const locales: Record<LanguageCode, Translations> = { en, ru, uz };

export const getTranslations = (langCode?: string | null): Translations => {
  // Validate if the provided code is one of our supported languages
  const isValidLangCode = langCode === 'en' || langCode === 'ru' || langCode === 'uz';
  
  const code: LanguageCode = isValidLangCode ? (langCode as LanguageCode) : 'uz';
  
  return locales[code];
};