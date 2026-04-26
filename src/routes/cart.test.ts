/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import * as cartService from "../services/cart.service";
import { getSupabase } from "../config/supabase";

jest.mock("../services/cart.service");
jest.mock("../config/supabase", () => ({
  getSupabase: jest.fn(),
}));

const testJwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

const buildToken = (userId: string) =>
  jwt.sign(
    {
      userId,
      email: "user@example.com",
      role: "user",
    },
    testJwtSecret,
    { expiresIn: "7d" }
  );

const mockGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Cart API (/api/v1/cart)", () => {
  const token = buildToken("user-123");

  describe("GET /:cartId", () => {
    it("should return 200 and cart data", async () => {
      (cartService.getCartByCartId as jest.Mock).mockResolvedValueOnce({
        cartId: "cart-123",
        items: []
      });

      const res = await request(app)
        .get("/api/v1/cart/cart-123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.cartId).toBe("cart-123");
    });

    it("should return 401 if token is missing", async () => {
      const res = await request(app).get("/api/v1/cart/cart-123");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /user/:userId", () => {
    it("should return 200 and cart data by user id", async () => {
      (cartService.getCartByUserId as jest.Mock).mockResolvedValueOnce({
        cartId: "cart-123",
        items: []
      });

      const res = await request(app)
        .get("/api/v1/cart/user/user-123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cartId).toBe("cart-123");
    });
  });

  describe("POST /:cartId/items", () => {
    it("should add item and return 200", async () => {
      (cartService.addItemToCart as jest.Mock).mockResolvedValueOnce({
        id: "item-1",
        quantity: 2
      });

      const res = await request(app)
        .post("/api/v1/cart/cart-123/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ artworkId: "art-1", quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(cartService.addItemToCart).toHaveBeenCalledWith("cart-123", {
        artworkId: "art-1",
        quantity: 2
      });
    });

    it("should return 500 for invalid quantity if DB rejects", async () => {
        (cartService.addItemToCart as jest.Mock).mockRejectedValueOnce(new Error("DB Constraint Error"));
        const res = await request(app)
          .post("/api/v1/cart/cart-123/items")
          .set("Authorization", `Bearer ${token}`)
          .send({ artworkId: "art-1", quantity: -1 });
  
        expect(res.status).toBe(500);
      });
  });

  describe("PATCH /:cartId/items/:itemId", () => {
    it("should update quantity", async () => {
      (cartService.updateCartItemQuantity as jest.Mock).mockResolvedValueOnce({
        id: "item-1",
        quantity: 5
      });

      const res = await request(app)
        .patch("/api/v1/cart/cart-123/items/item-1")
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(cartService.updateCartItemQuantity).toHaveBeenCalledWith("cart-123", "item-1", 5);
    });
  });

  describe("DELETE /:cartId/items/:itemId", () => {
    it("should remove item from cart", async () => {
      (cartService.removeItemFromCart as jest.Mock).mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete("/api/v1/cart/cart-123/items/item-1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("تم حذف المنتج من السلة");
      expect(cartService.removeItemFromCart).toHaveBeenCalledWith("cart-123", "item-1");
    });
  });
});
