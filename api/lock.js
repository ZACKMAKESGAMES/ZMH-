const { db, U, staffOk, lockedFor, iph, nm } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!U) return res.status(503).json({ error: "Database not connected" });
  try {
    // Anyone can ask "am I locked?" (the site checks this every few seconds)
    if (req.method === "GET") return res.json({ locked: await lockedFor(req, req.query.name, req.query.dev) });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!(await staffOk(req))) return res.status(401).json({ error: "Staff only" });
    const { name, locked } = req.body || {};
    const n = nm(name);
    if (n.length < 2) return res.status(400).json({ error: "Bad name" });
    const parse = x => { try { return JSON.parse(x) || {}; } catch { return {}; } };
    const u = parse(await db(["HGET", "zmh:users", n]));
    const l = parse(await db(["HGET", "zmh:locks", n]));
    const devs = [...new Set([u.dev, l.dev].filter(Boolean))], ips = [...new Set([u.ip, l.ip].filter(Boolean))];
    if (locked) {
      await db(["SADD", "zmh:lock:n", n]);
      for (const d of devs) await db(["SADD", "zmh:lock:d", d]);
      for (const i of ips) await db(["SADD", "zmh:lock:i", i]);
      await db(["HSET", "zmh:locks", n, JSON.stringify({ dev: devs[0] || "", ip: ips[0] || "" })]);
    } else {
      await db(["SREM", "zmh:lock:n", n]);
      for (const d of devs) await db(["SREM", "zmh:lock:d", d]);
      for (const i of ips) await db(["SREM", "zmh:lock:i", i]);
      await db(["HDEL", "zmh:locks", n]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Server error: " + e.message }); }
};
