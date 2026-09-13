# StudyForge — study workspace

Dark-theme study web app: dashboard, study planner, notes, textbook library, in-browser PDF reader with a highlighter pen, and an AI tutor. Runs standalone in demo mode (localStorage), then switches to Supabase + Google sign-in when you paste your project keys in **Settings**.

```
index.html      app shell + all views
styles.css      dark design system (tokens at the top of the file)
config.js       hosted Supabase project defaults
app.js          state, routing, planner, notes, PDF reader, pen, AI chat
supabase/schema.sql                   tables + Row Level Security + storage bucket
supabase/functions/ai-chat/index.ts   Edge Function proxy for Gemini / Claude
supabase/functions/mcp/index.ts       remote MCP server for Claude connectors
```

See `DEPLOY.md` for the live setup (Cloudflare Pages + zenvx.in) and `MCP-SETUP.md` for the Claude connector.

## Run locally

```bash
cd studyforge
python3 -m http.server 5173     # then open http://localhost:5173
```
Use a server, not `file://` — module imports and PDF.js need http.

## 1. Supabase (free tier)

1. Create a project at supabase.com.
2. SQL editor → paste `supabase/schema.sql` → Run. This creates `tasks`, `notes`, `books`, `highlights`, RLS policies, and a private `textbooks` storage bucket.
3. Authentication → Providers → Google → enable. In Google Cloud Console create an OAuth client (type: Web), authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client ID/secret into Supabase.
4. Authentication → URL configuration → add your site URL (`http://localhost:5173` and your deployed domain).
5. Open the app → Settings → paste **Project URL** and **anon key** → Save. The pill in the top bar turns green and "Sign in with Google" becomes live.

The anon key is safe in the browser; RLS is what protects data. Never put a service-role key or a model API key in front-end code.

## 2. AI tutor

```bash
supabase functions deploy ai-chat
supabase secrets set GEMINI_API_KEY=...        # free tier, default provider
supabase secrets set ANTHROPIC_API_KEY=...     # optional, prepaid credits
```
The function requires a signed-in Supabase user, so it is not an open proxy.

### Claude on a free plan — what is actually possible

| Option | Works? | Notes |
|---|---|---|
| Embed claude.ai chat in an iframe | No | claude.ai blocks framing; no embed/widget product exists. |
| Use your Claude free/Pro subscription from your own site | No | Subscription and API billing are separate; no API access is included. |
| Claude API | Yes, but paid | Prepaid credits only, no free tier. Haiku is the cheapest tier — a few dollars lasts a long time at study volumes. |
| Gemini API free tier | Yes, free | Set as the default provider in `ai-chat`. |
| "Open in Claude" button | Yes, free | Deep-link your question to claude.ai and use your free plan in a new tab. |

So the built-in tutor runs on Gemini's free tier, the provider dropdown can switch to Claude the day you add credits, and a link-out keeps your free Claude plan usable meanwhile.

## 3. Reader and highlighter

- PDFs render in-page with PDF.js. Add one from **Textbooks → Add PDF**.
- Toolbar: **Read** (select text), **Pen** (draw translucent highlights), **Erase** (remove a stroke), four highlight colours, page nav, and **Ask AI about page**.
- Strokes are stored as normalised 0–1 coordinates per book and page, so they stay aligned at any zoom or screen size. Sync them to the `highlights` table (see the `CONNECT` comments in `app.js`).

## Deploy

Static hosting — Cloudflare Pages, Vercel or Netlify free tiers. No build step: output directory is the repo root. Remember to add the deployed URL to Supabase auth URL configuration and the Google OAuth origins.

## Next steps worth doing

1. Replace the localStorage helpers in `app.js` with Supabase queries (marked `CONNECT`).
2. Upload PDFs to the `textbooks` bucket and use signed URLs instead of blob URLs.
3. Send highlighted text as context to the tutor for real "explain this passage" answers.
4. Add a spaced-repetition queue on top of `notes` (`next_review` date column).
