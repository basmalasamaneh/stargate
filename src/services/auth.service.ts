import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignupInput } from "../types/auth.types";

const supabase = createClient(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!
);

export const signupUser = async (input: SignupInput) => {
  const { firstName, lastName, email, password } = input;

  // Check if email already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    const error = new Error("Please check your email");
    (error as any).statusCode = 409;
    throw error;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert new user
  const { data: user, error: dbError } = await supabase
    .from("users")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      password: hashedPassword,
      role: "user",
    })
    .select("id, email, role")
    .single();

  if (dbError) throw new Error(dbError.message);

  // Generate JWT token
  const jwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

  const token = jwt.sign(
    { userId: (user as any).id, email: (user as any).email, role: (user as any).role },
    jwtSecret,
    { expiresIn: "7d" }
  );

  return { token, user };
};
