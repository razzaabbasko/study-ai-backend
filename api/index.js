// GET /api  — health check + endpoint listing
import { handleOptions, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  sendJson(res, 200, {
    name: 'Study AI Backend',
    status: 'ok',
    endpoints: {
      'POST /api/tutor': 'AI tutor chat',
      'POST /api/scan': 'Scan & solve homework photo',
      'POST /api/essay': 'Write essay',
      'POST /api/summarize-pdf': 'Summarize PDF',
      'POST /api/summarize-youtube': 'Summarize YouTube video',
      'POST /api/grant-bonus': 'Grant +1 use after rewarded ad',
      'GET  /api/usage': 'Check usage status'
    },
    auth: 'Pass X-Device-Id header on every request',
    limits: 'Free: 5 uses/day per device. Watch ad for +1.'
  });
}
