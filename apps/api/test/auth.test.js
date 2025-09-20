/* apps/api/test/auth.test.js */
import { describe, it, expect } from "vitest"
import { buildApp } from "../src/app.js"

describe("auth + metrics", () => {
  it("issues a token and protects /api when AUTH_REQUIRED=true", async () => {
    const app = buildApp()
    // stub env for test instance
    process.env.AUTH_REQUIRED = "true"
    process.env.JWT_SECRET = "test-secret"
    await app.ready()

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "me@example.com" }
    })
    expect(login.statusCode).toBe(200)
    const token = login.json().token
    expect(token).toBeTruthy()

    const unauth = await app.inject({ method: "GET", url: "/api/users" })
    expect(unauth.statusCode).toBe(401)

    const ok = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { authorization: Bearer ${token} }
    })
    expect([200,204]).toContain(ok.statusCode)

    const m = await app.inject({ method: "GET", url: "/metrics" })
    expect(m.statusCode).toBe(200)

    await app.close()
  })
})