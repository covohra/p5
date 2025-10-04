import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'

let app

beforeAll(async () => {
  // Turn auth ON and set a known token for tests
  process.env.AUTH_REQUIRED = 'true'
  process.env.AUTH_TOKEN = 'faseehvohra' // stable, matches what we’ll use below
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('Users', () => {
  it('create + list', async () => {
    const email = `tester+${Date.now()}@example.com` // ✅ template string

    const create = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: 'Bearer faseehvohra' }, // ✅ include token
      payload: { email, name: 'Test User' }
    })
    expect(create.statusCode).toBe(201)

    const list = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer faseehvohra' } // ✅ include token
    })
    expect(list.statusCode).toBe(200)

    const users = JSON.parse(list.body)
    expect(users.some(u => u.email === email)).toBe(true)
  })
})