import { Request, Response } from "express";
import * as cartService from "../services/cart.service";

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as any).userId;
    const { cartId, userId } = req.params;
    if (!authUserId) throw new Error("User ID not found in request");

    let cart;
    if (cartId) {
      cart = await cartService.getCartByCartId(cartId as string);
    } else if (userId) {
      cart = await cartService.getCartByUserId(userId as string);
    } else {
      throw new Error("Cart ID or User ID is required");
    }

    res.status(200).json({ status: "success", data: cart });
  } catch (error: any) {
    console.error("GET /cart Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const addItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { cartId } = req.params;
    if (!userId) throw new Error("User ID not found in request");

    const cart = await cartService.addItemToCart(cartId as string, req.body);
    res.status(200).json({ status: "success", message: "تمت إضافة المنتج للسلة", data: cart });
  } catch (error: any) {
    console.error("POST /cart/:cartId/items Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { cartId, itemId } = req.params;
    if (!userId) throw new Error("User ID not found in request");

    const cart = await cartService.removeItemFromCart(cartId as string, itemId as string);
    res.status(200).json({ status: "success", message: "تم حذف المنتج من السلة", data: cart });
  } catch (error: any) {
    console.error("DELETE /cart/:cartId/items/:itemId Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateQuantity = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { cartId, itemId } = req.params;
    const { quantity } = req.body;
    if (!userId) throw new Error("User ID not found in request");

    const cart = await cartService.updateCartItemQuantity(cartId as string, itemId as string, quantity);
    res.status(200).json({ status: "success", message: "تم تحديث الكمية", data: cart });
  } catch (error: any) {
    console.error("PATCH /cart/:cartId/items/:itemId Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
