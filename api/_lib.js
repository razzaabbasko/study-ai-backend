import { GoogleGenerativeAI } from '@google/generative-ai';

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

const usageStore = new Map();
const FREE_USES_PER_DAY = 5;
const RESET_MS = 24 * 60 * 60 * 1000;

export function checkRateLimit(deviceId) {
  if (!deviceId) return { allowed: false, remaining: 0, error: 'Missing X-Device-Id header' };
  const now = Date.now();
  const record = usageStore.get(deviceId);
  if (!record || now > record.resetAt) {
    usageStore.set(deviceId, { count: 1, resetAt: now + RESET_MS, bonusUses: 0 });
    return { allowed: true, remaining: FREE_USES_PER_DAY - 1, resetAt: now + RESET_MS };
  }
  const limit = FREE_USES_PER_DAY + (record.bonusUses || 0);
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt, error: 'Daily limit reached.' };
  }
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

export function grantBonusUse(deviceId) {
  if (!deviceId) return false;
  const now = Date.now();
  const record = usageStore.get(deviceId) || { count: 0, resetAt: now + RESET_MS, bonusUses: 0 };
  record.bonusUses = (record.bonusUses || 0) + 1;
  if (now > record.resetAt) record.resetAt = now + RESET_MS;
  usageStore.set(deviceId, record);
  return true;
}

let _client = null;
export function getGemini() {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY env var missing on the server');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

export function getModel(systemInstruction) {
  return getGemini().getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  });
}

export function sendJson(res, status, payload) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(payload);
}

export function sendError(res, status, message, debug) {
  // Now includes a debug field with the real error so we can diagnose
  const body = debug ? { error: message, debug: String(debug) } : { error: message };
  sendJson(res, status, body);
}
