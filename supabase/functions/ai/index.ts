// AI gateway for the web app: species identification, photo screening, coach chat and translation.
// The Claude API key stays here (secret ANTHROPIC_API_KEY); the browser only sends the signed-in user's token.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Photos need the stronger vision model; short text (coach, translation) uses the fast one unless asked otherwise.
const MODELS: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (code: string, status: number, message = "") => json({ error: { code, message } }, status);

function keyFrom(envJson: string, legacy: string): string {
  try {
    const o = JSON.parse(Deno.env.get(envJson) || "{}");
    if (o && typeof o.default === "string") return o.default;
  } catch (_) { /* fall back to the legacy variable */ }
  return Deno.env.get(legacy) || "";
}
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const PUBLISHABLE = keyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const SECRET = keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(SB_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

function parseJsonLoose(text: string): unknown {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (_) { return null; }
}
async function sha256Hex(b64: string): Promise<string> {
  const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const h = await crypto.subtle.digest("SHA-256", bin);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

type Img = { type?: string; data: string };
type Msg = { role: "user" | "assistant"; content: unknown };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  // who is calling (anonymous accounts count as signed in)
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("not_granted", 401, "missing token");
  const userClient = createClient(SB_URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error: ue } = await userClient.auth.getUser(token);
  if (ue || !u?.user) return fail("not_granted", 401, "invalid session");
  const uid = u.user.id;

  let body: Record<string, any>;
  try { body = await req.json(); } catch (_) { return fail("bad_request", 400); }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (body.mode === "status") return json({ ai: !!apiKey, images: !!apiKey });
  if (!apiKey) return fail("ai_not_configured", 503);

  const images: Img[] = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  for (const im of images) {
    if (!im || typeof im.data !== "string" || im.data.length > 7_000_000) return fail("image_rejected", 413);
  }
  const kind = images.length ? "image" : "text";
  const { data: allowed, error: qe } = await admin.rpc("ai_take", { p_uid: uid, p_kind: kind });
  if (qe) return fail("unavailable", 500, qe.message);
  if (!allowed) return fail("rate_limited", 429, "daily limit reached");

  let messages: Msg[];
  if (Array.isArray(body.input)) {
    messages = body.input
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 20000) }));
  } else {
    messages = [{ role: "user", content: String(body.input ?? "").slice(0, 60000) }];
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") return fail("bad_request", 400, "last message must be from the user");
  if (images.length) {
    const last = messages[messages.length - 1];
    last.content = [
      ...images.map((im) => ({
        type: "image",
        source: { type: "base64", media_type: /^image\/(jpeg|png|webp|gif)$/.test(im.type || "") ? im.type : "image/jpeg", data: im.data },
      })),
      { type: "text", text: String(last.content) },
    ];
  }
  const tier = typeof body.modelTier === "string" ? body.modelTier : "default";
  const model = images.length ? (MODELS[tier] || MODELS.default) : (tier === "complex" ? MODELS.complex : MODELS.quick);

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: body.mode === "json" ? 1500 : 1200, messages }),
    });
  } catch (e) {
    return fail("unavailable", 502, String((e as Error)?.message || e));
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || String(r.status);
    const code = r.status === 429 || r.status === 529 ? "rate_limited" : (r.status === 400 && /image/i.test(msg)) ? "image_rejected" : "unavailable";
    return fail(code, 502, msg);
  }
  if (j.stop_reason === "refusal") return fail("refused", 422);
  const text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const out: Record<string, unknown> = { text, truncated: j.stop_reason === "max_tokens", modelApplied: model };

  if (body.mode === "json") {
    const value: any = parseJsonLoose(text);
    if (value === null || typeof value !== "object") return fail("invalid_json", 502);
    out.value = value;
    // A ticket proves this photo was screened here; the database only keeps a catch 'ok' if it carries one.
    if (body.ticket && images.length) {
      const nonce = crypto.randomUUID();
      const s = (value.screening && typeof value.screening === "object") ? value.screening : {};
      const { error: te } = await admin.from("ai_tickets").insert({
        nonce, uid,
        verdict: typeof value.verdict === "string" ? value.verdict : null,
        fish: value.fish_visible !== false,
        real: typeof s.real_photo === "number" ? s.real_photo : null,
        ai_len: typeof value.length_cm === "number" ? value.length_cm : null,
        sp: Array.isArray(value.candidates) && value.candidates[0] && typeof value.candidates[0].id === "string" ? value.candidates[0].id : null,
        img_hash: await sha256Hex(images[0].data),
      });
      if (!te) out.ticket = nonce;
    }
  }
  return json(out);
});
