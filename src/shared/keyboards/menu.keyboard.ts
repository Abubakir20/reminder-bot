import { Keyboard } from 'grammy';

export interface MenuButtonLabels {
  create: string;
  list: string;
  language: string;
  help: string;
}

export const createMenuKeyboard = (labels: MenuButtonLabels): Keyboard => {
  return new Keyboard()
    .text(labels.create)
    .row()
    .text(labels.list)
    .row()
    .text(labels.language)
    .text(labels.help)
    .resized()
    .persistent();
};
