import request from "supertest";
import { app } from "../server.js";

describe("Auth Endpoints", () => {
  const testUser = {
    name: "Test User",
    email: "testuser@example.com",
    password: "password123",
  };

  it("should register a new user", async () => {
    const res = await request(app).post("/api/auth/register").send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Registration successful");
  });

  it("should login the newly created user", async () => {
    await request(app).post("/api/auth/register").send(testUser);

    const res = await request(app).post("/api/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Login successful");

    // Check if the JWT token cookie is set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((cookie) => cookie.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });
});
