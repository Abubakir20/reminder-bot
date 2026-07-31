import { getTranslations } from '../../locales/index.js';
import { formatReminderTime } from '../../utils/date.util.js';
import { LanguageCode } from '../../shared/types/translation.js';
import { MessageSender, NotificationKind } from './notification.types.js';

export interface SendReminderNotificationParams {
  telegramId: number;
  language: LanguageCode;
  title: string;
  remindAt: Date;
  timezone: string;
  kind: NotificationKind;
  minutesLeft: number;
}

export const sendReminderNotification = async (
  sender: MessageSender,
  params: SendReminderNotificationParams,
): Promise<void> => {
  const t = getTranslations(params.language);
  const time = formatReminderTime(params.remindAt, params.timezone, params.language);

  let text: string;
  switch (params.kind) {
    case 'advance':
      text = t.notification.advance(params.title, time, params.minutesLeft);
      break;
    case 'due':
      text = t.notification.due(params.title);
      break;
    case 'overdue':
      text = t.notification.overdue(params.title, time);
      break;
  }

  await sender.sendMessage(params.telegramId, text);
};
