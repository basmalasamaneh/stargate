import { Request, Response } from "express";
import { signupUser } from "../services/auth.service";

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, user } = await signupUser(req.body);
    res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: { token, user },
    });
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: "error",
      message: error.message ?? "Internal server error",
    });
  }
};
  