import { getSupabase } from "../config/supabase";
import type { BecomeArtistInput } from "../types/auth.types";

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

  const { data: user, error } = await supabase
    .from("users")
    .update({
      role: "artist",
      artist_name: input.artistName,
      bio: input.bio,
      location: input.location,
      phone: input.phone,
      social_media: input.socialMedia ? JSON.stringify(input.socialMedia) : null,
    })
    .eq("id", userId)
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media")
    .single();

  if (error) {
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


