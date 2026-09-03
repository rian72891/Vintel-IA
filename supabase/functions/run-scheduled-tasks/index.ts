import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const agentPrompts: Record<string, string> = {
  research: "Você é um assistente de pesquisa avançado. Use markdown rico e seja direto.",
  coder: "Você é um assistente de programação de elite. Entregue código completo e tipado.",
  business: "Você é um estrategista de negócios. Seja direto e acionável.",
  marketing: "Você é um growth hacker. Seja direto e acionável.",
  content: "Você é criador de conteúdo. Storytelling envolvente e SEO.",
  analyst: "Você é analista de dados. Insights acionáveis com tabelas e métricas.",
  automation: "Você é especialista em automação. Workflows, APIs, integrações.",
};

async function runPrompt(apiKey: string, model: string, system: string, prompt: string) {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`);
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const now = new Date();
    const hour = now.getUTCHours();
    const weekday = now.getUTCDay();

    const { data: tasks, error } = await admin
      .from("scheduled_tasks")
      .select("*")
      .eq("enabled", true)
      .eq("hour_utc", hour);

    if (error) throw error;

    const due = (tasks ?? []).filter((t: any) => {
      if (t.frequency === "weekly" && t.weekday !== null && t.weekday !== weekday) return false;
      if (!t.last_run_at) return true;
      return now.getTime() - new Date(t.last_run_at).getTime() > 6 * 60 * 60 * 1000;
    });

    const results: any[] = [];

    for (const task of due) {
      try {
        const system =
          (task.agent && agentPrompts[task.agent]) ||
          "Você é a Vintel IA. Responda em português brasileiro, com markdown rico e direto ao ponto.";

        const answer = await runPrompt(
          apiKey,
          "gemini-flash-latest",
          system,
          `${task.prompt}\n\n(Esta é uma execução automática agendada em ${now.toISOString()}.)`,
        );

        const { data: conv, error: convErr } = await admin
          .from("conversations")
          .insert({
            user_id: task.user_id,
            title: `⏰ ${task.title}`,
            agent: task.agent ?? null,
          })
          .select("id")
          .single();
        if (convErr) throw convErr;

        await admin.from("messages").insert([
          {
            conversation_id: conv.id,
            user_id: task.user_id,
            role: "user",
            content: task.prompt,
            agent: task.agent ?? null,
          },
          {
            conversation_id: conv.id,
            user_id: task.user_id,
            role: "assistant",
            content: answer || "_Sem resposta gerada._",
            agent: task.agent ?? null,
          },
        ]);

        await admin
          .from("scheduled_tasks")
          .update({ last_run_at: now.toISOString(), last_status: "success" })
          .eq("id", task.id);

        results.push({ id: task.id, status: "success", conversation_id: conv.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[scheduled-task ${task.id}]`, msg);
        await admin
          .from("scheduled_tasks")
          .update({ last_run_at: now.toISOString(), last_status: `error: ${msg.slice(0, 200)}` })
          .eq("id", task.id);
        results.push({ id: task.id, status: "error", error: msg });
      }
    }

    return new Response(JSON.stringify({ checked: tasks?.length ?? 0, ran: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[run-scheduled-tasks]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
