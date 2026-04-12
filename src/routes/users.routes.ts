import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate, becomeArtistSchema } from "../middlewares/validate.middleware";
import { deleteUser, updateToArtist, getProfile, updateProfile } from "../controllers/user.controller";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, validate(becomeArtistSchema), updateProfile);
router.delete("/account", requireAuth, deleteUser);
router.patch("/become-artist", requireAuth, validate(becomeArtistSchema), updateToArtist);

export default router;
