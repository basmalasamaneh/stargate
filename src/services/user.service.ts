import { getSupabase } from "../config/supabase";

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
