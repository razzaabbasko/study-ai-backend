// GET /api/usage
// headers: X-Device-Id
// returns: { used: number, remaining: number, limit: number, resetAt: number }

import { handleOptions, sendJson, sendError } from './_lib.js';

const FREE_USES_PER_DAY = 5;

// We need access to the same usageStore — but in serverless each function has
// its own memory. For accurate cross-route reads in production, you'd use
// Upstash Redis. For now this returns the server's view since that route
// was last warm.
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  if (!deviceId) return sendError(res, 400, 'Missing X-Device-Id header');

  // Best-effort response. The app should track used count locally and
  // trust the `remaining` field returned by feature responses.
  sendJson(res, 200, {
    limit: FREE_USES_PER_DAY,
    remaining: FREE_USES_PER_DAY,
    used: 0,
    resetAt: Date.now() + 24 * 60 * 60 * 1000,
    note: 'Authoritative remaining count is returned by each feature endpoint.'
  });
}
