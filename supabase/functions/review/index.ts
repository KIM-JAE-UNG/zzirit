// Automatic review of catches waiting for a check. Clear photos are approved, impossible claims are rejected,
// unclear ones are put on hold for the operator. A catch with no photo can't be checked, so it stays in the
// angler's log only ("no" with the code no_photo; the app shows it as "log only", not as a rejection).
// Runs every few minutes (pg_cron) and right after a catch is sent for review; it works at most about once a
// minute however often it is called. Uses the same free Gemini key as `ai`.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const env = (k: string, d = "") => Deno.env.get(k) || d;
const num = (k: string, d: number) => { const v = parseInt(env(k), 10); return Number.isFinite(v) && v > 0 ? v : d; };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
function keyFrom(envJson: string, legacy: string): string {
  try { const o = JSON.parse(Deno.env.get(envJson) || "{}"); if (o && typeof o.default === "string") return o.default; } catch (_) { /* legacy */ }
  return Deno.env.get(legacy) || "";
}
const admin = createClient(env("SUPABASE_URL"), keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

// a better model first (this runs in the background, so a slower answer is fine), then the quick ones
const MODELS = env("REVIEW_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest").split(",").map((s) => s.trim()).filter(Boolean);
const REVIEWER = "00000000-0000-0000-0000-0000000000a1"; // usage counter for the reviewer (shares the app's daily image budget)
const RUN_MS = 105000, PER_ITEM = 4;

type Row = { uid: string; cid: string; sp: string; len: number | null; ts: number | null; at: number | null; past: boolean; rel: boolean; tr: number | null; memo: string; en: string | null; sci: string | null; ko: string | null; l: number | null; x: number | null; photo: string | null };
type Verdict = { v: "ok" | "no" | "hold"; why: string; model: string } | null;

async function gemini(key: string, prompt: string, img: { mime: string; data: string }, deadline: number): Promise<{ value: any; model: string } | null> {
  for (let i = 0; i < MODELS.length; i++) {
    const m = MODELS[i];
    const left = deadline - Date.now(); if (left < 5000) return null;
    const gen: Record<string, unknown> = { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 2048 };
    if (!/lite/.test(m)) gen.thinkingConfig = { thinkingLevel: "low" };
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), Math.min(left, i === 0 ? 35000 : 20000));
    const t0 = Date.now();
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST", signal: ctl.signal,
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: img.mime, data: img.data } }] }], generationConfig: gen }),
      });
      const j: any = await r.json().catch(() => ({}));
      console.log(JSON.stringify({ ev: "review-ai", model: m, status: r.status, ms: Date.now() - t0, finish: j?.candidates?.[0]?.finishReason }));
      if (!r.ok) continue; // quota, busy or missing model: try the next one
      const text = (j?.candidates?.[0]?.content?.parts || []).filter((p: any) => typeof p.text === "string" && !p.thought).map((p: any) => p.text).join("");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s < 0 || e <= s) continue;
      try { return { value: JSON.parse(text.slice(s, e + 1)), model: m }; } catch (_) { continue; }
    } catch (_) {
      console.log(JSON.stringify({ ev: "review-ai", model: m, err: "timeout or network", ms: Date.now() - t0 }));
    } finally { clearTimeout(timer); }
  }
  return null;
}

const n01 = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

