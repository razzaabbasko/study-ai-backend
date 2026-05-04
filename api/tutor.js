// POST /api/tutor
// body: { message: string, history?: [{role, parts}], subject?: string }
// returns: { answer: string, remaining: number }

import { handleOptions, checkRateLimit, getModel, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  const limit = checkRateLimit(deviceId);
  if (!limit.allowed) return sendJson(res, 429, { error: limit.error, ...limit });

  const { message, history = [], subject = 'general' } = req.body || {};
  if (!message || typeof message !== 'string') {
    return sendError(res, 400, 'Missing "message" in body');
  }

  try {
    const systemPrompt = buildTutorSystemPrompt(subject);
    const model = getModel(systemPrompt);

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text || h.parts || '' }]
      }))
    });

    const result = await chat.sendMessage(message);
    const answer = result.response.text();

    sendJson(res, 200, { answer, remaining: limit.remaining });
  } catch (err) {
    console.error('Tutor error:', err);
    sendError(res, 500, 'AI temporarily unavailable. Please try again.');
  }
}

function buildTutorSystemPrompt(subject) {
  const subjectGuide = {
    physics: 'Focus on physics concepts, formulas, and step-by-step problem-solving.',
    chemistry: 'Focus on chemistry: reactions, formulas, periodic trends, mechanisms.',
    biology: 'Focus on biology: anatomy, processes, ecosystems, genetics.',
    math: 'Focus on mathematical reasoning. Show every step clearly.',
    history: 'Focus on historical context, causes, effects, and key figures.',
    economics: 'Focus on economic principles, real-world examples, calculations where relevant.',
    general: 'Help with any academic subject.'
  }[subject.toLowerCase()] || 'Help with any academic subject.';

  return `You are an AI Tutor for students. ${subjectGuide}

Rules:
- Explain concepts clearly and concisely
- Use step-by-step reasoning for problems
- Use simple language a student can understand
- For math/science, show all steps
- If asked something off-topic (not academic), politely redirect to studies
- Keep answers focused and practical, not long lectures
- Use markdown formatting (**, *, lists) for readability`;
}
