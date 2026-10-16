const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const db = cmd => fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) }).then(r => r.json()).then(r => r.result);
const str = (v, n) => String(v || "").slice(0, n);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!U) return res.status(503).json({ error: "Database not connected" });
  if (req.method === "GET") {
    const all = (await db(["HVALS", "zmh:items"])) || [];
    return res.json({ items: all.map(x => JSON.parse(x)) });
  }
  const code = process.env.STAFF_CODE;
  if (!code || req.headers["x-staff-code"] !== code) return res.status(401).json({ error: "Staff only" });
  if (req.method === "POST") {
    const b = req.body || {};
    if (!["apk", "unity"].includes(b.section) || !str(b.title, 100).trim()) return res.status(400).json({ error: "Bad item" });
    const img = typeof b.img === "string" && b.img.startsWith("data:image/") && b.img.length < 400000 ? b.img : "";
    const id = Date.now();
    const item = { id, section: b.section, tab: str(b.tab, 40), title: str(b.title, 100), link: str(b.link, 500), copy: str(b.copy, 5000), img, ts: id };
    await db(["HSET", "zmh:items", String(id), JSON.stringify(item)]);
    return res.json({ ok: true, item });
  }
  if (req.method === "DELETE") {
    await db(["HDEL", "zmh:items", String(req.query.id || "")]);
    return res.json({ ok: true });
  }
  res.status(405).json({ error: "Method not allowed" });
};
