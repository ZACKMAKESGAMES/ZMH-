const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const db = cmd => fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) }).then(r => r.json()).then(r => r.result);

module.exports = async (req, res) => {
  if (!U) return res.status(503).json({ error: "Database not connected" });
  if (req.method === "POST") {
    const name = String((req.body || {}).name || "").slice(0, 20).replace(/[^\w.-]/g, "");
    if (name.length < 2) return res.status(400).json({ error: "Bad name" });
    await db(["HSET", "zmh:users", name.toLowerCase(), JSON.stringify({ name, last: Date.now() })]);
    return res.json({ ok: true });
  }
  const code = process.env.STAFF_CODE;
  if (!code || req.headers["x-staff-code"] !== code) return res.status(401).json({ error: "Staff only" });
  if (req.method === "DELETE") {
    await db(["HDEL", "zmh:users", String(req.query.name || "").toLowerCase()]);
    return res.json({ ok: true });
  }
  const all = (await db(["HVALS", "zmh:users"])) || [];
  res.json({ users: all.map(x => JSON.parse(x)) });
};
