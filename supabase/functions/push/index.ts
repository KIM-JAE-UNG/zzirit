// Phone notifications (Web Push). The app asks this function to tell someone about something it just did — a reply,
// a friend request, a team request, the operator's notice or a confirmed payment. The database checks that it really
// happened (push_check), that it goes out only once and that no one sends too many (push_once). The automatic
// reviewer calls it with the server key to report review results. The VAPID key pair is made here once and kept in
// Vault; only the public half ever leaves the server. Messages are short and in the reader's language.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { genVapid, sendPush, PUSH_HOSTS } from "./webpush.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const env = (k: string, d = "") => Deno.env.get(k) || d;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
function keyFrom(envJson: string, legacy: string): string {
  try { const o = JSON.parse(Deno.env.get(envJson) || "{}"); if (o && typeof o.default === "string") return o.default; } catch (_) { /* legacy */ }
  return Deno.env.get(legacy) || "";
}
const SERVER_KEY = keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(env("SUPABASE_URL"), SERVER_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const SITE = env("SITE_URL", "https://kim-jae-ung.github.io/zzirit/");
const ZERO = "00000000-0000-0000-0000-000000000000";

type Keys = { pub: string; jwk: Record<string, string> };
let KEYS: Keys | null = null;
async function vapid(): Promise<Keys> {
  if (KEYS) return KEYS;
  const { data } = await admin.rpc("push_vapid");
  if (data && data.pub) return (KEYS = data as Keys);
  const fresh = await genVapid();
  const { data: kept, error } = await admin.rpc("push_vapid_init", { p_keys: fresh });
  if (error || !kept) throw new Error("vapid: " + (error?.message || "not stored"));
  return (KEYS = kept as Keys);
}

/* ---- the words: [ko, en, ja, zh] ---- */
const L = { ko: 0, en: 1, ja: 2, zh: 3 } as Record<string, number>;
const W: Record<string, string[]> = {
  cmt: ["{nick}님이 내 글 「{title}」에 댓글을 남겼어요", "{nick} replied to your post “{title}”", "{nick}さんが投稿「{title}」にコメントしました", "{nick} 评论了你的帖子「{title}」"],
  freq: ["{nick}님이 친구 요청을 보냈어요", "{nick} sent you a friend request", "{nick}さんから友だち申請が届きました", "{nick} 向你发送了好友请求"],
  facc: ["{nick}님과 친구가 됐어요", "You and {nick} are now friends", "{nick}さんと友だちになりました", "你和 {nick} 成为了好友"],
  tjoin: ["{nick}님이 우리 팀에 가입을 신청했어요", "{nick} asked to join your team", "{nick}さんがチームに参加を申請しました", "{nick} 申请加入你的战队"],
  notice: ["공지: {body}", "Notice: {body}", "お知らせ: {body}", "公告：{body}"],
  paid: ["입금이 확인됐어요. 고마워요!", "Your payment is confirmed. Thank you!", "入金を確認しました。ありがとうございます!", "付款已确认，谢谢！"],
  r_ok: ["{fish} 조과가 확인됐어요. 랭킹에 들어가요!", "Your {fish} catch was confirmed and counts in the rankings!", "{fish}の釣果が確認され、ランキングに入ります!", "你的{fish}渔获已确认，计入排行！"],
  r_no: ["{fish} 조과는 확인되지 않았어요. 이유는 앱에서 볼 수 있어요", "Your {fish} catch could not be confirmed — see why in the app", "{fish}の釣果は確認されませんでした。理由はアプリで見られます", "你的{fish}渔获未通过确认，原因可在应用中查看"],
  r_log: ["{fish} 조과는 사진이 없어 기록으로만 남아요", "Your {fish} catch has no photo, so it stays as a log only", "{fish}の釣果は写真がないため記録のみ残ります", "你的{fish}渔获没有照片，仅作记录保留"],
  r_hold: ["{fish} 조과는 운영자가 한 번 더 볼게요", "The operator will take another look at your {fish} catch", "{fish}の釣果は運営者がもう一度確認します", "运营者将再次查看你的{fish}渔获"],
};
const TITLE = ["찌릿 ZZIRIT", "ZZIRIT", "찌릿 ZZIRIT", "찌릿 ZZIRIT"];
// a value may differ by language ([ko, en, ja, zh]), like a fish name
type Vars = Record<string, string | string[]>;
const fill = (s: string, v: Vars, li: number) => s.replace(/\{(\w+)\}/g, (_, k) => { const x = v[k]; return String((Array.isArray(x) ? x[li] ?? x[0] : x) ?? "").slice(0, 140); });

async function deliver(to: string, kind: string, ref: string, from: string | null, words: string, vars: Vars, url: string, tag: string) {
  const { data: first, error: oe } = await admin.rpc("push_once", { p_to: to, p_kind: kind, p_ref: ref, p_from: from });
  if (oe) throw new Error(oe.message);
  if (!first) return { sent: 0, skipped: "once" };
  const { data: subs, error: te } = await admin.rpc("push_targets", { p_acct: to });
  if (te) throw new Error(te.message);
  if (!subs || !subs.length) return { sent: 0 };
  const keys = await vapid();
  let sent = 0, gone = 0;
  const list = subs as { endpoint: string; p256dh: string; auth: string; lang: string }[];
  for (let i = 0; i < list.length; i += 20) { // a notice to everyone goes out 20 at a time
    await Promise.all(list.slice(i, i + 20).map(async (s) => {
      if (!PUSH_HOSTS.test(s.endpoint)) return;
      const li = L[s.lang] ?? 0;
      const msg = { t: TITLE[li], b: fill(W[words][li], vars, li), u: url, tag };
      try {
        const st = await sendPush(s, JSON.stringify(msg), keys, SITE);
        if (st === 404 || st === 410) { gone++; await admin.rpc("push_gone", { p_endpoint: s.endpoint }); }
        else if (st >= 200 && st < 300) sent++;
        else console.log(JSON.stringify({ ev: "push-fail", status: st, host: new URL(s.endpoint).host }));
      } catch (e) { console.log(JSON.stringify({ ev: "push-error", err: String(e).slice(0, 120) })); }
    }));
  }
  console.log(JSON.stringify({ ev: "push", kind, n: list.length, sent, gone }));
  return { sent, gone };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "post only" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch (_) { return json({ error: "bad json" }, 400); }
  try {
    // the public half of the key, for browsers that switch notices on
    if (body.op === "key") return json({ key: (await vapid()).pub });
    if (body.op !== "send") return json({ error: "unknown op" }, 400);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    // the reviewer (server key): review results
    if (SERVER_KEY && token === SERVER_KEY) {
      if (body.kind !== "review" || !/^[0-9a-f-]{36}$/.test(String(body.to || ""))) return json({ error: "bad request" }, 400);
      const words = body.v === "ok" ? "r_ok" : body.v === "hold" ? "r_hold" : body.code === "no_photo" ? "r_log" : "r_no";
      const len = typeof body.len === "number" && body.len > 0 ? ` ${body.len}cm` : "";
      const other = String(body.sp || "").startsWith("other:") ? String(body.sp).slice(6) : "";
      const ko = String(body.ko || other || ""), en = String(body.en || other || body.ko || "");
      const fish = [ko || en, en || ko, en || ko, en || ko].map((n) => n + len); // the reader's language where we have it
      const ref = String(body.ref || "").slice(0, 120);
      return json(await deliver(body.to, "review", ref, null, words, { fish }, "#log", "review:" + ref.split(":")[0])); // one notice per catch
    }
    // a signed-in visitor: who is it, and did the thing really happen?
    if (!token) return json({ error: "sign in" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ error: "sign in" }, 401);
    const kind = String(body.kind || ""), ref = String(body.ref || "").slice(0, 120);
    const { data: ev, error: ce } = await admin.rpc("push_check", { p_from: u.user.id, p_kind: kind, p_ref: ref });
    if (ce) return json({ error: ce.message }, 500);
    if (!ev) return json({ sent: 0, skipped: "not found" });
    const byOperator = kind === "notice" || kind === "paid" || kind === "verdict"; // checked as the operator: not capped
    if (kind === "verdict") { // the operator approved / rejected a catch by hand: same wording (and same once-only key) as the reviewer
      const len = typeof ev.len === "number" && ev.len > 0 ? ` ${ev.len}cm` : "";
      const fish = [ev.ko || ev.en || "", ev.en || ev.ko || "", ev.en || ev.ko || "", ev.en || ev.ko || ""].map((n: string) => n + len);
      const cid = ref.split("|")[1];
      return json(await deliver(String(ev.to), "review", `${cid}:${ev.v}`, null, ev.v === "ok" ? "r_ok" : "r_no", { fish }, "#log", "review:" + cid));
    }
    const to = ev.all ? ZERO : String(ev.to);
    return json(await deliver(to, kind, ref, byOperator ? null : u.user.id, kind, { nick: ev.nick || "", title: ev.title || "", body: ev.body || "" }, ev.url || "#home", `${kind}:${ref}`.slice(0, 60)));
  } catch (e) {
    console.log(JSON.stringify({ ev: "push-crash", err: String(e).slice(0, 200) }));
    return json({ error: "unavailable" }, 500);
  }
});
