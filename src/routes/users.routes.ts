import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate, becomeArtistSchema } from "../middlewares/validate.middleware";
import { deleteUser, updateToArtist } from "../controllers/user.controller";

const router = Router();

router.delete("/me", requireAuth, deleteUser);
router.patch("/become-artist", requireAuth, validate(becomeArtistSchema), updateToArtist);

export default router;
