import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { deleteUserAccount, saveArtistProfile, getUserProfile, updateArtistProfileImage } from "../services/user.service";
import { toProfileImagePublicUrl } from "../services/profile-image-storage.service";
import type { BecomeArtistInput } from "../types/auth.types";

const normalizeSocialMedia = (socialMedia: unknown) => {
  if (!socialMedia) return [];
  if (Array.isArray(socialMedia)) return socialMedia;
  if (typeof socialMedia === "string") {
    try {
      const parsed = JSON.parse(socialMedia);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toUserResponse = (user: any) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  role: user.role,
  artistName: user.artist_name,
  artistSince: user.artist_since,
  profileImage: user.profile_image ? toProfileImagePublicUrl(user.profile_image) : null,
  bio: user.bio,
  location: user.location,
  phone: user.phone,
  socialMedia: normalizeSocialMedia(user.social_media),
});

export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: "error", message: "يجب تسجيل الدخول أولاً" });
      return;
    }

    const user = await getUserProfile(req.userId);

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      artistName: user.artist_name,
      artistSince: user.artist_since,
      profileImage: user.profile_image ? toProfileImagePublicUrl(user.profile_image) : null,
      bio: user.bio,
      location: user.location,
      phone: user.phone,
      socialMedia: normalizeSocialMedia(user.social_media),
    };

    res.status(200).json({
      status: "success",
      data: { user: userResponse },
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        status: "error",
        message: "يجب تسجيل الدخول أولاً",
      });
      return;
    }

    await deleteUserAccount(req.userId);

    res.status(200).json({
      status: "success",
      message: "تم حذف الحساب بنجاح",
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        status: "error",
        message: "يجب تسجيل الدخول أولاً",
      });
      return;
    }

    const input: BecomeArtistInput = req.body;
    const currentUser = await getUserProfile(req.userId);
    const user = await saveArtistProfile(req.userId, input);
    const userResponse = toUserResponse(user);
    const successMessage = currentUser.role === "artist"
      ? "تم تحديث الملف الشخصي بنجاح"
      : "تم تسجيلك كفنان بنجاح";

    res.status(200).json({
      status: "success",
      message: successMessage,
      data: { user: userResponse },
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};

export const uploadArtistProfileImage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        status: "error",
        message: "يجب تسجيل الدخول أولاً",
      });
      return;
    }

    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({
        status: "error",
        message: "يجب اختيار صورة قبل الرفع",
      });
      return;
    }

    const user = await updateArtistProfileImage(req.userId, file);

    const userResponse = toUserResponse(user);

    res.status(200).json({
      status: "success",
      message: "تم تحديث الصورة الشخصية بنجاح",
      data: { user: userResponse },
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};
