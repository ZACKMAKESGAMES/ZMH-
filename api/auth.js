const { U, verify, staffList, boosterList } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  // Open /api/auth in your browser to see which settings the server can see (never shows values).
  if (req.method === "GET") return res.json({ database: !!U, staffCodeSet: staffList().length > 0, boosterCodesSet: boosterList().length > 0 });
  if (!U) return res.status(503).json({ error: "Database not connected" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { kind, code } = req.body || {};
    const list = kind === "staff" ? staffList() : kind === "booster" ? boosterList() : [];
    const r = await verify(req, String(code || "").trim(), list);
    if (r === "ok") return res.json({ ok: true });
    if (r === "unset") return res.status(500).json({ error: (kind === "staff" ? "STAFF_CODE" : "BOOSTER_CODES") + " isn't set on the server. Add it in Vercel and redeploy." });
    if (r === "locked") return res.status(429).json({ error: "Too many wrong tries. Wait 15 minutes." });
    return res.status(401).json({ error: "That code isn't valid" });
  } catch (e) { return res.status(500).json({ error: "Server error: " + e.message }); }
};
