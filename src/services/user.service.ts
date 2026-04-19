import { getSupabase } from "../config/supabase";
import { removeProfileImageObject, uploadProfileImageFile } from "./profile-image-storage.service";
import type { BecomeArtistInput } from "../types/auth.types";

const isUniqueArtistNameViolation = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  return (
    error.code === "23505" &&
    (
      (error.message?.includes("uq_users_artist_name_ci") ?? false) ||
      (error.message?.includes("artist_name") ?? false)
    )
  );
};

export const getUserProfile = async (userId: string) => {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media, artist_since, profile_image")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message ?? "تعذر جلب الملف الشخصي");
  }

  return user;
};

export const upsertArtistProfile = async (userId: string, input: BecomeArtistInput) => {
  const supabase = getSupabase();
  const normalizedArtistName = input.artistName.trim();

  const { data: existingArtists, error: existingArtistError } = await supabase
    .from("users")
    .select("id")
    .eq("role", "artist")
    .ilike("artist_name", normalizedArtistName)
    .neq("id", userId)
    .limit(1);

  if (existingArtistError) {
    throw new Error(existingArtistError.message ?? "تعذر التحقق من توفر الاسم الفني");
  }

  if ((existingArtists?.length ?? 0) > 0) {
    const conflictError = new Error("الاسم الفني مستخدم بالفعل");
    (conflictError as any).statusCode = 409;
    throw conflictError;
  }

  // Fetch current artist_since so we never overwrite it on profile updates
  const { data: currentUser } = await supabase
    .from("users")
    .select("artist_since")
    .eq("id", userId)
    .single();

  const artistSince = currentUser?.artist_since ?? new Date().toISOString();

  const { data: user, error } = await supabase
    .from("users")
    .update({
      role: "artist",
      artist_name: normalizedArtistName,
      bio: input.bio,
      location: input.location,
      phone: input.phone,
      social_media: input.socialMedia ? JSON.stringify(input.socialMedia) : null,
      artist_since: artistSince,
    })
    .eq("id", userId)
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media, artist_since, profile_image")
    .single();

  if (error) {
    if (isUniqueArtistNameViolation(error)) {
      const conflictError = new Error("الاسم الفني مستخدم بالفعل");
      (conflictError as any).statusCode = 409;
      throw conflictError;
    }
    throw new Error(error.message ?? "تعذر تحديث الملف الشخصي");
  }

  return user;
};

export const updateArtistProfileImage = async (userId: string, file: Express.Multer.File) => {
  const supabase = getSupabase();

  const { data: currentUser, error: currentUserError } = await supabase
    .from("users")
    .select("id, role, profile_image")
    .eq("id", userId)
    .single();

  if (currentUserError || !currentUser) {
    throw new Error(currentUserError?.message ?? "تعذر التحقق من المستخدم");
  }

  if (currentUser.role !== "artist") {
    const roleError = new Error("هذا الإجراء متاح للفنانين فقط");
    (roleError as any).statusCode = 403;
    throw roleError;
  }

  const previousImagePath = currentUser.profile_image as string | null;
  let uploadedStoragePath = "";

  try {
    uploadedStoragePath = await uploadProfileImageFile(file, userId);

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ profile_image: uploadedStoragePath })
      .eq("id", userId)
      .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media, artist_since, profile_image")
      .single();

    if (updateError || !updatedUser) {
      throw new Error(updateError?.message ?? "تعذر تحديث الصورة الشخصية");
    }

    if (previousImagePath && previousImagePath !== uploadedStoragePath) {
      await removeProfileImageObject(previousImagePath).catch(() => undefined);
    }

    return updatedUser;
  } catch (error) {
    if (uploadedStoragePath) {
      await removeProfileImageObject(uploadedStoragePath).catch(() => undefined);
    }
    throw error;
  }
};

export const deleteUserAccount = async (userId: string) => {
  const supabase = getSupabase();

  const { data: currentUser } = await supabase
    .from("users")
    .select("profile_image")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    throw new Error(error.message ?? "تعذر حذف الحساب");
  }

  if (currentUser?.profile_image) {
    await removeProfileImageObject(currentUser.profile_image).catch(() => undefined);
  }
};


