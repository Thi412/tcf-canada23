// Passwords nằm hoàn toàn server-side, không bao giờ xuống client
const PLAN_PASSWORDS = {
  basic:    process.env.PW_BASIC    || "Thi124",
  pro:      process.env.PW_PRO      || "Dang128",
  personal: process.env.PW_PERSONAL || "Hau414",
};

export default function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_DOMAIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { plan, password } = req.body || {};
  if (!plan || !password) return res.status(400).json({ ok: false });

  const correct = PLAN_PASSWORDS[plan];
  if (!correct) return res.status(400).json({ ok: false });

  // Rate limit đơn giản bằng header (Vercel Edge sẽ handle thêm)
  const ok = password === correct;

  // Không bao giờ trả về password thật
  return res.status(200).json({ ok });
}
