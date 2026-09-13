# Lumen — live deployment (zenvx.in)

## What is already done

The Supabase project is created, migrated and the functions are deployed. Nothing to run yourself except the three steps below.

| Thing | Value |
|---|---|
| Project | `lumen-study` (org `abhi cec`), region `ap-south-1` (Mumbai) |
| API URL | `https://myexcvqjnisvshxyvuww.supabase.co` |
| Anon key | shipped in `config.js` (safe in the browser — RLS protects the data) |
| Tables | `profiles`, `tasks`, `notes`, `books`, `highlights`, `sessions` — all with RLS `auth.uid() = user_id` |
| Trigger | new Google sign-ins auto-create a `profiles` row |
| Storage | private bucket `textbooks`, per-user folder policies (`<uid>/file.pdf`) |
| Edge Functions | `ai-chat` (tutor) and `mcp` (Claude custom connector) |

## What you still have to do

### 1. Google sign-in (5 min)

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.

- Authorised JavaScript origins: `https://zenvx.in`, `https://www.zenvx.in`, `http://localhost:5173`
- Authorised redirect URI: `https://myexcvqjnisvshxyvuww.supabase.co/auth/v1/callback`

Then Supabase → Authentication → Sign In / Providers → **Google** → enable, paste Client ID + Secret.

Supabase → Authentication → URL Configuration:
- Site URL: `https://zenvx.in`
- Redirect URLs: `https://zenvx.in/**`, `https://www.zenvx.in/**`, `http://localhost:5173/**`

### 2. Function secrets (2 min)

Supabase → Project Settings → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | from aistudio.google.com — free tier, powers the tutor |
| `ANTHROPIC_API_KEY` | optional, only if you buy Claude API credits |
| `MCP_SECRET` | any long random string, e.g. `openssl rand -hex 24` |
| `MCP_USER_ID` | your UUID from Authentication → Users (after your first Google sign-in) |

### 3. Cloudflare Pages (5 min)

Cloudflare dashboard → Workers & Pages → Create → **Pages** → Connect to Git → `abhi-zyn/lumen-study`.

- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: `/`

Deploy, then Custom domains → **Add** → `zenvx.in` (and `www.zenvx.in`). Since the domain is already on Cloudflare, DNS is configured automatically. Every push to `main` redeploys.

## Connect Claude (after `MCP_SECRET` and `MCP_USER_ID` are set)

Claude → Settings → Connectors → Add custom connector:

```
https://myexcvqjnisvshxyvuww.supabase.co/functions/v1/mcp?key=<MCP_SECRET>
```

Free plans allow one custom connector — this is it. Then in a chat: "Build a 10-day revision plan and add it to my planner", or "import this Drive PDF into my textbooks". Treat that URL like a password.

## Notes

- `ai-chat` is deployed with gateway JWT verification off, but the function itself checks the Supabase session, so only signed-in users can use the tutor.
- The anon key in `config.js` is meant to be public; never put the **service role** key in the front end.
- Settings in the app still lets you point at a different Supabase project — `config.js` only supplies the default.
- Free tier limits: 500 MB database, 1 GB storage, 500K Edge Function calls per month. A project paused after 7 idle days can be restored from the dashboard.
