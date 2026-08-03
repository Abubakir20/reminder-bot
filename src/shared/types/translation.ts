export const SUPPORTED_LANGUAGES = ['uz', 'en', 'ru'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export interface Translations {
  start: {
    welcome: (name: string) => string;
    welcomeBack: (name: string) => string;
    notificationHint: string;
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

  menu: {
    commands: {
      start: string;
      list: string;
      edit: string;
      language: string;
      help: string;
    };
    buttons: {
      create: string;
      list: string;
      edit: string;
      language: string;
      help: string;
    };
  };

  reminder: {
    created: string;
    updated: string;
    deleted: string;

    needTime: string;
    needDate: string;
    notUnderstood: string;
    howTo: string;
    ambiguous: (token: string, asTime: string, asDate: string) => string;
    details: (title: string, time: string, leadMinutes: number) => string;
    repeatLabels: {
      daily: string;
      weekly: string;
      monthly: string;
      yearly: string;
    };

    listEmpty: string;
    listHeader: (count: number) => string;
    listItem: (index: number, title: string, time: string) => string;
    cancelButton: string;
    cancelled: (title: string) => string;
    cancelFailed: string;

    editListHeader: string;
    editPrompt: (title: string, time: string) => string;
    editSuccess: (title: string, time: string) => string;
    editFailed: string;
  };

  notification: {
    advance: (title: string, time: string, minutesLeft: number) => string;
    due: (title: string) => string;
    overdue: (title: string, time: string) => string;
  };
}