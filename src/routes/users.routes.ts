import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireArtist } from "../middlewares/artist.middleware";
import { profileImageUpload } from "../middlewares/upload.middleware";
import { validate, becomeArtistSchema } from "../middlewares/validate.middleware";
import { deleteUser, updateProfile, getProfile, uploadArtistProfileImage } from "../controllers/user.controller";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, validate(becomeArtistSchema), updateProfile);
router.patch("/profile/image", requireAuth, requireArtist, profileImageUpload, uploadArtistProfileImage);
router.delete("/account", requireAuth, deleteUser);

export default router;
