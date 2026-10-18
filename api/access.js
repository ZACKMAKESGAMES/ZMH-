const { db, U, staffOk, tokenOk, access, nm, sameOrigin } = require("./_lib");

// Staff only: take staff or booster access away from a user (their tokens stop working immediately)
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!U) return res.status(503).json({ error: "Database not connected" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!sameOrigin(req) || !(await staffOk(req))) return res.status(401).json({ error: "Staff only" });
  try {
    const { name, role } = req.body || {};
    const n = nm(name);
    if (n.length < 2 || !["staff", "booster"].includes(role)) return res.status(400).json({ error: "Bad request" });
    if (role === "staff" && n === (await tokenOk(req, "staff"))) return res.status(400).json({ error: "You can't remove your own staff access" });
    const a = await access(n); a[role] = false;
    await db(["HSET", "zmh:access", n, JSON.stringify(a)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Server error: " + e.message }); }
};
