import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { deleteMe, updateMe } from "../controllers/user.controller";

const router = Router();

router.patch("/me", requireAuth, updateMe);
router.delete("/me", requireAuth, deleteMe);

export default router;
