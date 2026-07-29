import { UserModel } from './user.model.js';
import { IUser, CreateUserDto } from './user.types.js';
import { LanguageCode } from "../../shared/types/translation.js";

export const findUserByTelegramId = async (telegramId: number): Promise<IUser | null> => {
  return UserModel.findOne({ telegramId }).exec();
};

export const createUser = async (data: CreateUserDto): Promise<IUser> => {
  const user = new UserModel(data);
  return user.save();
};

// Returns both the user document and a boolean indicating if it's a new registration
export const findOrCreateUser = async (
  data: CreateUserDto
): Promise<{ user: IUser; isNew: boolean }> => {
  let user = await findUserByTelegramId(data.telegramId);
  
  if (user) {
    return { user, isNew: false };
  }
  
  user = await createUser(data);
  return { user, isNew: true };
};

export const updateUserLanguage = async (
  telegramId: number,
  language: LanguageCode
): Promise<IUser | null> => {
  return UserModel.findOneAndUpdate(
    { telegramId },
    { language },
    { new: true }
  ).exec();
};