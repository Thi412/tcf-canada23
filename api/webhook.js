import crypto from "crypto";
import nodemailer from "nodemailer";

// Password map theo variant/product ID của Lemon Squeezy
// Bạn sẽ điền VARIANT_ID sau khi tạo sản phẩm trên LS
const PLAN_PASSWORDS = {
  [process.env.LS_VARIANT_BASIC]:    { password: "Thi124",  name: "Basic",    price: "$19" },
  [process.env.LS_VARIANT_PRO]:      { password: "Dang128", name: "Pro",      price: "$39" },
  [process.env.LS_VARIANT_PERSONAL]: { password: "Hau414",  name: "Clé API",  price: "$9"  },
};

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, signature) {
  const secret = process.env.LS_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

async function sendEmail({ to, customerName, planName, password, price }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Email cho khách
  await transporter.sendMail({
    from: `"TCF Canada Prep" <${process.env.SMTP_USER}>`,
    to,
    subject: `✅ Votre accès TCF Canada — Plan ${planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#2d6a4f">Bienvenue sur TCF Canada Prep ! 🎉</h2>
        <p>Bonjour ${customerName},</p>
        <p>Merci pour votre achat du plan <strong>${planName}</strong> (${price}/mois).</p>
        <div style="background:#f0fdf4;border:2px solid #2d6a4f;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
          <p style="margin:0 0 8px;color:#555;font-size:14px">Votre mot de passe d'accès :</p>
          <div style="font-size:28px;font-weight:700;color:#2d6a4f;letter-spacing:2px">${password}</div>
        </div>
        <p style="font-size:14px;color:#555">
          <strong>Comment activer :</strong><br/>
          1. Allez sur l'application TCF Canada Prep<br/>
          2. Cliquez sur <em>Plans & Tarifs</em> ou sur le cadenas 🔒<br/>
          3. Choisissez le plan <strong>${planName}</strong><br/>
          4. Entrez ce mot de passe
        </p>
        <p style="font-size:12px;color:#999;margin-top:24px">
          Conservez cet email précieusement. Bonne préparation ! 🇨🇦
        </p>
      </div>
    `,
  });

  // Notification pour vous
  await transporter.sendMail({
    from: `"TCF Canada Prep" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    subject: `💰 Nouvelle vente — ${planName} (${price})`,
    html: `
      <p><strong>Nouvelle vente !</strong></p>
      <p>Plan : ${planName} ${price}</p>
      <p>Client : ${customerName} (${to})</p>
      <p>Mot de passe envoyé : <strong>${password}</strong></p>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers["x-signature"];

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Chỉ xử lý khi đơn hàng hoàn thành
  const eventName = event.meta?.event_name;
  if (eventName !== "order_created") {
    return res.status(200).json({ received: true });
  }

  const attrs = event.data?.attributes;
  const variantId = String(event.data?.relationships?.variants?.data?.[0]?.id || "");
  const customerEmail = attrs?.user_email || attrs?.user_name;
  const customerName = attrs?.user_name || "cher client";

  const plan = PLAN_PASSWORDS[variantId];
  if (!plan) {
    console.log("Unknown variant:", variantId);
    return res.status(200).json({ received: true, note: "Unknown variant" });
  }

  try {
    await sendEmail({
      to: customerEmail,
      customerName,
      planName: plan.name,
      password: plan.password,
      price: plan.price,
    });
    console.log(`✅ Email sent to ${customerEmail} for plan ${plan.name}`);
  } catch (err) {
    console.error("Email error:", err);
    // Không return 500 để LS không retry liên tục
  }

  return res.status(200).json({ received: true });
}
