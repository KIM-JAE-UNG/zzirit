// AI gateway for the web app: species identification + photo screening, coach chat, translation.
// Provider: Google Gemini (secret GEMINI_API_KEY, free tier) when set, otherwise Claude (secret ANTHROPIC_API_KEY).
// Keys stay here; the browser only sends the signed-in user's token.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const env = (k: string, d = "") => Deno.env.get(k) || d;
const num = (k: string, d: number) => { const v = parseInt(env(k), 10); return Number.isFinite(v) && v > 0 ? v : d; };
const list = (k: string, d: string) => env(k, d).split(",").map((s) => s.trim()).filter(Boolean);
// daily limits per account and for the whole app (the free tier has its own daily cap too)
const LIMITS: Record<string, [number, number]> = {
  image: [num("AI_USER_IMAGES", 20), num("AI_DAILY_IMAGES", 300)],
  text: [num("AI_USER_TEXT", 30), num("AI_DAILY_TEXT", 600)],
};
// tried in order; the next model is used when one is out of free quota, busy or too slow.
// Measured on the free tier (2026-10-28, same photo): 3.5-flash-lite ~1.6 s, 3.6-flash 10-25 s, 3.8-flash overloaded (503 / no answer in 45 s).
const GEM_IMAGE = list("GEMINI_IMAGE_MODELS", "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.8-flash,gemini-flash-latest");
const GEM_TEXT = list("GEMINI_TEXT_MODELS", "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-flash-latest");
// thinking makes answers slower; "low" for the bigger fallback models (flash-lite already defaults to minimal)
const GEM_THINKING = env("GEMINI_THINKING", "low");
// time limits (ms): the whole answer, the first model, each fallback model
const TIME: Record<string, [number, number, number]> = { image: [50000, 15000, 20000], text: [30000, 12000, 12000] };
const CLAUDE: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };

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
const SB_URL = env("SUPABASE_URL");
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
type Turn = { role: "user" | "assistant"; content: string };
type Out = { text?: string; model?: string; truncated?: boolean; refused?: boolean; err?: { status: number; msg: string } };

async function callGemini(key: string, models: string[], turns: Turn[], images: Img[], wantJson: boolean): Promise<Out> {
  const contents = turns.map((t, i) => {
    const parts: Record<string, unknown>[] = [{ text: t.content }];
    if (i === turns.length - 1) for (const im of images) parts.push({ inlineData: { mimeType: /^image\/(jpeg|png|webp)$/.test(im.type || "") ? im.type : "image/jpeg", data: im.data } });
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });
  const [total, first, next] = TIME[images.length ? "image" : "text"];
  const started = Date.now();
  let last = { status: 0, msg: "" };
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    const left = total - (Date.now() - started);
    if (left < 4000) break;
    let think = !!GEM_THINKING && !/lite/.test(m);
    for (let attempt = 0; attempt < 2; attempt++) {
      const gen: Record<string, unknown> = { temperature: wantJson ? 0.2 : 0.6 };
      if (wantJson) gen.responseMimeType = "application/json";
      gen.maxOutputTokens = 4096; // stops a runaway answer from using up the time limit
      if (think) gen.thinkingConfig = { thinkingLevel: GEM_THINKING };
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), Math.min(left, i === 0 ? first : next));
      const t0 = Date.now();
      let r: Response | null = null, j: any = {};
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: "POST",
          signal: ctl.signal,
          headers: { "x-goog-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({ contents, generationConfig: gen }),
        });
        j = await r.json().catch(() => ({}));
      } catch (e) {
        last = ctl.signal.aborted ? { status: 504, msg: "timeout" } : { status: 502, msg: String((e as Error)?.message || e) };
        r = null;
      } finally { clearTimeout(timer); }
      // timing and token counts only (never the prompt, photo or answer)
      console.log(JSON.stringify({ ev: "gemini", model: m, think, status: r ? r.status : last.status, ms: Date.now() - t0, finish: j?.candidates?.[0]?.finishReason, usage: j?.usageMetadata, err: r && r.ok ? undefined : String(r ? j?.error?.message || "" : last.msg).slice(0, 200) }));
      if (!r) break; // too slow or network error: next model
      if (r.ok) {
        if (j?.promptFeedback?.blockReason) return { refused: true };
        const cand = j?.candidates?.[0];
        if (!cand) { last = { status: 502, msg: "empty response" }; break; }
        if (/SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(String(cand.finishReason || ""))) return { refused: true };
        const text = (cand.content?.parts || []).filter((p: any) => typeof p.text === "string" && !p.thought).map((p: any) => p.text).join("");
        if (!text) { last = { status: 502, msg: "no text" }; break; }
        return { text, model: m, truncated: cand.finishReason === "MAX_TOKENS" };
      }
      last = { status: r.status, msg: j?.error?.message || String(r.status) };
      // a model that does not take this thinking setting: ask the same model again without it
      if (r.status === 400 && think && /think/i.test(last.msg)) { think = false; continue; }
      break;
    }
    // quota, missing model, overload or timeout: try the next model; anything else is final
    if (!(last.status === 429 || last.status === 404 || last.status >= 500 || /quota|exhaust|not found|overload|unavailable|timeout/i.test(last.msg))) break;
  }
  return { err: last };
}

