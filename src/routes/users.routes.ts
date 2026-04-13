import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate, becomeArtistSchema } from "../middlewares/validate.middleware";
import { deleteUser, updateProfile, getProfile } from "../controllers/user.controller";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, validate(becomeArtistSchema), updateProfile);
router.delete("/account", requireAuth, deleteUser);

export default router;
