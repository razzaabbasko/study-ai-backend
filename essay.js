// POST /api/essay
// body: { topic: string, length?: 'short'|'medium'|'long', style?: string }
// returns: { title: string, essay: string, remaining: number }

import { handleOptions, checkRateLimit, getModel, sendJson, sendError } from './_lib.js';

const LENGTH_MAP = {
  short:  '200-300 words',
  medium: '400-600 words',
  long:   '800-1200 words'
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  const limit = checkRateLimit(deviceId);
  if (!limit.allowed) return sendJson(res, 429, { error: limit.error, ...limit });

  const { topic, length = 'medium', style = 'academic' } = req.body || {};
  if (!topic) return sendError(res, 400, 'Missing "topic" in body');

  try {
    const wordCount = LENGTH_MAP[length] || LENGTH_MAP.medium;
    const model = getModel(`You are an essay writing assistant for students.
Write essays that are clear, well-structured, and original.
Style: ${style}.
Length: ${wordCount}.

Structure: Introduction → Body paragraphs (2-4) → Conclusion.
Use proper transitions. Vary sentence structure. No filler.

Output format (return only this, no preamble):
TITLE: <essay title here>

<essay body here, with paragraph breaks>`);

    const result = await model.generateContent(`Write an essay on: ${topic}`);
    const text = result.response.text().trim();
    const { title, essay } = parseEssay(text);

    sendJson(res, 200, { title, essay, remaining: limit.remaining });
  } catch (err) {
    console.error('Essay error:', err);
    sendError(res, 500, 'Essay generation failed. Try again.');
  }
}

function parseEssay(text) {
  const titleMatch = text.match(/^TITLE:\s*(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Essay';
  const essay = text.replace(/^TITLE:.+$/m, '').trim();
  return { title, essay };
}
