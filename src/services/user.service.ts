import { getSupabase } from "../config/supabase";
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
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message ?? "Failed to fetch user profile");
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
    throw new Error(existingArtistError.message ?? "Failed to check artist name availability");
  }

  if ((existingArtists?.length ?? 0) > 0) {
    const conflictError = new Error("Artist name is already in use.");
    (conflictError as any).statusCode = 409;
    throw conflictError;
  }

  const { data: user, error } = await supabase
    .from("users")
    .update({
      role: "artist",
      artist_name: normalizedArtistName,
      bio: input.bio,
      location: input.location,
      phone: input.phone,
      social_media: input.socialMedia ? JSON.stringify(input.socialMedia) : null,
    })
    .eq("id", userId)
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media")
    .single();

  if (error) {
    if (isUniqueArtistNameViolation(error)) {
      const conflictError = new Error("Artist name is already in use.");
      (conflictError as any).statusCode = 409;
      throw conflictError;
    }
    throw new Error(error.message ?? "Failed to update profile");
  }

  return user;
};

export const deleteUserAccount = async (userId: string) => {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    throw new Error(error.message ?? "Failed to delete user");
  }
};


