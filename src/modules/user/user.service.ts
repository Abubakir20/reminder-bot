import { UserModel } from './user.model.js';
import { CreateUserDto, UserDocument } from './user.types.js';
import { LanguageCode } from "../../shared/types/translation.js";

export const findUserByTelegramId = async (telegramId: number): Promise<UserDocument | null> => {
  return UserModel.findOne({ telegramId }).exec();
};

export const createUser = async (data: CreateUserDto): Promise<UserDocument> => {
  const user = new UserModel(data);
  return user.save();
};

// Returns both the user document and a boolean indicating if it's a new registration
export const findOrCreateUser = async (
  data: CreateUserDto
): Promise<{ user: UserDocument; isNew: boolean }> => {
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
): Promise<UserDocument> => {
  const updated = await UserModel.findOneAndUpdate(
    { telegramId },
    { language },
    { returnDocument: 'after' }
  ).exec();

  if (!updated) {
    throw new Error('User not found');
  }

  return updated;
};