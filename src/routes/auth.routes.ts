import { Router } from "express";
import rateLimit from "express-rate-limit";
import { signup, login } from "../controllers/auth.controller";
import { validate, signupSchema, loginSchema } from "../middlewares/validate.middleware";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "محاولات كثيرة جداً، يرجى الانتظار 15 دقيقة والمحاولة مجدداً" },
  skip: () => process.env["NODE_ENV"] === "test",
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "تجاوزت الحد المسموح به لإنشاء الحسابات، يرجى المحاولة لاحقاً" },
  skip: () => process.env["NODE_ENV"] === "test",
});

router.post("/signup", signupLimiter, validate(signupSchema), signup);
router.post("/login", loginLimiter, validate(loginSchema), login);

export default router;










