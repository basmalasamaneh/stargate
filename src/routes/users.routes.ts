import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { deleteUser } from "../controllers/user.controller";

const router = Router();

router.delete("/me", requireAuth, deleteUser);

export default router;
