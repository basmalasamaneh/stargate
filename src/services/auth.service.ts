import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { LoginInput, SignupInput } from "../types/auth.types";
import { getSupabase } from "../config/supabase";
import { sendOtpEmail } from "./email.service";

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

  // Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const { data: user, error: dbError } = await supabase
    .from("users")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      password: hashedPassword,
      role: "user",
      otp_code: otpCode,
      otp_expires_at: otpExpiresAt,
      is_verified: false,
    })
    .select("id, email, role, first_name, last_name")
    .single();

  if (dbError) throw new Error(dbError.message);

  // Send OTP Email (don't await to avoid delaying response, or await for reliability)
  try {
    await sendOtpEmail(email, firstName, otpCode);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    // We continue anyway, user can resend OTP
  }

  // Create a cart for the new user (Removed: Handled by DB Trigger)
  /*
  const { error: cartError } = await supabase
    .from("carts")
    .insert({ user_id: user.id });

  if (cartError) {
    throw new Error("حدث خطأ أثناء إنشاء السلة: " + cartError.message);
  }
  */

  // We don't return a token yet because the user is not verified
  return { user };
};

export const verifyOtp = async (email: string, code: string) => {
  const supabase = getSupabase();
  
  const { data: user, error } = await supabase
    .from("users")
    .select("id, otp_code, otp_expires_at, is_verified, first_name, last_name, role, email")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !user) {
    throw new Error("المستخدم غير موجود");
  }

  if (user.is_verified) {
    throw new Error("الحساب مفعل بالفعل");
  }

  if (user.otp_code !== code) {
    throw new Error("رمز التحقق غير صحيح");
  }

  if (new Date() > new Date(user.otp_expires_at)) {
    throw new Error("انتهت صلاحية رمز التحقق");
  }

  // Mark as verified
  const { error: updateError } = await supabase
    .from("users")
    .update({ 
      is_verified: true, 
      otp_code: null, 
      otp_expires_at: null 
    })
    .eq("id", user.id);

  if (updateError) throw new Error(updateError.message);

  const token = createJwtToken(user as any);
  return { token, user };
};

export const resendOtp = async (email: string) => {
  const supabase = getSupabase();
  const emailLower = email.toLowerCase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, first_name, is_verified")
    .eq("email", emailLower)
    .single();

  if (error || !user) {
    throw new Error("المستخدم غير موجود");
  }

  if (user.is_verified) {
    throw new Error("الحساب مفعل بالفعل");
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("users")
    .update({ 
      otp_code: otpCode, 
      otp_expires_at: otpExpiresAt 
    })
    .eq("id", user.id);

  if (updateError) throw new Error(updateError.message);

  await sendOtpEmail(emailLower, user.first_name, otpCode);
  return { message: "تم إعادة إرسال الرمز بنجاح" };
};

export const loginUser = async (input: LoginInput) => {
  const email = input.email.toLowerCase();
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, role, first_name, last_name, password, is_verified, artist_name, bio, location, phone, social_media, artist_since, profile_image")
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

  if (!user.is_verified) {
    const authError = new Error("يرجى تفعيل حسابك أولاً. تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
    (authError as any).statusCode = 403;
    (authError as any).notVerified = true;
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
