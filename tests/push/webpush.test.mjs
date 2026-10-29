// RFC 8291 section 5 example (and VAPID, RFC 8292), replayed through supabase/functions/push/webpush.js
import { encryptPayload, b64u, genVapid, vapidAuth, PUSH_HOSTS } from '../../supabase/functions/push/webpush.js';
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const raw = b64u.dec(V.asPub);
const jwk = { kty: 'EC', crv: 'P-256', d: V.asPriv, x: b64u.enc(raw.slice(1, 33)), y: b64u.enc(raw.slice(33, 65)), ext: true };
const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const publicKey = await crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
const out = await encryptPayload({ p256dh: V.uaPub, auth: V.auth }, V.plaintext, { salt: b64u.dec(V.salt), asKeys: { privateKey, publicKey } });
ok(b64u.enc(out) === V.body, 'RFC 8291 example body matches byte for byte');
if (b64u.enc(out) !== V.body) console.log(b64u.enc(out));
// a fresh message: different every time, right size, decryptable by the browser side (simulate with ua private key)
const uaPriv = 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94';
const o2 = await encryptPayload({ p256dh: V.uaPub, auth: V.auth }, '{"t":"찌릿","b":"테스트"}');
ok(o2.length === 21 + 65 + new TextEncoder().encode('{"t":"찌릿","b":"테스트"}').length + 1 + 16, 'random message has header + key + ciphertext + tag');
// decrypt it as the browser would
{
  const enc = new TextEncoder(); const salt = o2.slice(0, 16); const asPub = o2.slice(21, 86); const ct = o2.slice(86);
  const uaRaw = b64u.dec(V.uaPub);
  const ujwk = { kty: 'EC', crv: 'P-256', d: uaPriv, x: b64u.enc(uaRaw.slice(1, 33)), y: b64u.enc(uaRaw.slice(33, 65)), ext: true };
  const upk = await crypto.subtle.importKey('jwk', ujwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const apk = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: apk }, upk, 256));
  const H = async (s, i, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', i, 'HKDF', false, ['deriveBits']), n * 8));
  const cat = (...a) => { const r = new Uint8Array(a.reduce((x, y) => x + y.length, 0)); let o = 0; for (const y of a) { r.set(y, o); o += y.length; } return r; };
  const ikm = await H(b64u.dec(V.auth), ecdh, cat(enc.encode('WebPush: info\0'), uaRaw, asPub), 32);
  const cek = await H(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await H(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  ok(new TextDecoder().decode(pt.slice(0, -1)) === '{"t":"찌릿","b":"테스트"}' && pt[pt.length - 1] === 2, 'the browser side can decrypt it (padding delimiter 0x02)');
}
// VAPID: a fresh key pair and a JWT the push service can verify with the public key
const keys = await genVapid();
ok(b64u.dec(keys.pub).length === 65 && keys.jwk.d && !('key_ops' in keys.jwk), 'VAPID key pair (public 65 bytes, private as JWK)');
const hdr = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', keys, 'https://kim-jae-ung.github.io/zzirit/');
const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(hdr);
ok(!!m && m[4] === keys.pub, 'Authorization header shape: vapid t=<jwt>, k=<public key>');
const claims = JSON.parse(new TextDecoder().decode(b64u.dec(m[2])));
ok(claims.aud === 'https://fcm.googleapis.com' && claims.exp > Date.now() / 1000 && claims.exp - Date.now() / 1000 <= 24 * 3600 && claims.sub.startsWith('https://'), 'claims: audience is the push service origin, expiry under 24h, contact set');
const vk = await crypto.subtle.importKey('raw', b64u.dec(keys.pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, b64u.dec(m[3]), new TextEncoder().encode(m[1] + '.' + m[2])), 'signature verifies with the public key (ES256)');
ok(PUSH_HOSTS.test('https://fcm.googleapis.com/fcm/send/x') && PUSH_HOSTS.test('https://web.push.apple.com/QX') && PUSH_HOSTS.test('https://updates.push.services.mozilla.com/wpush/v2/x') && PUSH_HOSTS.test('https://wns2-par02p.notify.windows.com/w/?token=x'), 'known push services allowed');
ok(!PUSH_HOSTS.test('https://evil.example/fcm.googleapis.com/') && !PUSH_HOSTS.test('http://fcm.googleapis.com/x') && !PUSH_HOSTS.test('https://fcm.googleapis.com.evil.example/x') && !PUSH_HOSTS.test('https://localhost/x'), 'anything else refused');
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
