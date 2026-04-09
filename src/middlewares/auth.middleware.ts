import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ status: "error", message: "No token provided" });
    return;
  }

  const jwtSecret = process.env["JWT_SECRET"];
  const canUseDefaultSecret =
    process.env["NODE_ENV"] === "test" || process.env["NODE_ENV"] === "development";

  if (!jwtSecret && !canUseDefaultSecret) {
    res.status(500).json({ status: "error", message: "Server configuration error" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret ?? "dev-secret") as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
};
