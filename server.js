import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const personas = {
  sakura: 'Sakura, pendamping kreatif yang hangat dan ceria',
  hikari: 'Hikari, programmer yang teliti dan penuh semangat',
  yuki: 'Yuki, pemecah masalah yang tenang dan analitis',
  aiko: 'Aiko, seniman imajinatif yang ramah',
};
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
async function body(req) {
  // Vercel may parse JSON before invoking a Node function.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 150_000) throw Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 });
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error('JSON tidak valid.'), { status: 400 }); }
  }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 150_000) throw Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 }); }
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('JSON tidak valid.'), { status: 400 }); }
}
async function provider(model, payload) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw Object.assign(new Error('AI belum terhubung. Tambahkan GEMINI_API_KEY di .env server atau environment settings untuk memakai fitur ini.'), { status: 503 });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    console.error('AI provider status:', response.status);
    throw Object.assign(new Error(response.status === 429 ? 'Kuota atau batas permintaan AI tercapai. Cek akun penyedia lalu coba lagi.' : 'Layanan AI menolak permintaan. Periksa API key, akses model, dan log server.'), { status: 502 });
  }
  return response.json();
}
export async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/status') { const connected = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY); return json(res, 200, { connected, mode: connected ? 'live' : 'demo' }); }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const input = await body(req);
      if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > 30 || input.messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000)) return json(res, 400, { error: 'Pesan tidak valid (maksimal 30 pesan, 12.000 karakter per pesan).' });
      const result = await provider(process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash', {
        systemInstruction: { parts: [{ text: `Kamu ${personas[input.character] || personas.sakura} di GuswanAI. Jawab dalam bahasa Indonesia kecuali diminta lain. Bantu coding dan kreativitas. Untuk permintaan website, berikan satu dokumen HTML lengkap mandiri dalam blok kode html, gunakan CSS dan JavaScript inline. Jangan mengaku menjalankan kode. Jangan sertakan rahasia atau skrip pelacak.` }] },
        contents: input.messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
      });
      const content = result.candidates?.[0]?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (!content) throw Object.assign(new Error(result.promptFeedback?.blockReason || result.candidates?.[0]?.finishReason === 'SAFETY' ? 'Gemini tidak dapat memenuhi prompt ini. Coba ubah permintaanmu.' : 'Gemini tidak mengembalikan jawaban teks. Coba lagi.'), { status: 502 });
      return json(res, 200, { content });
    }
    if (req.method === 'POST' && url.pathname === '/api/images') {
      const input = await body(req);
      if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 4000 || !['square', 'portrait', 'landscape'].includes(input.size)) return json(res, 400, { error: 'Prompt atau ukuran gambar tidak valid.' });
      const ratios = { square: '1:1', portrait: '2:3', landscape: '3:2' };
      const result = await provider(process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image', {
        contents: [{ role: 'user', parts: [{ text: `${input.prompt}\nVisual style: ${input.style === 'anime' ? 'polished anime illustration' : input.style === 'watercolor' ? 'delicate watercolor illustration' : 'cinematic digital art'}` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: ratios[input.size] } },
      });
      const image = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData && ['image/png', 'image/jpeg', 'image/webp'].includes(part.inlineData.mimeType))?.inlineData;
      if (!image?.data) throw Object.assign(new Error('Gemini tidak mengembalikan gambar. Coba prompt lain atau periksa akses model gambar di akunmu.'), { status: 502 });
      return json(res, 200, { image: `data:${image.mimeType};base64,${image.data}` });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Endpoint tidak ditemukan.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Metode tidak didukung.' });
    const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!filename.startsWith(root + path.sep)) return json(res, 403, { error: 'Akses ditolak.' });
    const file = await readFile(filename);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch (error) { json(res, error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.code === 'ENOENT' ? 'File tidak ditemukan.' : error.name === 'TimeoutError' ? 'AI membutuhkan terlalu lama. Silakan coba lagi.' : error.message || 'Terjadi kesalahan server.' }); }
}
export const server = http.createServer(handler);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`GuswanAI berjalan di port ${process.env.PORT || 3000}`));
