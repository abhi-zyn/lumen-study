// Supabase Edge Function: ai-chat
// Keeps model API keys server-side. Supports Gemini (free tier) and Claude (paid credits).
//
// Deploy:
//   supabase functions deploy ai-chat
//   supabase secrets set GEMINI_API_KEY=...            # free tier
//   supabase secrets set ANTHROPIC_API_KEY=...         # optional, needs prepaid credits

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}

const SYSTEM =
  "You are a patient study tutor. Explain step by step, use short paragraphs, " +
  "end with one check-for-understanding question. If the student shares textbook " +
  "context, ground your answer in it."

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    // Require a signed-in Supabase user so the endpoint is not an open proxy.
    const authHeader = req.headers.get("Authorization") ?? ""
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: "Sign in first." }), { status: 401, headers: cors })

    const { provider = "gemini", message, context } = await req.json()
    const prompt = context?.book
      ? `Context: reading "${context.book}", page ${context.page}.\n\n${message}`
      : message

    let reply = ""

    if (provider === "claude") {
      const key = Deno.env.get("ANTHROPIC_API_KEY")
      if (!key) return new Response(JSON.stringify({ error: "No Claude key configured. Claude has no free API tier - add prepaid credits, or use Gemini." }), { status: 400, headers: cors })
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 900,
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const j = await r.json()
      reply = j?.content?.[0]?.text ?? j?.error?.message ?? "No reply."
    } else {
      const key = Deno.env.get("GEMINI_API_KEY")
      if (!key) return new Response(JSON.stringify({ error: "Set GEMINI_API_KEY." }), { status: 400, headers: cors })
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        },
      )
      const j = await r.json()
      reply = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? j?.error?.message ?? "No reply."
    }

    return new Response(JSON.stringify({ reply }), { headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
