const { U, check, staffList, boosterList } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!U) return res.status(503).json({ error: "Database not connected" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { kind, code } = req.body || {};
  const list = kind === "staff" ? staffList() : kind === "booster" ? boosterList() : [];
  const ok = await check(req, String(code || ""), list);
  res.status(ok ? 200 : 401).json({ ok });
};
