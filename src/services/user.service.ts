import { getSupabase } from "../config/supabase";
import type { BecomeArtistInput } from "../types/auth.types";

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

export const becomeArtist = async (userId: string, input: BecomeArtistInput) => {
  const supabase = getSupabase();

  // First check if user is already an artist
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message ?? "Failed to fetch user");
  }

  if (existingUser.role === "artist") {
    const error = new Error("You are already an artist.");
    (error as any).statusCode = 409;
    throw error;
  }

  const { data: user, error } = await supabase
    .from("users")
    .update({
      role: "artist",
      artist_name: input.artistName,
      bio: input.bio,
      location: input.location,
      phone: input.phone,
      social_media: input.socialMedia,
    })
    .eq("id", userId)
    .select("id, email, role, first_name, last_name, artist_name, bio, location, phone, social_media")
    .single();

  if (error) {
    throw new Error(error.message ?? "Failed to become artist");
  }

  return user;
};
