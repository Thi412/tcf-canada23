export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { license } = req.body;
  if (!license?.trim()) return res.status(400).json({ ok: false, error: "No license key" });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ ok: false, error: "Server not configured" });

  try {
    const key = `license:${license.trim().toUpperCase()}`;

    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();

    if (data.error) return res.status(500).json({ ok: false, error: "Redis: " + data.error });
    if (!data.result) return res.status(200).json({ ok: false, error: "Invalid license key" });

    const record = typeof data.result === "string" ? JSON.parse(data.result) : data.result;

    if (!record.usedAt) {
      record.usedAt = new Date().toISOString();
      await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(record))}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return res.status(200).json({ ok: true, plan: record.plan, email: record.email });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
