export const SUPPORTED_LANGUAGES = ['uz', 'en', 'ru'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export interface Translations {
  start: {
    welcome: (name: string) => string;
    welcomeBack: (name: string) => string;
  };

  language: {
    select: string;
    changed: string;
  };

  help: {
    message: string;
  };

  errors: {
    unknown: string;
  };

  reminder: {
    created: string;
    updated: string;
    deleted: string;
    cancelled: string;
  };
}