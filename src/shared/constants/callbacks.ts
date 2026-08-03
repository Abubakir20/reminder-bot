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

// reminder:<action>:<reminderId> — keeping the format in one place so it
// doesn't drift between the keyboard that builds it and the handler that
// parses it. ObjectId hex is 24 chars, well under Telegram's 64-byte
// callback_data limit.
const buildPayload = (action: string, reminderId: string): string =>
  `${action}:${reminderId}`;

const parsePayload = (action: string, data: string): string | null => {
  const prefix = `${action}:`;
  if (!data.startsWith(prefix)) {
    return null;
  }

  const reminderId = data.slice(prefix.length);
  return reminderId.length > 0 ? reminderId : null;
};

export const buildCancelReminderPayload = (reminderId: string): string =>
  buildPayload(CALLBACKS.REMINDER.CANCEL, reminderId);

export const parseCancelReminderPayload = (data: string): string | null =>
  parsePayload(CALLBACKS.REMINDER.CANCEL, data);

export const buildEditReminderPayload = (reminderId: string): string =>
  buildPayload(CALLBACKS.REMINDER.EDIT, reminderId);

export const parseEditReminderPayload = (data: string): string | null =>
  parsePayload(CALLBACKS.REMINDER.EDIT, data);