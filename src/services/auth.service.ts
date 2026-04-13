import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { LoginInput, SignupInput } from "../types/auth.types";
import { getSupabase } from "../config/supabase";

export const signupUser = async (input: SignupInput) => {
  const { firstName, lastName, password } = input;
  const email = input.email.toLowerCase();
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    const error = new Error("هذا البريد الإلكتروني مستخدم بالفعل");
    (error as any).statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const { data: user, error: dbError } = await supabase
    .from("users")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      password: hashedPassword,
      role: "user",
    })
    .select("id, email, role, first_name, last_name")
    .single();

  if (dbError) throw new Error(dbError.message);

  const token = createJwtToken(user as any);
  return { token, user };
};

export const loginUser = async (input: LoginInput) => {
  const email = input.email.toLowerCase();
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, role, first_name, last_name, password, artist_name, bio, location, phone, social_media")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "تعذر جلب بيانات المستخدم");
  }

  if (!user) {
    const authError = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    (authError as any).statusCode = 401;
    throw authError;
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    const authError = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    (authError as any).statusCode = 401;
    throw authError;
  }

  const token = createJwtToken(user as any);
  const { password, ...userSafe } = user as any;
  return { token, user: userSafe };
};

const createJwtToken = (user: {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
}) => {
  const jwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";
  return jwt.sign(
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
};
