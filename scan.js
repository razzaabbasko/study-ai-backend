// POST /api/scan
// body: { imageBase64: string, subject?: string }
// returns: { problem: string, steps: string[], answer: string, remaining: number }

import { handleOptions, checkRateLimit, getModel, sendJson, sendError } from './_lib.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // for base64 images
    }
  }
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  const limit = checkRateLimit(deviceId);
  if (!limit.allowed) return sendJson(res, 429, { error: limit.error, ...limit });

  const { imageBase64, subject = 'general', mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return sendError(res, 400, 'Missing "imageBase64" in body');

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const model = getModel(buildScanSystemPrompt(subject));

    const result = await model.generateContent([
      {
        inlineData: {
          data: cleanBase64,
          mimeType
        }
      },
      'Solve the problem in this image. Output the result in this exact JSON format only, no other text:\n{\n  "problem": "...",\n  "steps": ["step 1...", "step 2...", "step 3..."],\n  "answer": "..."\n}'
    ]);

    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    sendJson(res, 200, { ...parsed, remaining: limit.remaining });
  } catch (err) {
    console.error('Scan error:', err);
    sendError(res, 500, 'Could not solve. Try a clearer photo.');
  }
}

function buildScanSystemPrompt(subject) {
  return `You are an academic problem solver. The user takes a photo of a homework problem.
Identify the problem, solve it step-by-step, and return the result.
Subject hint: ${subject}.

Rules:
- Be precise and show work
- For equations: distribute, combine, isolate, etc. — every step
- For science: state assumptions, formula used, then plug in values
- Answer should be the final result only (e.g. "x = 5.5", not a long sentence)
- Output ONLY valid JSON. No markdown fences, no extra text.`;
}

function parseJsonResponse(text) {
  // Gemini sometimes wraps JSON in ```json ... ``` despite instructions
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: return raw text as the answer
    return {
      problem: 'Could not parse',
      steps: [cleaned],
      answer: 'See steps above'
    };
  }
}
