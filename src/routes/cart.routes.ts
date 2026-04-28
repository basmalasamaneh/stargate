import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { getCart, addItem, deleteItem, updateQuantity } from "../controllers/cart.controller";

const router = Router();

// api/cart/:cartId
router.get("/:cartId", requireAuth, getCart);

// api/cart/user/:userId
router.get("/user/:userId", requireAuth, getCart);

// api/cart/:cartId/items
router.post("/:cartId/items", requireAuth, addItem);

// api/cart/:cartId/items/:itemId
router.patch("/:cartId/items/:itemId", requireAuth, updateQuantity);

// api/cart/:cartId/items/:itemId
router.delete("/:cartId/items/:itemId", requireAuth, deleteItem);

export default router;
