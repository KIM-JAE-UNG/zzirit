// Web Push for the `push` function: message encryption (RFC 8291, aes128gcm) and the VAPID signature (RFC 8292).
// WebCrypto only, so the same file runs in Deno (Supabase Edge Functions) and in Node 18+ for the tests.
const enc = new TextEncoder();
export const b64u = {
  enc(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/'); const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const bin = atob(s + pad); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
};
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length; } return out; };
async function hkdf(salt, ikm, info, len) { // HKDF-Extract + Expand (SHA-256)
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
/* The encrypted body for one browser subscription ({ p256dh, auth } from PushSubscription.toJSON().keys).
   `opts.salt` and `opts.asKeys` exist only so the tests can replay the RFC 8291 example. */
export async function encryptPayload(sub, plaintext, opts = {}) {
  const uaPub = b64u.dec(sub.p256dh), authSecret = b64u.dec(sub.auth);
  if (uaPub.length !== 65 || authSecret.length !== 16) throw new Error('bad_subscription_keys');
  const as = opts.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const data = concat(typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext, new Uint8Array([2])); // one (last) record
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return concat(head, asPub, ct);
}
/* A new VAPID key pair: the public half goes to browsers, the private half stays on the server (Vault). */
export async function genVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey));
  const j = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { pub, jwk: { kty: j.kty, crv: j.crv, d: j.d, x: j.x, y: j.y } };
}
export async function vapidAuth(endpoint, keys, contact, ttlSec = 12 * 3600) {
  const aud = new URL(endpoint).origin;
  const part = o => b64u.enc(enc.encode(JSON.stringify(o)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud, exp: Math.floor(Date.now() / 1000) + ttlSec, sub: contact });
  const key = await crypto.subtle.importKey('jwk', Object.assign({ ext: true }, keys.jwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.enc(sig)}, k=${keys.pub}`;
}
/* Only the browser makers' push services: never post to any other address someone might have saved. */
export const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
export async function sendPush(sub, payload, keys, contact, { ttl = 86400, urgency = 'normal' } = {}) {
  if (!PUSH_HOSTS.test(sub.endpoint)) return 400;
  const body = await encryptPayload(sub, payload);
  const r = await fetch(sub.endpoint, {
    method: 'POST', body,
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency, Authorization: await vapidAuth(sub.endpoint, keys, contact) }
  });
  try { await r.arrayBuffer(); } catch (_) { /* drain */ }
  return r.status;
}
