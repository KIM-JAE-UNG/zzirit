// Daily fishing buzz: gathers fishing headlines from Google News RSS (per language), keeps the most
// "look at this catch!" stories and stores only the title, source and link (the story stays with the publisher).
// Runs from a schedule every few hours and when the app notices stale news; refreshes at most once an hour.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
function keyFrom(envJson: string, legacy: string): string {
  try { const o = JSON.parse(Deno.env.get(envJson) || "{}"); if (o && typeof o.default === "string") return o.default; } catch (_) { /* legacy */ }
  return Deno.env.get(legacy) || "";
}
const admin = createClient(Deno.env.get("SUPABASE_URL") || "", keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

type Feed = { hl: string; gl: string; ceid: string; q: string[]; hot: string[]; skip: string[] };
const FEEDS: Record<string, Feed> = {
  ko: { hl: "ko", gl: "KR", ceid: "KR:ko", q: ["낚시 대어", "초대형 물고기 잡혀", "괴물 물고기 낚아", "희귀 어종 잡혀", "대물 낚시 화제"],
    hot: ["대어", "초대형", "괴물", "역대", "기록", "희귀", "거대", "최대", "대물", "화제", "깜짝", "잡혀", "낚아", "낚았", "포획", "kg", "cm", "m짜리"],
    skip: ["주가", "증시", "선거", "사망", "숨져", "실종", "익사", "사고", "관세", "정책", "보이스피싱", "피싱 사기", "스미싱"] },
  en: { hl: "en-US", gl: "US", ceid: "US:en", q: ["record fish caught", "giant fish caught angler", "monster fish caught", "rare fish caught fisherman"],
    hot: ["record", "giant", "monster", "massive", "huge", "rare", "biggest", "pound", "lb", "foot", "caught", "angler", "fisherman", "reel"],
    skip: ["stock", "election", "died", "dies", "drown", "missing", "killed", "tariff", "phishing", "shares"] },
  ja: { hl: "ja", gl: "JP", ceid: "JP:ja", q: ["巨大魚 釣り上げ", "大物 釣れた", "珍しい魚 釣り"],
    hot: ["巨大", "大物", "記録", "珍しい", "釣り上げ", "最大", "キロ", "センチ", "メートル", "仰天", "幻の"],
    skip: ["株価", "選挙", "死亡", "行方不明", "事故", "詐欺"] },
  zh: { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant", q: ["巨型魚 釣到", "罕見魚 釣客", "大魚 釣起"],
    hot: ["巨型", "罕見", "紀錄", "最大", "公斤", "釣到", "驚人", "巨大", "釣起", "大魚"],
    skip: ["股價", "選舉", "死亡", "失蹤", "溺水", "詐騙"] },
};
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();
function parse(xml: string) {
  const out: { title: string; link: string; pub: string; source: string }[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return r ? decode(r[1]) : ""; };
    let title = g("title"); const source = g("source");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    out.push({ title, link: g("link"), pub: g("pubDate"), source });
  }
  return out;
}
async function hashId(s: string) {
  const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { data: go, error: ce } = await admin.rpc("news_claim", { p_minutes: 60 });
  if (ce) return json({ ok: false, error: ce.message }, 500);
  if (!go) return json({ ok: true, skipped: true });
  const now = Date.now(); const rows: Record<string, unknown>[] = [];
  for (const [lang, f] of Object.entries(FEEDS)) {
    const seen = new Set<string>();
    for (const q of f.q) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=${f.hl}&gl=${f.gl}&ceid=${encodeURIComponent(f.ceid)}`;
      let xml = "";
      try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ZZIRIT news bot)" } }); if (r.ok) xml = await r.text(); } catch (_) { /* skip this query */ }
      for (const it of parse(xml)) {
        if (!it.title || !/^https?:\/\//.test(it.link)) continue;
        const key = it.title.toLowerCase().replace(/\s+/g, " ").slice(0, 60);
        if (seen.has(key)) continue; seen.add(key);
        const tl = it.title.toLowerCase();
        if (f.skip.some((w) => tl.includes(w.toLowerCase()))) continue;
        const hits = f.hot.reduce((s, w) => s + (tl.includes(w.toLowerCase()) ? 1 : 0), 0);
        if (hits < 1) continue;
        const pub = it.pub ? new Date(it.pub) : null;
        const ageDays = pub && !isNaN(+pub) ? (now - +pub) / 864e5 : 7;
        rows.push({ id: await hashId(lang + "|" + it.link), lang, title: it.title.slice(0, 300), link: it.link.slice(0, 1500), source: it.source.slice(0, 120),
          pub: pub && !isNaN(+pub) ? pub.toISOString() : null, score: Math.round(hits * 10 + Math.max(0, 7 - ageDays) * 3), fetched_at: new Date(now).toISOString() });
      }
    }
  }
  if (rows.length) { const { error } = await admin.from("news").upsert(rows, { onConflict: "id" }); if (error) return json({ ok: false, error: error.message }, 500); }
  // keep it small: drop stories not seen for 10 days, and keep the best 40 per language
  await admin.from("news").delete().lt("fetched_at", new Date(now - 10 * 864e5).toISOString());
  const { data: all } = await admin.from("news").select("id,lang,score,pub").order("score", { ascending: false }).limit(1000);
  const per: Record<string, number> = {}; const drop: string[] = [];
  for (const r of all || []) { per[r.lang] = (per[r.lang] || 0) + 1; if (per[r.lang] > 40) drop.push(r.id); }
  if (drop.length) await admin.from("news").delete().in("id", drop);
  return json({ ok: true, added: rows.length });
});
