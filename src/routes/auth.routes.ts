import { Router } from "express";
import { signup, login } from "../controllers/auth.controller";
import { validate, signupSchema, loginSchema } from "../middlewares/validate.middleware";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);

export default router;










