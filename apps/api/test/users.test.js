import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'
import { buildApp } from '../src/app.js'

let app

beforeAll(async () => {
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('Users API', () => {
  it('GET /health works', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
  })

  it('POST /api/users validates input', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/users', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/users creates a user, then GET list', async () => {
    const email = `u_${crypto.randomUUID()}@example.com`

    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email, name: 'Test User' },
    })
    expect(created.statusCode).toBe(201)
    const user = created.json()
    expect(user.email).toBe(email)

    const list = await app.inject({ method: 'GET', url: '/api/users' })
    expect(list.statusCode).toBe(200)
    expect(Array.isArray(list.json())).toBe(true)
  })
})