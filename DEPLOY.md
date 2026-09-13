# StudyForge — live deployment (studyforge.zenvx.in)

## What is already done

The Supabase project is created, migrated and the functions are deployed. Nothing to run yourself except the three steps in "What you still have to do".

| Thing | Value |
|---|---|
| Site | `https://studyforge.zenvx.in` (Cloudflare Pages) |
| Supabase project | ref `myexcvqjnisvshxyvuww` (org `abhi cec`), region `ap-south-1` (Mumbai) |
| API URL | `https://myexcvqjnisvshxyvuww.supabase.co` |
| Anon key | shipped in `config.js` (safe in the browser — RLS protects the data) |
| Tables | `profiles`, `tasks`, `notes`, `books`, `highlights`, `sessions` — all with RLS `auth.uid() = user_id` |
| Trigger | new Google sign-ins auto-create a `profiles` row |
| Storage | private bucket `textbooks`, per-user folder policies (`<uid>/file.pdf`) |
| Edge Functions | `ai-chat` (tutor) and `mcp` (Claude custom connector) |

## What you still have to do

### 1. Google sign-in (5 min)

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.

- Authorised JavaScript origins: `https://studyforge.zenvx.in`, `http://localhost:5173`
- Authorised redirect URI: `https://myexcvqjnisvshxyvuww.supabase.co/auth/v1/callback`

Then Supabase → Authentication → Sign In / Providers → **Google** → enable, paste Client ID + Secret.

Supabase → Authentication → URL Configuration:
- Site URL: `https://studyforge.zenvx.in`
- Redirect URLs: `https://studyforge.zenvx.in/**`, `http://localhost:5173/**`

### 2. Function secrets (2 min)

Supabase → Project Settings → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | from aistudio.google.com — free tier, powers the tutor |
| `ANTHROPIC_API_KEY` | optional, only if you buy Claude API credits |
| `MCP_SECRET` | any long random string, e.g. `openssl rand -hex 24` |
| `MCP_USER_ID` | your UUID from Authentication → Users (after your first Google sign-in) |

### 3. Cloudflare Pages (5 min)

Cloudflare dashboard → Workers & Pages → Create → **Pages** → Connect to Git → `abhi-zyn/studyforge`.

- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: `/`

Deploy, then Custom domains → **Add** → `studyforge.zenvx.in`. Because `zenvx.in` is already on Cloudflare, the `studyforge` CNAME is created for you and the certificate is issued automatically — usually under a minute. Every push to `main` redeploys.

## Connect Claude (after `MCP_SECRET` and `MCP_USER_ID` are set)

Claude → Settings → Connectors → Add custom connector:

```
https://myexcvqjnisvshxyvuww.supabase.co/functions/v1/mcp?key=<MCP_SECRET>
```

Free plans allow one custom connector — this is it. Then in a chat: "Build a 10-day revision plan and add it to my planner", or "import this Drive PDF into my textbooks". Treat that URL like a password.

## Notes

- `ai-chat` is deployed with `verify_jwt` off at the gateway but it still checks the Supabase session inside the function, so only signed-in users can use the tutor.
- The anon key in `config.js` is meant to be public; never put the **service role** key in the front end.
- Settings in the app still lets you point at a different Supabase project — `config.js` only supplies the default.
- If you later want the bare domain or `www` to work too, add them as extra custom domains in Pages and add matching entries to the Google OAuth origins and the Supabase redirect URLs.
- Free tier limits: 500 MB database, 1 GB storage, 500K Edge Function calls per month. A paused project (7 days idle) can be restored from the dashboard.
