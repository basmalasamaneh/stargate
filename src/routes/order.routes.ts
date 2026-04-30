import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { checkout, getMyOrders, updateStatus, createOrder } from "../controllers/order.controller";

const router = Router();

// api/orders/:userId/checkout
router.post("/:userId/checkout", requireAuth, checkout);

// api/orders/:userId
router.get("/:userId", requireAuth, getMyOrders);
router.post("/:userId", requireAuth, createOrder);

// api/orders/:orderId/status/
router.patch("/:orderId/status", requireAuth, updateStatus);

export default router;
