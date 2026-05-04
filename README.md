# Study AI Backend — Phase 1

Free Vercel backend that wraps Gemini for all 6 features of the Android study app.

## Total cost: $0/month
- Gemini API: free tier (1,500 requests/day)
- Vercel hosting: free tier (100 GB bandwidth)

## Deploy in 5 minutes

### Step 1 — Get a Gemini API key (2 min)
1. Go to https://aistudio.google.com/apikey
2. Sign in with Google
3. Click "Create API key" → "Create API key in new project"
4. Copy the key (looks like `AIzaSy...`)

### Step 2 — Deploy to Vercel (3 min)
1. Sign up at https://vercel.com (free, use your GitHub)
2. Install Vercel CLI: `npm i -g vercel`
3. In this folder, run:
   ```bash
   vercel
   ```
4. Follow prompts (link to your account, name the project)
5. Add the API key:
   ```bash
   vercel env add GEMINI_API_KEY
   ```
   Paste your key when asked, choose all environments.
6. Deploy to production:
   ```bash
   vercel --prod
   ```

You'll get a URL like `https://study-ai-backend-yourname.vercel.app`. **This is your backend.** The Android app will call it.

### Alternative: Deploy via Vercel Dashboard (no CLI)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com/new → import the repo
3. Settings → Environment Variables → add `GEMINI_API_KEY`
4. Deploy

## Test it works

```bash
# Health check
curl https://YOUR-URL.vercel.app/api

# AI Tutor chat
curl -X POST https://YOUR-URL.vercel.app/api/tutor \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-123" \
  -d '{"message":"What is photosynthesis?","subject":"biology"}'
```

## API endpoints

All POST endpoints require `X-Device-Id` header for rate limiting.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api` | — | Service info |
| POST | `/api/tutor` | `{message, history?, subject?}` | `{answer, remaining}` |
| POST | `/api/scan` | `{imageBase64, subject?, mimeType?}` | `{problem, steps[], answer, remaining}` |
| POST | `/api/essay` | `{topic, length?, style?}` | `{title, essay, remaining}` |
| POST | `/api/summarize-pdf` | `{pdfBase64, focusArea?}` | `{summary, keyPoints[], remaining}` |
| POST | `/api/summarize-youtube` | `{url}` | `{title, summary, keyPoints[], remaining}` |
| POST | `/api/grant-bonus` | — | `{granted: true}` (after rewarded ad) |
| GET | `/api/usage` | — | `{limit, remaining, resetAt}` |

## Rate limiting

- 5 free uses per device per day (resets every 24h)
- `429` returned when exceeded
- Watch rewarded ad → POST `/api/grant-bonus` → +1 bonus use

⚠️ **Production hardening needed:**
- The in-memory rate limit resets on cold start. For real production, swap to Upstash Redis (free 10k requests/day): replace `usageStore` Map with `await redis.get/set`.
- `/api/grant-bonus` currently trusts the client. In production, verify AdMob Server-Side Verification (SSV) tokens to prevent abuse.

## Local development

```bash
npm install
echo "GEMINI_API_KEY=your-key" > .env.local
vercel dev
```

Backend runs at `http://localhost:3000`.

## What's next (Phase 2)

The Android app — coming in next message. It calls these endpoints, manages local usage tracking, integrates AdMob, and gives the user the polished UI from those screenshots.