async function callClaude(key: string, model: string, turns: Turn[], images: Img[], maxTokens: number): Promise<Out> {
  const messages: any[] = turns.map((t) => ({ role: t.role, content: t.content }));
  if (images.length) {
    const lastMsg = messages[messages.length - 1];
    lastMsg.content = [
      ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: /^image\/(jpeg|png|webp|gif)$/.test(im.type || "") ? im.type : "image/jpeg", data: im.data } })),
      { type: "text", text: String(lastMsg.content) },
    ];
  }
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
  } catch (e) { return { err: { status: 502, msg: String((e as Error)?.message || e) } }; }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return { err: { status: r.status === 529 ? 429 : r.status, msg: j?.error?.message || String(r.status) } };
  if (j.stop_reason === "refusal") return { refused: true };
  const text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { text, model, truncated: j.stop_reason === "max_tokens" };
}

// account id (a linked device acts for the account that holds the records)
async function acctOf(uid: string): Promise<string> {
  const { data, error } = await admin.rpc("acct_of", { p_uid: uid });
  return !error && typeof data === "string" && data ? data : uid;
}
async function take(uid: string, kind: string): Promise<boolean | null> {
  const [lim, glim] = LIMITS[kind];
  let r = await admin.rpc("ai_take", { p_uid: uid, p_kind: kind, p_lim: lim, p_glim: glim });
  if (r.error) r = await admin.rpc("ai_take", { p_uid: uid, p_kind: kind }); // older database without per-call limits
  if (r.error) return null;
  return r.data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("not_granted", 401, "missing token");
  const userClient = createClient(SB_URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error: ue } = await userClient.auth.getUser(token);
  if (ue || !u?.user) return fail("not_granted", 401, "invalid session");

  let body: Record<string, any>;
  try { body = await req.json(); } catch (_) { return fail("bad_request", 400); }
  const gem = env("GEMINI_API_KEY"), ant = env("ANTHROPIC_API_KEY");
  if (body.mode === "status") return json({ ai: !!(gem || ant), images: !!(gem || ant), provider: gem ? "gemini" : ant ? "claude" : null, limits: { images: LIMITS.image[0] } });
  if (!gem && !ant) return fail("ai_not_configured", 503);

  const uid = await acctOf(u.user.id);
  const images: Img[] = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  for (const im of images) {
    if (!im || typeof im.data !== "string" || im.data.length > 7_000_000) return fail("image_rejected", 413);
  }
  const kind = images.length ? "image" : "text";
  const allowed = await take(uid, kind);
  if (allowed === null) return fail("unavailable", 500, "quota check failed");
  if (!allowed) return fail("rate_limited", 429, "daily limit reached");

  let turns: Turn[];
  if (Array.isArray(body.input)) {
    turns = body.input
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 20000) }));
  } else {
    turns = [{ role: "user", content: String(body.input ?? "").slice(0, 60000) }];
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") return fail("bad_request", 400, "last message must be from the user");
  const wantJson = body.mode === "json";
  if (wantJson) turns[turns.length - 1].content += "\n\nReply with a single JSON object only.";

  const tier = typeof body.modelTier === "string" ? body.modelTier : "default";
  const out = gem
    ? await callGemini(gem, images.length ? GEM_IMAGE : GEM_TEXT, turns, images, wantJson)
    : await callClaude(ant, images.length ? (CLAUDE[tier] || CLAUDE.default) : (tier === "complex" ? CLAUDE.complex : CLAUDE.quick), turns, images, wantJson ? 1500 : 1200);
  if (out.refused) return fail("refused", 422);
  if (out.err || typeof out.text !== "string") {
    const e = out.err || { status: 502, msg: "no text" };
    const code = e.status === 429 || /quota|exhaust|rate/i.test(e.msg) ? "rate_limited" : (e.status === 400 && /image|inline|mime/i.test(e.msg)) ? "image_rejected" : "unavailable";
    return fail(code, 502, e.msg);
  }
  const res: Record<string, unknown> = { text: out.text, truncated: !!out.truncated, modelApplied: out.model };
  if (wantJson) {
    const value: any = parseJsonLoose(out.text);
    if (value === null || typeof value !== "object") return fail("invalid_json", 502);
    res.value = value;
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
      if (!te) res.ticket = nonce;
    }
  }
  return json(res);
});
