import { randomUUID } from "crypto";

const VALID_PLANS = ["basic", "pro", "personal"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { secret, plan, email, note } = req.body;

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: `Invalid plan. Must be: ${VALID_PLANS.join(", ")}` });
  }

  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return res.status(500).json({ error: "Server not configured" });

  try {
    // Generate key: XXXX-XXXX-XXXX-XXXX
    const raw = randomUUID().replace(/-/g, "").toUpperCase();
    const key = `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}`;

    const data = {
      plan,
      email: email.trim().toLowerCase(),
      note: note || "",
      createdAt: new Date().toISOString(),
      usedAt: null,
    };

    await fetch(`${url}/set/${encodeURIComponent("license:" + key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(data)),
    });

    return res.status(200).json({ ok: true, key, plan, email, message: `Key created for ${email}` });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
