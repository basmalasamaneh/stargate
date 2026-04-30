import { Request, Response } from "express";
import { loginUser, signupUser, verifyOtp, resendOtp } from "../services/auth.service";

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = await signupUser(req.body);
    res.status(201).json({
      status: "success",
      message: "تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.",
      data: { user },
    });
    
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, user } = await loginUser(req.body);
    res.status(200).json({
      status: "success",
      message: "تم تسجيل الدخول بنجاح",
      data: { token, user },
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
      notVerified: error.notVerified || false,
    });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ status: "error", message: "البريد الإلكتروني والرمز مطلوبان" });
      return;
    }
    const { token, user } = await verifyOtp(email, code);
    res.status(200).json({
      status: "success",
      message: "تم تفعيل الحساب بنجاح",
      data: { token, user },
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 400) || 400;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "فشل تفعيل الحساب",
    });
  }
};

export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ status: "error", message: "البريد الإلكتروني مطلوب" });
      return;
    }
    await resendOtp(email);
    res.status(200).json({
      status: "success",
      message: "تم إعادة إرسال رمز التحقق بنجاح",
    });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 400) || 400;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "فشل إعادة إرسال الرمز",
    });
  }
};
  