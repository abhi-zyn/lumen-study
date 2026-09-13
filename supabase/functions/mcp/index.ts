// Lumen remote MCP server (Supabase Edge Function)
//
// Add this function's URL as a CUSTOM CONNECTOR in Claude (Settings -> Connectors
// -> Add custom connector). Free plans allow one custom connector, which is all
// this needs. Claude can then write study blocks, notes and textbooks straight
// into your Lumen app, and pull PDFs from a Google Drive share link.
//
// Deploy:
//   supabase functions deploy mcp --no-verify-jwt
//   supabase secrets set MCP_SECRET=$(openssl rand -hex 24)
//   supabase secrets set MCP_USER_ID=<your auth.users uuid>
// Connector URL:
//   https://<project-ref>.supabase.co/functions/v1/mcp?key=<MCP_SECRET>
//
// --no-verify-jwt is required because Claude cannot send a Supabase JWT; the
// ?key= shared secret is the auth instead. Treat that URL like a password.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })

const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  )

const USER = () => Deno.env.get("MCP_USER_ID")!

/* ------------------------------------------------------------------ tools */

const TOOLS = [
  {
    name: "add_study_blocks",
    description:
      "Add one or more study blocks to the Lumen planner. Use this after building a study timetable for the user.",
    inputSchema: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "ISO date, e.g. 2026-09-15" },
              subject: { type: "string" },
              topic: { type: "string" },
              minutes: { type: "number", description: "Planned minutes, default 45" },
            },
            required: ["date", "subject", "topic"],
          },
        },
      },
      required: ["blocks"],
    },
  },
  {
    name: "list_study_blocks",
    description:
      "Read study blocks from the planner, optionally within a date range, to review what the student planned and completed.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO date lower bound" },
        to: { type: "string", description: "ISO date upper bound" },
        done: { type: "boolean", description: "Filter by completion" },
      },
    },
  },
  {
    name: "add_note",
    description: "Save a note (summary, flashcards, explanation, weekly review) into Lumen notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Markdown" },
        tags: { type: "string", description: "Comma separated" },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "search_notes",
    description: "Search the student's notes by keyword, so answers can build on what they already wrote.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "import_pdf_from_url",
    description:
      "Fetch a PDF from a public URL (including a Google Drive share link) into the student's textbook library. Use this to deliver a timetable or study PDF into the app.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direct PDF URL or Google Drive share link" },
        title: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "get_progress",
    description:
      "Get study statistics: streak, minutes, active days and per-subject balance. Use before grading or commenting on the student's week.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "Lookback window, default 28" } } },
  },
]

/** Turn a Google Drive share link into a direct-download URL. */
function driveDirect(url: string) {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) ??
    url.match(/[?&]id=([\w-]{10,})/) ??
    url.match(/drive\.google\.com\/open\?id=([\w-]{10,})/)
  return m ? "https://drive.google.com/uc?export=download&id=" + m[1] : url
}

