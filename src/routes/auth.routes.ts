import { Router } from "express";
import { signup } from "../controllers/auth.controller";
import { validate, signupSchema } from "../middlewares/validate.middleware";

const router = Router();

router.post("/signup", validate(signupSchema), signup);

export default router;










