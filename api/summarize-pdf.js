// POST /api/summarize-pdf
// body: { pdfBase64: string, focusArea?: string }
// returns: { summary: string, keyPoints: string[], remaining: number }

import { handleOptions, checkRateLimit, getModel, sendJson, sendError } from './_lib.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  const limit = checkRateLimit(deviceId);
  if (!limit.allowed) return sendJson(res, 429, { error: limit.error, ...limit });

  const { pdfBase64, focusArea = '' } = req.body || {};
  if (!pdfBase64) return sendError(res, 400, 'Missing "pdfBase64" in body');

  try {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const model = getModel(`You are a study assistant that summarizes academic PDFs.

Output format (return only this, no preamble):
SUMMARY:
<2-3 paragraph summary of the document>

KEY POINTS:
- <key point 1>
- <key point 2>
- <key point 3>
- <key point 4>
- <key point 5>`);

    const focusLine = focusArea ? `\nFocus especially on: ${focusArea}` : '';
    const result = await model.generateContent([
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'application/pdf'
        }
      },
      `Summarize this PDF for a student.${focusLine}`
    ]);

    const text = result.response.text();
    const { summary, keyPoints } = parseSummary(text);

    sendJson(res, 200, { summary, keyPoints, remaining: limit.remaining });
  } catch (err) {
    console.error('PDF summary error:', err);
    sendError(res, 500, 'Could not summarize PDF. File may be too large or corrupted.');
  }
}

function parseSummary(text) {
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|$)/i);
  const pointsMatch = text.match(/KEY POINTS:\s*([\s\S]*)$/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : text;
  const keyPoints = pointsMatch
    ? pointsMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
    : [];

  return { summary, keyPoints };
}
