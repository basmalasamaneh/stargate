import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { deleteUserAccount, updateUserProfile } from "../services/user.service";

export const updateMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({
        status: "error",
        message: "firstName and lastName are required",
      });
      return;
    }

    const { token, user } = await updateUserProfile(
      req.userId!,
      firstName,
      lastName
    );

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { token, user },
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message ?? "Internal server error",
    });
  }
};

export const deleteMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
      return;
    }

    await deleteUserAccount(req.userId);

    res.status(200).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message ?? "Internal server error",
    });
  }
};
