import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { deleteUserAccount } from "../services/user.service";

export const deleteUser = async (
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
