import { getSupabase } from "../config/supabase";
import jwt from "jsonwebtoken";

export const updateUserProfile = async (
  userId: string,
  firstName: string,
  lastName: string
) => {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .update({ first_name: firstName, last_name: lastName })
    .eq("id", userId)
    .select("id, email, role, first_name, last_name")
    .single();

  if (error || !user) {
    throw new Error(error?.message ?? "Failed to update user");
  }

  // Issue a fresh JWT with updated names
  const jwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
    },
    jwtSecret,
    { expiresIn: "7d" }
  );

  return { token, user };
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
