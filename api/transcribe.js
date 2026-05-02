import { IncomingForm } from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key" });

  try {
    // Parse multipart form
    const form = new IncomingForm({ maxFileSize: 25 * 1024 * 1024 });
    const [fields, files] = await new Promise((resolve, reject) =>
      form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]))
    );

    const audioFile = files.audio?.[0] || files.audio;
    if (!audioFile) return res.status(400).json({ error: "No audio file" });

    // Call Whisper API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.filepath), {
      filename: 'audio.webm',
      contentType: audioFile.mimetype || 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Cleanup temp file
    try { fs.unlinkSync(audioFile.filepath); } catch {}

    return res.status(200).json({ text: data.text });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
