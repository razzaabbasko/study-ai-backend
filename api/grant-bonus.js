// POST /api/grant-bonus
// headers: X-Device-Id
// body: { adToken?: string }  (in production, validate token from AdMob SSV)
// returns: { granted: true, bonusUses: number }

import { handleOptions, grantBonusUse, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const deviceId = req.headers['x-device-id'];
  if (!deviceId) return sendError(res, 400, 'Missing X-Device-Id header');

  // ⚠️ SECURITY NOTE: In production, validate that the user actually watched
  // the ad by verifying AdMob's Server-Side Verification (SSV) callback.
  // Otherwise users can call this endpoint directly and get free uses forever.
  // Docs: https://developers.google.com/admob/android/ssv
  // For MVP we trust the client.

  const ok = grantBonusUse(deviceId);
  sendJson(res, 200, { granted: ok });
}
