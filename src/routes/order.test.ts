/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import * as orderService from "../services/order.service";

jest.mock("../services/order.service");

const testJwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

const buildToken = (userId: string, role: string = "user") =>
  jwt.sign(
    {
      userId,
      email: "user@example.com",
      role,
    },
    testJwtSecret,
    { expiresIn: "7d" }
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Order API (/api/v1/orders)", () => {
  const buyerToken = buildToken("user-123", "user");
  const artistToken = buildToken("artist-1", "artist");

  describe("POST /:userId/checkout", () => {
    it("should return 201 and created order group", async () => {
      const mockResult = {
        orderGroup: { id: "group-1", total_price: 200 },
        orders: [{ id: "order-1", artist_id: "artist-1" }]
      };
      (orderService.createOrderFromCart as jest.Mock).mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .post("/api/v1/orders/user-123/checkout")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          address: "123 Street",
          city: "Jerusalem",
          phone: "0599000000",
          name: "Recipient Name",
          shippingFee: 15
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.orderGroup.id).toBe("group-1");
      expect(orderService.createOrderFromCart).toHaveBeenCalledWith("user-123", expect.any(Object));
    });

    it("should return 401 if unauthorized", async () => {
      const res = await request(app).post("/api/v1/orders/user-123/checkout");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /:userId", () => {
    it("should return 200 and grouped orders for buyer", async () => {
      const mockGroups = [
        { id: "group-1", orders: [{ id: "order-1", items: [] }] }
      ];
      (orderService.getUserOrders as jest.Mock).mockResolvedValueOnce(mockGroups);

      const res = await request(app)
        .get("/api/v1/orders/user-123")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.purchases).toBeDefined();
      expect(res.body.data.purchases[0].id).toBe("group-1");
    });

    it("should return sales for artist role", async () => {
        (orderService.getUserOrders as jest.Mock).mockResolvedValueOnce([]);
        (orderService.getArtistOrders as jest.Mock).mockResolvedValueOnce([{ id: "sale-1" }]);
  
        const res = await request(app)
          .get("/api/v1/orders/artist-1")
          .set("Authorization", `Bearer ${artistToken}`);
  
        expect(res.status).toBe(200);
        expect(res.body.data.sales).toHaveLength(1);
        expect(res.body.data.sales[0].id).toBe("sale-1");
      });
  });

  describe("PATCH /:orderId/status", () => {
    it("should update status successfully", async () => {
      (orderService.updateOrderStatus as jest.Mock).mockResolvedValueOnce({ id: "order-1", status: "approved" });

      const res = await request(app)
        .patch("/api/v1/orders/order-1/status")
        .set("Authorization", `Bearer ${artistToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith("order-1", "artist-1", "artist", "approved");
    });

    it("should return 500 for invalid status when service throws", async () => {
        (orderService.updateOrderStatus as jest.Mock).mockRejectedValueOnce(new Error("Invalid Status"));
        const res = await request(app)
          .patch("/api/v1/orders/order-1/status")
          .set("Authorization", `Bearer ${artistToken}`)
          .send({ status: "invalid_status" });
  
        expect(res.status).toBe(500);
      });
  });

  describe("POST /:userId", () => {
    it("should return 201 and created order manually", async () => {
      const mockOrder = { id: "order-manual-1", total_price: 150 };
      (orderService.createOrder as jest.Mock).mockResolvedValueOnce(mockOrder);

      const res = await request(app)
        .post("/api/v1/orders/user-123")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          artistId: "artist-1",
          items: [{ artwork_id: "art-1", quantity: 1, price: 100 }],
          shipping_details: {
            address: "Manual St",
            city: "Ramallah",
            phone: "0590000001",
            name: "Test Name",
            shipping_fee: 50
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.id).toBe("order-manual-1");
      expect(orderService.createOrder).toHaveBeenCalledWith(expect.objectContaining({
        userId: "user-123",
        artistId: "artist-1"
      }));
    });

    it("should return 401 if unauthorized for manual order", async () => {
      const res = await request(app).post("/api/v1/orders/user-123");
      expect(res.status).toBe(401);
    });
  });
});
