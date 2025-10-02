import crypto from 'node:crypto';

// base64url helpers
const b64url = (s) => Buffer.from(s).toString('base64url');
const sign = (secret, data) =>
  crypto.createHmac('sha256', secret).update(data).digest('base64url');

function makeJWT(secret, payload, expSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const p = { iat: now, exp: now + expSec, ...payload };
  const H = b64url(JSON.stringify(header));
  const P = b64url(JSON.stringify(p));
  const S = sign(secret, `${H}.${P}`);
  return `${H}.${P}.${S}`;
}

function verifyJWT(secret, token) {
  const [H, P, S] = token.split('.');
  if (!H || !P || !S) throw Object.assign(new Error('Bad token'), { statusCode: 401 });
  const expected = sign(secret, `${H}.${P}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(S);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw Object.assign(new Error('Bad signature'), { statusCode: 401 });
  }
  const payload = JSON.parse(Buffer.from(P, 'base64').toString('utf8'));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw Object.assign(new Error('Token expired'), { statusCode: 401 });
  }
  return payload;
}

export default async function authPlugin(app, { jwtSecret }) {
  if (!jwtSecret) throw new Error('authPlugin needs jwtSecret');

  // public login -> returns JWT
  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email', maxLength: 254 } }
      },
      response: { 200: { type: 'object', properties: { token: { type: 'string' } } } }
    }
  }, async (req) => {
    const { email } = req.body;
    const token = makeJWT(jwtSecret, { sub: email });
    return { token };
  });

  // decorator used as guard on /api
  app.decorate('auth', async (req, _reply) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw Object.assign(new Error('Missing token'), { statusCode: 401 });
    req.user = verifyJWT(jwtSecret, token);
  });
}