import { GoogleGenAI } from '@google/genai';

const failure = message => Object.assign(new Error(message), { status: 502 });

export async function generateChat({ apiKey, model, systemInstruction, messages }) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { fetch: (...args) => globalThis.fetch(...args) } });
  try {
    const stream = await ai.interactions.create({
      model,
      system_instruction: systemInstruction,
      input: messages.map(message => ({
        type: message.role === 'assistant' ? 'model_output' : 'user_input',
        content: [{ type: 'text', text: message.content }],
      })),
      stream: true,
      store: false,
    }, { timeout: 120000, maxRetries: 0, fetchOptions: { signal: AbortSignal.timeout(120000) } });

    const modelSteps = new Set();
    let content = '';
    let completed = false;
    for await (const event of stream) {
      if (event.event_type === 'step.start' && event.step.type === 'model_output') modelSteps.add(event.index);
      if (event.event_type === 'step.delta' && modelSteps.has(event.index) && event.delta.type === 'text') content += event.delta.text;
      if (event.event_type === 'error') throw failure('Gemini tidak dapat menyelesaikan permintaan. Coba prompt lain atau periksa akses model.');
      if (event.event_type === 'interaction.status_update' && ['failed', 'cancelled', 'incomplete', 'budget_exceeded'].includes(event.status)) throw failure('Jawaban Gemini terhenti sebelum selesai. Silakan coba lagi.');
      if (event.event_type === 'interaction.completed') {
        completed = event.interaction.status === 'completed';
        if (!completed) throw failure('Jawaban Gemini terhenti sebelum selesai. Silakan coba lagi.');
      }
    }
    if (!completed || !content.trim()) throw failure('Gemini tidak mengembalikan jawaban teks yang lengkap. Coba prompt lain.');
    return content;
  } catch (error) {
    if (error.status === 502) throw error;
    // SDK/provider errors can contain request details. Return only a safe summary.
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw failure('Gemini membutuhkan terlalu lama. Silakan coba lagi.');
    console.error('Gemini Interactions status:', Number(error.status || error.code) || 'unavailable');
    throw failure(Number(error.status || error.code) === 429 ? 'Kuota atau batas permintaan Gemini tercapai. Cek akun penyedia lalu coba lagi.' : 'Gemini menolak permintaan. Periksa API key dan akses GEMINI_CHAT_MODEL di akunmu.');
  }
}
