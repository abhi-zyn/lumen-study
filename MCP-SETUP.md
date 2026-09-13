# Automating Lumen from Claude (free plan)

Short answer: **yes, this works** — Claude custom connectors (remote MCP) are available on Free, Pro, Max, Team and Enterprise plans, and free accounts get one custom connector. One is all we need. This repo ships that connector as `supabase/functions/mcp/index.ts`.

After setup you can say this in claude.ai and it happens inside your app:

> "Build me a 10-day revision timetable for Physics and Chemistry and put it in my planner."
> "Here's my timetable PDF on Drive — pull it into my textbooks: <drive link>"
> "Look at my last two weeks in Lumen, grade it out of 10 and save the review as a note."

---

## What the connector can do

| Tool | What Claude does with it |
|---|---|
| `add_study_blocks` | Writes timetable rows straight into your planner |
| `list_study_blocks` | Reads what you planned and completed |
| `add_note` | Saves summaries, flashcards, weekly reviews into Notes |
| `search_notes` | Grounds answers in notes you already wrote |
| `import_pdf_from_url` | Fetches a PDF — including a **Google Drive share link** — into your textbook library |
| `get_progress` | Streak, minutes, completion rate, subject balance (for grading your week) |

## Setup (about 10 minutes)

```bash
# 1. deploy
supabase functions deploy mcp --no-verify-jwt

# 2. secrets
supabase secrets set MCP_SECRET=$(openssl rand -hex 24)
supabase secrets set MCP_USER_ID=<your uuid from auth.users>
```

Find your uuid: Supabase → Authentication → Users → click your Google account → copy the UID.

```
# 3. your connector URL
https://<project-ref>.supabase.co/functions/v1/mcp?key=<MCP_SECRET>
```

4. In claude.ai → **Settings → Connectors → Add custom connector** → paste that URL → Add. Open a new chat, click the tools icon, and enable **lumen-study**.
5. Test: "Add a study block: 2026-09-20, Physics, Thermodynamics, 45 minutes." Then open Lumen → Planner.

`--no-verify-jwt` is needed because Claude can't send a Supabase JWT; the `?key=` secret is the authentication instead. **Treat that URL like a password** — anyone with it can write to your data. Rotate by setting a new `MCP_SECRET` and re-adding the connector.

## The Google Drive route

Two halves, both free:

1. **Claude → Drive.** Claude's own Google Drive connector is read-oriented; the reliable way out of a chat is to download the PDF/artifact and drop it in a Drive folder (or let Claude create a Google Doc if you have a paid plan). On mobile, "Save to Drive" from the share sheet is one tap.
2. **Drive → Lumen.** Share the file as *Anyone with the link*, then tell Claude: "import_pdf_from_url this link." The connector converts the share link to a direct download, verifies it really is a PDF, uploads it to your private `textbooks` bucket and adds the book row.

If you want it fully hands-free, add a nightly `pg_cron` job that calls a second function which lists a watched Drive folder with a Google service account and imports anything new. That removes the last manual step, at the cost of a Google Cloud service account.

## Honest limits

- Claude still only acts **when you ask it** in a chat. MCP is pull-based: there is no way for claude.ai to run on a schedule by itself. Scheduling must live on your side (`pg_cron`, Storage webhooks, GitHub Actions).
- Free plans allow **one** custom connector, so use this one.
- The connector runs on Supabase free tier: 500K function invocations and 500 MB database, far beyond study use.
- Claude's chat history and in-app comments remain inaccessible; anything you want to keep lives in Lumen, written through `add_note`.

## Alternatives if you'd rather not run an MCP server

| Route | Effort | Automation |
|---|---|---|
| Drag-and-drop timetable PDF into Planner (already built) | none | manual, instant |
| Claude → Drive → this connector | 10 min setup | one sentence in chat |
| Drive folder + `pg_cron` poller | ~1 hour | fully automatic |
| Supabase Storage upload + Storage webhook | ~30 min | automatic once the file lands |
| Email-in: Cloudflare Email Worker → Edge Function | ~1 hour | forward the PDF from any device |
