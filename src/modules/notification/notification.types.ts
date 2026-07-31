export interface MessageSender {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}

export type NotificationKind = 'advance' | 'due' | 'overdue';
