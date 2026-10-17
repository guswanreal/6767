// Provider messages may contain request details. Classify them without exposing them.
export function geminiFailure(error) {
  if (error?.publicError) return error;
  const status = Number(error?.status || error?.statusCode || error?.code) || 0;
  let payload = error;
  if (typeof error?.message === 'string') {
    try { payload = JSON.parse(error.message); } catch { /* SDK may use plain text. */ }
  }
  const detail = payload?.error || payload;
  const reasons = Array.isArray(detail?.details) ? detail.details.map(item => item.reason || '').join(' ') : '';
  const diagnostic = `${reasons} ${detail?.code || ''} ${detail?.status || ''} ${detail?.message || ''} ${error?.message || ''}`;
  let code = 'GEMINI_REQUEST_FAILED';
  let message = 'Gemini menolak permintaan. Periksa status dan akses model di akun Google AI Studio.';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    code = 'GEMINI_TIMEOUT'; message = 'Gemini membutuhkan terlalu lama. Silakan coba lagi.';
  } else if (status === 401 || /API_KEY_INVALID|API_KEY_EXPIRED|UNAUTHENTICATED|API key not valid|invalid api key/i.test(diagnostic)) {
    code = 'GEMINI_KEY_INVALID'; message = 'API key Gemini tidak valid atau kedaluwarsa. Perbarui GEMINI_API_KEY, lalu redeploy Vercel atau restart server.';
  } else if (status === 403 || /API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|PERMISSION_DENIED/i.test(diagnostic)) {
    code = 'GEMINI_PERMISSION_DENIED'; message = 'Akses Gemini ditolak. Periksa pembatasan API key, izin Generative Language API, dan akses model di Google AI Studio.';
  } else if (status === 404 || /NOT_FOUND/.test(diagnostic) || /model.+(not found|not supported|does not exist)/i.test(diagnostic)) {
    code = 'GEMINI_MODEL_UNAVAILABLE'; message = 'Model Gemini tidak tersedia untuk API atau akun ini. Pilih model yang tersedia di Google AI Studio melalui GEMINI_CHAT_MODEL atau GEMINI_IMAGE_MODEL, lalu redeploy.';
  } else if (status === 429 || /RESOURCE_EXHAUSTED/i.test(diagnostic)) {
    code = 'GEMINI_QUOTA_EXCEEDED'; message = 'Kuota atau batas permintaan Gemini tercapai. Periksa kuota, billing, dan batas model di Google AI Studio.';
  } else if (status === 400 || /INVALID_ARGUMENT/i.test(diagnostic)) {
    code = 'GEMINI_INVALID_REQUEST'; message = 'Gemini tidak menerima format atau fitur permintaan ini. Periksa kompatibilitas model dengan Interactions API untuk chat atau output gambar untuk Image Studio.';
  } else if (status >= 500 || /UNAVAILABLE|INTERNAL/.test(diagnostic)) {
    code = 'GEMINI_UNAVAILABLE'; message = 'Layanan Gemini sedang bermasalah. Tunggu sebentar lalu coba lagi.';
  } else if (error instanceof TypeError) {
    code = 'GEMINI_CONNECTION_FAILED'; message = 'Server tidak dapat menghubungi Gemini. Periksa koneksi dan izin jaringan ke generativelanguage.googleapis.com.';
  }
  console.error('Gemini request failed:', code, 'HTTP', status || 'unknown');
  return Object.assign(new Error(`[${code}] ${message}`), { status: 502, publicError: true, code });
}
