import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { deleteUserAccount, becomeArtist } from "../services/user.service";
import type { BecomeArtistInput } from "../types/auth.types";

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

export const updateToArtist = async (
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

    const input: BecomeArtistInput = req.body;
    const user = await becomeArtist(req.userId, input);

    const userResponse = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      artistName: user.artist_name,
      bio: user.bio,
      location: user.location,
      phone: user.phone,
      instagram: user.social_media,
    };

    res.status(200).json({
      status: "success",
      message: "Successfully became an artist",
      data: { user: userResponse },
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message ?? "Internal server error",
    });
  }
};
