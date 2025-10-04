import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'

let app

beforeAll(async () => {
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('Users', () => {
  it('create + list', async () => {
    // health sanity
    const h = await app.inject({ method: 'GET', url: '/health' })
    expect(h.statusCode).toBe(200)

    const email = `user+test${Math.floor(Math.random()*1e6)}@example.com`
    const create = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email, name: 'Test' }
    })
    expect(create.statusCode).toBe(201)
    const created = create.json()
    expect(created.email).toBe(email)

    const list = await app.inject({ method: 'GET', url: '/api/users' })
    expect(list.statusCode).toBe(200)
    const items = list.json()
    expect(items.some(u => u.email === email)).toBe(true)
  })
})