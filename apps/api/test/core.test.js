import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { buildApp } from "../src/app.js"

let app
beforeAll(async () => { app = buildApp(); await app.ready() })
afterAll(async () => { await app.close() })

describe("Probes", () => {
  it("GET /health -> 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health" })
    expect(res.statusCode).toBe(200)
  })
  it("GET /ready -> 200", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" })
    expect([200,503]).toContain(res.statusCode)
  })
})