async function judge(row: Row, key: string, deadline: number): Promise<Verdict> {
  const now = Date.now(), age = row.at ? now - row.at : 0;
  const sp = String(row.sp || "");
  // plain rules first — no AI needed
  if (!row.len || row.len <= 0 || row.len > 1000) return { v: "no", why: "bad_len|", model: "rule" };
  if (row.ts && row.ts > now + 864e5) return { v: "no", why: "future|", model: "rule" };
  if (row.x && row.len > row.x * 1.3) return { v: "no", why: `size|${row.len}cm`, model: "rule" };
  // a typed-in fish we don't know: nothing anglers land in this app is over 3 m
  if (!row.x && sp.startsWith("other:") && row.len > 300) return { v: "no", why: `size|${row.len}cm`, model: "rule" };
  if (row.x && row.len > row.x) return { v: "hold", why: `record|${row.len}cm`, model: "rule" }; // a record claim: a person takes a look
  // no photo to check: it stays in the angler's own log but never counts (the photo may still be uploading for a while)
  if (!row.photo) return age > 30 * 60000 ? { v: "no", why: "no_photo|", model: "rule" } : null;
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(row.photo);
  if (!m) return { v: "no", why: "no_photo|", model: "rule" };
  const other = sp.startsWith("other:") ? sp.slice(6) : "";
  const name = other ? `${other} (not in our catalog)` : `${row.en || sp || "fish"}${row.sci ? ` (${row.sci})` : ""}`;
  const size = row.l && row.x ? ` This species is usually about ${row.l} cm and the largest on record is about ${row.x} cm.` : "";
  const prompt = `You check catches for a fishing competition app. Judge only what the photo shows.
The angler says this photo shows: ${name}, total length ${row.len} cm.${size}
${row.past ? "It is a catch from an earlier day, registered later." : "It was caught recently."}${row.memo ? ` Angler's note: "${row.memo.slice(0, 120)}"` : ""}

Reply with one JSON object:
{"fish_visible": true|false, "species_match": "yes"|"no"|"unsure", "seen_species": "English name of what you see, or empty",
 "length_plausible": "yes"|"no"|"unsure", "est_length_cm": number or null,
 "real_photo": 0-1, "screenshot": 0-1, "ai_generated": 0-1, "stock_or_web": 0-1, "market_or_aquarium": 0-1,
 "decision": "approve"|"reject"|"unsure", "confidence": 0-1, "reason_ko": "one short sentence in Korean"}
approve: a real photo clearly shows this kind of fish (or squid/octopus) and the length is believable from what is visible.
reject: no fish, a screenshot / AI image / stock or web photo / fish-market or aquarium shot, clearly a different species, or a length that is impossible for the fish shown.
Otherwise: unsure.`;
  const res = await gemini(key, prompt, { mime: m[1], data: m[2] }, deadline);
  if (!res) return age > 6 * 3600e3 ? { v: "hold", why: "ai_late|", model: "rule" } : null; // AI busy: try again on a later run
  const a = res.value || {};
  const conf = n01(a.confidence), why = String(a.reason_ko || "").replace(/\|/g, " ").slice(0, 150);
  const fake = Math.max(n01(a.screenshot), n01(a.ai_generated), n01(a.stock_or_web), n01(a.market_or_aquarium));
  if (a.fish_visible === false && conf >= 0.6) return { v: "no", why: `no_fish|${why}`, model: res.model };
  if (fake >= 0.75) return { v: "no", why: `fake|${why}`, model: res.model };
  if (a.species_match === "no" && conf >= 0.7) return { v: "no", why: `species|${String(a.seen_species || "").slice(0, 40)}`, model: res.model };
  if (a.length_plausible === "no" && conf >= 0.7) return { v: "no", why: `size|${typeof a.est_length_cm === "number" ? Math.round(a.est_length_cm) + "cm" : ""}`, model: res.model };
  if (a.decision === "reject" && conf >= 0.85) return { v: "no", why: `ai_reject|${why}`, model: res.model };
  if (a.decision === "approve" && conf >= 0.7 && a.fish_visible !== false && (a.species_match === "yes" || (other && a.species_match !== "no")) && a.length_plausible !== "no" && n01(a.real_photo) >= 0.6) {
    return { v: "ok", why: `ok|${why}`, model: res.model };
  }
  return { v: "hold", why: `unclear|${why}`, model: res.model };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = env("GEMINI_API_KEY");
  const { data: go, error: ce } = await admin.rpc("review_claim", { p_seconds: 50 });
  if (ce) return json({ ok: false, error: ce.message }, 500);
  if (!go) return json({ ok: true, skipped: true });
  const started = Date.now(), deadline = started + RUN_MS;
  const { data: rows, error } = await admin.rpc("review_queue", { p_limit: PER_ITEM * 2 });
  if (error) return json({ ok: false, error: error.message }, 500);
  const done: Record<string, number> = { ok: 0, no: 0, hold: 0, later: 0 };
  let aiCalls = 0;
  for (const row of (rows || []) as Row[]) {
    if (Date.now() > deadline - 15000) break;
    let verdict: Verdict = null;
    const needsAi = !!row.photo && !!row.len && row.len > 0 && row.len <= 1000 && !(row.x && row.len > row.x)
      && !(!row.x && String(row.sp || "").startsWith("other:") && row.len > 300);
    if (needsAi) {
      if (!key || aiCalls >= PER_ITEM) { done.later++; continue; }
      // count against the app's daily image budget
      const { data: allowed } = await admin.rpc("ai_take", { p_uid: REVIEWER, p_kind: "image", p_lim: num("REVIEW_DAILY", 200), p_glim: num("AI_DAILY_IMAGES", 300) });
      if (allowed !== true) { done.later++; continue; }
      aiCalls++;
    }
    verdict = await judge(row, key, deadline);
    if (!verdict) { done.later++; continue; }
    const { error: se } = await admin.rpc("review_set", { p_uid: row.uid, p_cid: row.cid, p_v: verdict.v, p_why: verdict.why, p_model: verdict.model });
    if (se) { console.log(JSON.stringify({ ev: "review-set", err: se.message })); continue; }
    done[verdict.v]++;
  }
  console.log(JSON.stringify({ ev: "review-run", ms: Date.now() - started, ...done }));
  return json({ ok: true, ...done });
});
