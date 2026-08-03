export interface SendMessageOptions {
  disable_notification?: boolean;
}

export interface MessageSender {
  sendMessage(chatId: number, text: string, options?: SendMessageOptions): Promise<unknown>;
}

export type NotificationKind = 'advance' | 'due' | 'overdue';
