export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { license } = req.body;
  if (!license?.trim()) return res.status(400).json({ ok: false, error: "No license key" });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return res.status(500).json({ ok: false, error: "Server not configured" });

  try {
    const key = `license:${license.trim().toUpperCase()}`;
    const getRes = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getData = await getRes.json();

    if (!getData.result) {
      return res.status(200).json({ ok: false, error: "Invalid license key" });
    }

    const data = JSON.parse(getData.result);

    if (!data.usedAt) {
      data.usedAt = new Date().toISOString();
      await fetch(`${url}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(JSON.stringify(data)),
      });
    }

    return res.status(200).json({ ok: true, plan: data.plan, email: data.email });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
