// POST /api/summarize-youtube
// body: { url: string }
// returns: { title: string, summary: string, keyPoints: string[], remaining: number }

import { handleOptions, checkRateLimit, getModel, sendJson, sendError } from './_lib.js';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  const limit = checkRateLimit(deviceId);
  if (!limit.allowed) return sendJson(res, 429, { error: limit.error, ...limit });

  const { url } = req.body || {};
  if (!url) return sendError(res, 400, 'Missing "url" in body');
  if (!YOUTUBE_REGEX.test(url)) return sendError(res, 400, 'Not a valid YouTube URL');

  try {
    const model = getModel(`You summarize YouTube videos for students.

Output format (return only this):
TITLE: <video title>

SUMMARY:
<2-3 paragraph summary>

KEY POINTS:
- <point 1>
- <point 2>
- <point 3>
- <point 4>
- <point 5>`);

    const result = await model.generateContent([
      {
        fileData: {
          fileUri: url,
          mimeType: 'video/mp4'
        }
      },
      'Summarize this YouTube video for a student.'
    ]);

    const text = result.response.text();
    const parsed = parseYouTubeSummary(text);

    sendJson(res, 200, { ...parsed, remaining: limit.remaining });
  } catch (err) {
    console.error('YouTube error:', err);
    // Common case: video too long, private, or region-locked
    sendError(res, 500, 'Could not summarize. Video may be too long, private, or unavailable.');
  }
}

function parseYouTubeSummary(text) {
  const titleMatch = text.match(/TITLE:\s*(.+?)$/m);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|$)/i);
  const pointsMatch = text.match(/KEY POINTS:\s*([\s\S]*)$/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : 'Video Summary',
    summary: summaryMatch ? summaryMatch[1].trim() : text,
    keyPoints: pointsMatch
      ? pointsMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
      : []
  };
}
