import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';

let app;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Users API', () => {
  it('creates a user and lists users', async () => {
    const email = u_${crypto.randomUUID()}@example.com;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email, name: 'Test User' }
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.email).toBe(email);

    const listRes = await app.inject({ method: 'GET', url: '/api/users' });
    expect(listRes.statusCode).toBe(200);
    const users = listRes.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.find(u => u.email === email)).toBeTruthy();
  });
});