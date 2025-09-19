/* apps/api/test/auth.test.js */
import { describe, it, expect } from "vitest"
import { buildApp } from "../src/app.js"

describe("auth + health", () => {
  it("health ok", async () => {
    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/health" })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it("login returns a token", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "tester@example.com" }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTruthy()
    await app.close()
  })
})
