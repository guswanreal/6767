import { GoogleGenAI } from '@google/genai';
import { geminiFailure } from './gemini-errors.js';

const failure = message => Object.assign(new Error(message), { status: 502, publicError: true });

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
      if (event.event_type === 'error') throw geminiFailure(event.error || {});
      if (event.event_type === 'interaction.status_update' && ['failed', 'cancelled', 'incomplete', 'budget_exceeded'].includes(event.status)) throw failure('Jawaban Gemini terhenti sebelum selesai. Silakan coba lagi.');
      if (event.event_type === 'interaction.completed') {
        completed = event.interaction.status === 'completed';
        if (!completed) throw failure('Jawaban Gemini terhenti sebelum selesai. Silakan coba lagi.');
      }
    }
    if (!completed || !content.trim()) throw failure('Gemini tidak mengembalikan jawaban teks yang lengkap. Coba prompt lain.');
    return content;
  } catch (error) {
    throw geminiFailure(error);
  }
}
