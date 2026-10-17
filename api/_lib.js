const crypto = require("crypto");
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const db = cmd => fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) }).then(r => r.json()).then(r => r.result);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const ip = req => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

// Returns "ok", "bad", "locked" or "unset". After 8 wrong guesses an IP is locked out for 15 minutes.
async function verify(req, code, list) {
  if (!list.length) return "unset";
  if (!code) return "bad";
  const k = "zmh:fail:" + ip(req);
  if (+((await db(["GET", k])) || 0) >= 8) return "locked";
  if (list.some(c => same(code, c))) return "ok";
  const n = await db(["INCR", k]); if (n === 1) await db(["EXPIRE", k, 900]);
  return "bad";
}
const check = async (req, code, list) => (await verify(req, code, list)) === "ok";
const staffList = () => [String(process.env.STAFF_CODE || "").trim()].filter(Boolean);
const boosterList = () => (process.env.BOOSTER_CODES || "").split(",").map(s => s.trim()).filter(Boolean);
const staffOk = req => check(req, req.headers["x-staff-code"], staffList());
module.exports = { db, U, verify, check, staffList, boosterList, staffOk };
