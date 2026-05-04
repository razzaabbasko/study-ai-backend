// Shared helpers used by all API routes.
// In a real app you'd use Redis/Upstash for rate limiting; for free MVP
// we use in-memory Map (resets on cold start, fine for low traffic).

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────── CORS ───────────
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

// ─────────── Rate limiting ───────────
// In-memory store: deviceId -> { count, resetAt }
// On Vercel, this resets when the function cold-starts. Good enough for free
// tier; upgrade to Upstash KV ($0/mo for 10k reqs) when you need persistence.
const usageStore = new Map();
const FREE_USES_PER_DAY = 5;
const RESET_MS = 24 * 60 * 60 * 1000;

export function checkRateLimit(deviceId, bonusUses = 0) {
  if (!deviceId) return { allowed: false, remaining: 0, error: 'Missing X-Device-Id header' };

  const now = Date.now();
  const record = usageStore.get(deviceId);

  if (!record || now > record.resetAt) {
    usageStore.set(deviceId, { count: 1, resetAt: now + RESET_MS, bonusUses: 0 });
    return { allowed: true, remaining: FREE_USES_PER_DAY - 1, resetAt: now + RESET_MS };
  }

  const limit = FREE_USES_PER_DAY + (record.bonusUses || 0);
  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      error: 'Daily limit reached. Watch a rewarded ad for +1 use, or come back tomorrow.'
    };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

/** Called when user watches a rewarded ad — adds +1 use to their bonus pool. */
export function grantBonusUse(deviceId) {
  if (!deviceId) return false;
  const now = Date.now();
  const record = usageStore.get(deviceId) || { count: 0, resetAt: now + RESET_MS, bonusUses: 0 };
  record.bonusUses = (record.bonusUses || 0) + 1;
  if (now > record.resetAt) record.resetAt = now + RESET_MS;
  usageStore.set(deviceId, record);
  return true;
}

// ─────────── Gemini client ───────────
let _client = null;
export function getGemini() {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY env var missing on the server');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

/**
 * Get a model configured for the task type.
 * Free tier model: gemini-2.0-flash-exp (or gemini-1.5-flash as fallback).
 */
export function getModel(systemInstruction) {
  return getGemini().getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  });
}

// ─────────── Common response helper ───────────
export function sendJson(res, status, payload) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(payload);
}

export function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}
