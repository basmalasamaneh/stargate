import { Request, Response } from "express";
import { loginUser, signupUser } from "../services/auth.service";

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, user } = await signupUser(req.body);
    res.status(201).json({
      status: "success",
      message: "تم إنشاء الحساب بنجاح",
      data: { token, user },
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
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
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "حدث خطأ داخلي في الخادم",
    });
  }
};
  