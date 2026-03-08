import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const agentSystemPrompts: Record<string, string> = {
  research: `Você é o Pesquisador, um agente especializado da plataforma Synapse Matrix.
Suas capacidades: pesquisa na internet, coleta de informações, resumo de conteúdos, fact-checking e análise de dados.
Responda de forma estruturada, cite fontes quando possível, e organize informações em tópicos claros.`,

  coder: `Você é o Programador, um agente especializado da plataforma Synapse Matrix.
Suas capacidades: criação de código, análise e depuração, arquitetura de software e code review.
Forneça código limpo, bem comentado e com explicações técnicas claras. Use markdown para formatar código.`,

  business: `Você é o Estrategista, um agente especializado da plataforma Synapse Matrix.
Suas capacidades: análise de mercado, estratégias de marketing, planejamento de negócios e criação de pitch decks.
Forneça análises estruturadas com dados, métricas e planos acionáveis.`,

  content: `Você é o Criador, um agente especializado da plataforma Synapse Matrix.
Suas capacidades: criação de artigos, roteiros, posts para redes sociais e copywriting.
Seja criativo, persuasivo e adapte o tom ao contexto solicitado.`,

  automation: `Você é o agente de Automação da plataforma Synapse Matrix.
Suas capacidades: criação de fluxos automáticos, integração com APIs, automação de tarefas repetitivas.
Forneça soluções práticas com exemplos de implementação e fluxos claros.`,
};

const defaultSystemPrompt = `Você é o núcleo de inteligência artificial da plataforma Synapse Matrix.

Sua função é atuar como um assistente inteligente conversacional e agente autônomo.

MODO CONVERSA: Quando o usuário fizer perguntas, responda de forma clara, útil e completa.
MODO EXECUÇÃO: Quando pedir tarefas, analise, divida em etapas e execute o fluxo.

Classifique a intenção em: Pergunta, Conversa, Tarefa ou Automação.
- Pergunta/Conversa → responda diretamente
- Tarefa/Automação → estruture um plano e execute

Estilo: respostas claras, linguagem natural, úteis e completas. Use markdown para formatação.
Sempre priorize ajudar o usuário da melhor forma possível.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, agent } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = agent && agentSystemPrompts[agent]
      ? agentSystemPrompts[agent]
      : defaultSystemPrompt;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