async function call(name: string, args: Record<string, any>) {
  const sb = db()
  const user_id = USER()

  if (name === "add_study_blocks") {
    const rows = (args.blocks ?? []).map((b: any) => ({
      user_id,
      subject: String(b.subject ?? "General"),
      topic: String(b.topic ?? ""),
      due_date: String(b.date),
      minutes: Number(b.minutes) || 45,
      done: false,
    }))
    if (!rows.length) return "No blocks supplied."
    const { error } = await sb.from("tasks").insert(rows)
    if (error) throw error
    return `Added ${rows.length} study block(s): ` +
      rows.map((r: any) => `${r.due_date} ${r.subject} - ${r.topic} (${r.minutes}m)`).join("; ")
  }

  if (name === "list_study_blocks") {
    let q = sb.from("tasks").select("due_date,subject,topic,minutes,done").eq("user_id", user_id)
    if (args.from) q = q.gte("due_date", args.from)
    if (args.to) q = q.lte("due_date", args.to)
    if (typeof args.done === "boolean") q = q.eq("done", args.done)
    const { data, error } = await q.order("due_date").limit(200)
    if (error) throw error
    return JSON.stringify(data)
  }

  if (name === "add_note") {
    const { error } = await sb.from("notes").insert({
      user_id,
      title: String(args.title),
      body: String(args.body),
      tags: args.tags ? String(args.tags) : "claude",
    })
    if (error) throw error
    return `Saved note "${args.title}".`
  }

  if (name === "search_notes") {
    const { data, error } = await sb
      .from("notes")
      .select("title,tags,body,updated_at")
      .eq("user_id", user_id)
      .or(`title.ilike.%${args.query}%,body.ilike.%${args.query}%`)
      .limit(Number(args.limit) || 8)
    if (error) throw error
    return JSON.stringify(data)
  }

  if (name === "import_pdf_from_url") {
    const src = driveDirect(String(args.url))
    const res = await fetch(src, { redirect: "follow" })
    if (!res.ok) throw new Error(`Download failed (${res.status}). Make sure the link is shared as "Anyone with the link".`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    if (!head.startsWith("%PDF")) throw new Error("That URL did not return a PDF (Drive may be showing a permission page).")
    const title = String(args.title ?? "Imported document").replace(/[^\w .-]/g, "_")
    const path = `${user_id}/${Date.now()}-${title}.pdf`
    const up = await sb.storage.from("textbooks").upload(path, bytes, { contentType: "application/pdf" })
    if (up.error) throw up.error
    const { error } = await sb.from("books").insert({ user_id, title, storage_path: path, pages: 0, progress: 0 })
    if (error) throw error
    return `Imported "${title}" (${Math.round(bytes.length / 1024)} KB) into the textbook library.`
  }

  if (name === "get_progress") {
    const days = Number(args.days) || 28
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
    const { data, error } = await sb
      .from("tasks")
      .select("due_date,subject,minutes,done")
      .eq("user_id", user_id)
      .gte("due_date", since)
    if (error) throw error
    const done = (data ?? []).filter((t: any) => t.done)
    const bySubject: Record<string, number> = {}
    const activeDays = new Set<string>()
    let minutes = 0
    for (const t of done) {
      bySubject[t.subject ?? "General"] = (bySubject[t.subject ?? "General"] ?? 0) + (t.minutes ?? 0)
      activeDays.add(t.due_date)
      minutes += t.minutes ?? 0
    }
    let streak = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
      if (activeDays.has(d)) streak++
      else if (i > 0) break
    }
    return JSON.stringify({
      windowDays: days,
      planned: data?.length ?? 0,
      completed: done.length,
      completionRate: data?.length ? Math.round((done.length / data.length) * 100) : 0,
      minutes,
      activeDays: activeDays.size,
      currentStreak: streak,
      bySubjectMinutes: bySubject,
    })
  }

  throw new Error(`Unknown tool: ${name}`)
}

/* ------------------------------------------------------- JSON-RPC / MCP */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const url = new URL(req.url)
  const secret = Deno.env.get("MCP_SECRET")
  const given = url.searchParams.get("key") ?? (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "")
  if (!secret || given !== secret) return json({ error: "unauthorized" }, 401)

  if (req.method === "GET") return json({ name: "lumen", status: "ok", transport: "streamable-http" })

  const rpc = await req.json().catch(() => null)
  if (!rpc) return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })

  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: rpc.id, result })

  try {
    switch (rpc.method) {
      case "initialize":
        return reply({
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "lumen-study", version: "1.0.0" },
          instructions:
            "Lumen is the student's study workspace. Use add_study_blocks to deliver timetables, " +
            "import_pdf_from_url to push a PDF (including Google Drive links) into their library, " +
            "add_note to save summaries or weekly reviews, and get_progress before grading their week.",
        })
      case "notifications/initialized":
      case "notifications/cancelled":
        return new Response(null, { status: 202, headers: cors })
      case "ping":
        return reply({})
      case "tools/list":
        return reply({ tools: TOOLS })
      case "tools/call": {
        const text = await call(rpc.params?.name, rpc.params?.arguments ?? {})
        return reply({ content: [{ type: "text", text: String(text) }], isError: false })
      }
      case "resources/list":
        return reply({ resources: [] })
      case "prompts/list":
        return reply({ prompts: [] })
      default:
        return json({ jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: `Method not found: ${rpc.method}` } })
    }
  } catch (e) {
    if (rpc.method === "tools/call")
      return reply({ content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true })
    return json({ jsonrpc: "2.0", id: rpc.id, error: { code: -32603, message: String(e) } })
  }
})
