import { Request, Response } from "express";
import * as orderService from "../services/order.service";

export const checkout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) throw new Error("User ID not found in request");
    const orders = await orderService.createOrderFromCart(userId as string, req.body);
    res.status(201).json({ status: "success", message: "تم إنشاء الطلب بنجاح", data: orders });
  } catch (error: any) {
    console.error("POST /orders/:userId/checkout Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const role = (req as any).role;
    if (!userId) throw new Error("User ID not found in request");

    const userOrders = await orderService.getUserOrders(userId as string);
    let artistOrders = [];
    
    if (role === 'artist') {
      artistOrders = await orderService.getArtistOrders(userId as string);
    }

    res.status(200).json({ 
      status: "success", 
      data: {
        purchases: userOrders,
        sales: artistOrders
      } 
    });
  } catch (error: any) {
    console.error("GET /orders/:userId Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const role = (req as any).role;
    if (!userId || !role) throw new Error("User info not found in request");
    const { orderId } = req.params;
    const { status } = req.body;
    const updated = await orderService.updateOrderStatus(orderId as string, userId, role, status);
    res.status(200).json({ status: "success", message: "تم تحديث حالة الطلب", data: updated });
  } catch (error: any) {
    console.error("PATCH /orders/:orderId/status Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params; // The buyer
    if (!userId) throw new Error("User ID is required");
    
    const order = await orderService.createOrder({
      userId: userId as string,
      ...req.body
    });
    
    res.status(201).json({ status: "success", message: "تم إنشاء الطلب بنجاح", data: order });
  } catch (error: any) {
    console.error("POST /orders/:userId Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
