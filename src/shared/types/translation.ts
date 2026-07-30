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
    notRegistered: string;
  };

  reminder: {
    created: string;
    updated: string;
    deleted: string;
    cancelled: string;

    needTime: string;
    needDate: string;
    notUnderstood: string;
    ambiguous: (token: string, asTime: string, asDate: string) => string;
    details: (title: string, time: string) => string;
    repeatLabels: {
      daily: string;
      weekly: string;
      monthly: string;
      yearly: string;
    };
  };
}