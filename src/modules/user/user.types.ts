import { HydratedDocument } from "mongoose";
import { LanguageCode } from "../../shared/types/translation.js";

export interface IUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;

  language?: LanguageCode;

  timezone: string;
}

export interface CreateUserDto {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;

  language?: LanguageCode;

  timezone?: string;
}

export type UserDocument = HydratedDocument<IUser>;