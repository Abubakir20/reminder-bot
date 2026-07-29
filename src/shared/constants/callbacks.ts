export const CALLBACKS = {
  LANGUAGE: {
    PREFIX: 'language:set:',

    UZ: 'language:set:uz',
    RU: 'language:set:ru',
    EN: 'language:set:en',
  },

  REMINDER: {
    CREATE: 'reminder:create',
    EDIT: 'reminder:edit',
    DELETE: 'reminder:delete',
    CONFIRM: 'reminder:confirm',
    CANCEL: 'reminder:cancel',
  },

  SETTINGS: {
    OPEN: 'settings:open',
    LANGUAGE: 'settings:language',
    TIMEZONE: 'settings:timezone',
  },

  CONFIRMATION: {
    YES: 'confirmation:yes',
    NO: 'confirmation:no',
  },
} as const;