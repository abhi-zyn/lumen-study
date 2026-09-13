# Lumen — what's possible, what it costs, what to build next

A practical map of every integration idea for this app: what works today, what needs a paid key, and what is simply not possible. Written so you can decide before you build.

---

## 1. Talking to Claude / ChatGPT from the site

| Route | Free? | Status | Notes |
|---|---|---|---|
| **"Ask Claude" / "Ask ChatGPT" deep-link button** | Free | **Built** | Opens `claude.ai/new?q=...` or `chatgpt.com/?q=...` in a new tab with your question and page context pre-filled. Uses your normal free logins. Zero keys, zero cost. |
| Claude API via Edge Function | Paid | **Built, needs key** | No free tier. Prepaid credits, `claude-haiku-4-5` is cheapest. Add `ANTHROPIC_API_KEY` to Supabase secrets and the tutor works in-app. |
| Gemini API via Edge Function | **Free tier** | **Built, needs key** | Default provider. Set `GEMINI_API_KEY`. Best free option for in-app chat. |
| OpenAI API | Paid | Drop-in | Same shape as the Claude branch in `supabase/functions/ai-chat/index.ts`. |
| Embedding claude.ai / chatgpt.com in an iframe | — | **Impossible** | Both send `X-Frame-Options`/CSP headers that forbid framing. No official chat-embed widget exists for either. |
| Reading your existing Claude chat history into the site | — | **Impossible** | There is no API for conversations in your claude.ai account. Only the separate, paid Claude API exists, and it has no access to your chat history. |
| Claude's "projects" or "artifacts" rendered in your site | — | **Impossible** | No public endpoint. |

**Conclusion:** in-app chat = Gemini free tier (or Claude with credits). Your free Claude plan stays useful through the deep-link button.

---

## 2. Getting a Claude-made PDF timetable into the app

Claude cannot push files to your app — nothing in the free plan can call out to your site. So the flow has to be pull-based. Three options, easiest first:

### A. Drag-and-drop import (**built**)
Planner → **Import timetable** → pick the PDF. The app extracts text with PDF.js, finds lines that look like schedule rows, and turns them into planner blocks. Works fully offline, no keys.

Recognised line shapes:
```
2026-09-15  Physics  Thermodynamics Ch.4  45m
Mon 9:00-10:00  Maths  Integrals
15 Sep | Chemistry | Electrochemistry | 40 min
```
Weekday-only rows map onto the coming week.

### B. AI-assisted import (needs a model key)
If the PDF layout is messy, send the extracted text to the `ai-chat` function and ask for strict JSON:
```json
[{ "date": "2026-09-15", "subject": "Physics", "topic": "Ch. 4", "minutes": 45 }]
```
Then feed that array into the same importer. Robust for any layout; costs a fraction of a cent per import on Gemini free tier.

### C. Fully automatic "background MCP" (the honest version)
MCP servers are **called by an AI client** — they do not run on their own schedule, and Claude's free plan cannot host one or reach your database. To get true hands-off automation you need a small always-on piece:

| Piece | Does what | Free option |
|---|---|---|
| Supabase **Storage** `dropbox/` folder | You drop the PDF there from any device | Free tier |
| Supabase **Edge Function** + **Storage webhook** | Fires on upload, extracts text, calls the model, inserts planner rows | Free tier (500K invocations) |
| Supabase **pg_cron** | Nightly streak recalculation, reminders | Free tier |
| Optional MCP server wrapping your Supabase | Lets Claude Desktop read/write your planner when *you* ask it to | Free, runs on your machine |

That last row is the realistic version of "Claude puts things in my app": you ask Claude in its own app, and it calls your MCP server, which writes to Supabase. Still user-triggered, but it feels automatic.

---

## 3. JSON search and "find what I need"

All app data is JSON-shaped (`tasks`, `notes`, `books`, `highlights`). Search options, cheapest first:

| Level | How | Good for |
|---|---|---|
| **Client filter** (built) | `Array.filter` over notes/tasks in the top-bar search | Instant, works offline, up to a few thousand rows |
| Postgres full-text | `to_tsvector` column + GIN index, `websearch_to_tsquery` in Supabase | Thousands of notes, typo-free keyword search |
| JSONB queries | `highlights.points` / metadata with `jsonb_path_query`, GIN index | "All yellow highlights in Ch. 4" |
| Semantic search | `pgvector` extension + embeddings (Gemini free tier embeddings) | "Find my notes about entropy" matching "disorder" |

Add the last one only once you have real content — keyword search covers 90% of study use.

---

## 4. Productivity tracking, calendar, streaks

**Built now:** an 18-week calendar heat-map, current/longest streak, minutes studied, active days and per-subject totals, all computed locally from completed planner blocks and finished focus-timer sessions.

Worth adding later:
- `sessions` table (`started_at`, `ended_at`, `subject`) so the focus timer logs real time instead of estimates.
- Google Calendar two-way sync — free API, you already use Google auth; request the `calendar.events` scope and push planner blocks as events.
- Weekly review: a cron job that summarises the week with the model and writes it to `notes`.

---

## 5. "Valuation and comments in Claude" — what that can mean

Two readings, both answerable:

1. **Claude evaluating and commenting on your work** — yes, this is just a prompt. Built as **Evaluate my week** in the tutor and on the Progress page: it sends your completion stats, subject balance and highlight count and asks for a graded review plus three concrete suggestions. Works on Gemini free tier or Claude with credits.
2. **Comments attached to your notes/highlights** — yes, but that is your own feature, not Claude's. Add a `comments` table (`parent_type`, `parent_id`, `body`, `author`: `me` or `ai`) and render AI feedback as inline comments on a note. Claude has no commenting API of its own; it just produces the text you store.

What is **not** possible: reading or writing comments inside claude.ai itself, or seeing Claude's internal ratings of your account.

---

## 6. Build order I'd suggest

1. Finish Supabase wiring (swap the `CONNECT` comments in `app.js` for real queries).
2. Set `GEMINI_API_KEY` and use the tutor + weekly evaluation for free.
3. Use drag-and-drop timetable import for a week; only build the AI importer if the plain parser misses rows.
4. Add the `sessions` table so streaks reflect real study time.
5. Add Google Calendar sync.
6. Add pgvector semantic search once you have 50+ notes.
7. Build the MCP server over Supabase last — it is the most fun and the least essential.
