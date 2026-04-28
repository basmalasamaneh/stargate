/// <reference types="jest" />
import request from "supertest";
import app from "../app";
import { signupUser } from "../services/auth.service";

jest.mock("../services/auth.service");

const mockSignupUser = signupUser as jest.MockedFunction<typeof signupUser>;

const validBody = {
  firstName: "user",
  lastName: "test",
  email: "user@example.com",
  password: "Secret123",
  confirmPassword: "Secret123",
};

beforeEach(() => {
  jest.clearAllMocks();
});
// Success 
describe("POST /api/auth/signup", () => {
  it("should return 201 with user (and NO token) on valid input", async () => {
    mockSignupUser.mockResolvedValueOnce({
      user: { id: "uuid-1", email: "user@example.com", role: "user" } as any,
    });

    const res = await request(app).post("/api/v1/auth/signup").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.token).toBeUndefined(); // Token is now only after verification
    expect(res.body.data.user).toBeDefined();
  });

  // Email normalization 
  it("should accept uppercase email and normalize it to lowercase", async () => {
    mockSignupUser.mockResolvedValueOnce({
      user: { id: "uuid-1", email: "user@example.com", role: "user" } as any,
    });

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...validBody, email: "USER@EXAMPLE.COM" });

    expect(res.status).toBe(201);
    expect(mockSignupUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" })
    );
  });

  // Missing firstName
  it("should return 400 when firstName is missing", async () => {
    const { firstName, ...body } = validBody;

    const res = await request(app).post("/api/v1/auth/signup").send(body);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "firstName" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Missing lastName
  it("should return 400 when lastName is missing", async () => {
    const { lastName, ...body } = validBody;

    const res = await request(app).post("/api/v1/auth/signup").send(body);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "lastName" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Invalid email format
  it("should return 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...validBody, email: "notanemail" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Password too short
  it("should return 400 when password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...validBody, password: "Ab1", confirmPassword: "Ab1" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Password missing uppercase
  it("should return 400 when password has no uppercase letter", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        ...validBody,
        password: "secret123",
        confirmPassword: "secret123",
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Password missing lowercase
  it("should return 400 when password has no lowercase letter", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        ...validBody,
        password: "SECRET123",
        confirmPassword: "SECRET123",
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Password missing number
  it("should return 400 when password has no number", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        ...validBody,
        password: "SecretABC",
        confirmPassword: "SecretABC",
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // confirmPassword mismatch
  it("should return 400 when confirmPassword does not match password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...validBody, confirmPassword: "Different999" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "confirmPassword" }),
      ])
    );
    expect(mockSignupUser).not.toHaveBeenCalled();
  });

  // Duplicate email
  it("should return 409 when email is already registered", async () => {
    const error = new Error("Please check your email") as any;
    error.statusCode = 409;
    mockSignupUser.mockRejectedValueOnce(error);

    const res = await request(app).post("/api/v1/auth/signup").send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Please check your email");
  });

  // Server error
  it("should return 500 on unexpected server error", async () => {
    mockSignupUser.mockRejectedValueOnce(new Error("Unexpected DB failure"));

    const res = await request(app).post("/api/v1/auth/signup").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Unexpected DB failure");
  });
});
