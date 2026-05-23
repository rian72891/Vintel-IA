import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- System prompts (mantidos) ----
const agentSystemPrompts: Record<string, string> = {
  research: `Você é um assistente de pesquisa avançado. Use markdown rico, cite fontes e seja direto.`,
  coder: `Você é um assistente de programação de elite. Entregue código completo, tipado, comentado.`,
  business: `Você é um estrategista de negócios. Use SWOT/Canvas/AARRR. Seja direto.`,
  marketing: `Você é um growth hacker. Use AIDA/PAS, AARRR. Seja direto.`,
  content: `Você é criador de conteúdo. Storytelling envolvente, SEO. Seja direto.`,
  analyst: `Você é analista de dados. Insights acionáveis com tabelas e métricas.`,
  automation: `Você é especialista em automação. Workflows, APIs, integrações.`,
};

const defaultSystemPrompt = `Você é a Vintel IA — assistente de elite, direto e técnico em português brasileiro. Use markdown rico, código completo em blocos, e responda profundo sem rodeios.

QUANDO O USUÁRIO TIVER CONECTORES ATIVOS, você PODE chamar as ferramentas disponíveis (Notion, Slack, Linear, Asana, GitHub, Google Drive/Sheets/Docs/Calendar) para executar ações reais. Você pode e deve COMBINAR ferramentas em fluxos completos quando fizer sentido — por exemplo: "leia esta planilha do Google e crie uma issue no GitHub com o resumo", "busque a página no Notion e mande no Slack", "veja meus repositórios e crie um evento no Calendar para a review". Confirme antes de ações destrutivas. Se uma ferramenta falhar, explique o erro de forma humana e proponha alternativa.`;

// ---- Provider token helpers ----
type TokenRow = { provider: string; access_token: string; refresh_token: string | null; expires_at: string | null };

async function refreshGoogleToken(refresh_token: string): Promise<{ access_token: string; expires_at: string } | null> {
  const id = Deno.env.get("GOOGLE_CLIENT_ID"); const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) return null;
  const body = new URLSearchParams({ client_id: id, client_secret: secret, refresh_token, grant_type: "refresh_token" });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) return null;
  return { access_token: d.access_token, expires_at: new Date(Date.now() + (d.expires_in ?? 3600) * 1000).toISOString() };
}

async function getValidToken(admin: any, userId: string, provider: string, tokens: Map<string, TokenRow>): Promise<string | null> {
  const t = tokens.get(provider);
  if (!t) return null;
  if (provider === "google" && t.expires_at && new Date(t.expires_at).getTime() < Date.now() + 60_000) {
    if (!t.refresh_token) return null;
    const refreshed = await refreshGoogleToken(t.refresh_token);
    if (!refreshed) return null;
    await admin.from("oauth_tokens").update({ access_token: refreshed.access_token, expires_at: refreshed.expires_at, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("provider", provider);
    t.access_token = refreshed.access_token;
    t.expires_at = refreshed.expires_at;
  }
  return t.access_token;
}

// ---- Tool definitions ----
function buildToolsForProviders(providers: Set<string>) {
  const tools: any[] = [];

  if (providers.has("notion")) {
    tools.push({
      type: "function",
      function: {
        name: "notion_search",
        description: "Busca páginas e bancos no Notion do usuário.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "notion_create_page",
        description: "Cria uma nova página no Notion dentro de uma página pai (parent_page_id).",
        parameters: {
          type: "object",
          properties: {
            parent_page_id: { type: "string", description: "ID da página pai no Notion." },
            title: { type: "string" },
            content_markdown: { type: "string", description: "Conteúdo em texto simples (markdown leve)." },
          },
          required: ["parent_page_id", "title"],
        },
      },
    });
  }

  if (providers.has("slack")) {
    tools.push({
      type: "function",
      function: {
        name: "slack_send_message",
        description: "Envia mensagem em um canal do Slack. Use # antes do nome do canal ou o ID.",
        parameters: {
          type: "object",
          properties: { channel: { type: "string" }, text: { type: "string" } },
          required: ["channel", "text"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "slack_list_channels",
        description: "Lista canais públicos do Slack.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (providers.has("linear")) {
    tools.push({
      type: "function",
      function: {
        name: "linear_create_issue",
        description: "Cria uma issue no Linear. Precisa do team_id (use linear_list_teams se não souber).",
        parameters: {
          type: "object",
          properties: {
            team_id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["team_id", "title"],
        },
      },
    });
    tools.push({
      type: "function",
      function: { name: "linear_list_teams", description: "Lista times do Linear.", parameters: { type: "object", properties: {} } },
    });
  }

  if (providers.has("asana")) {
    tools.push({
      type: "function",
      function: { name: "asana_list_workspaces", description: "Lista workspaces do Asana.", parameters: { type: "object", properties: {} } },
    });
    tools.push({
      type: "function",
      function: {
        name: "asana_create_task",
        description: "Cria uma tarefa no Asana em um workspace.",
        parameters: {
          type: "object",
          properties: {
            workspace_id: { type: "string" },
            name: { type: "string" },
            notes: { type: "string" },
          },
          required: ["workspace_id", "name"],
        },
      },
    });
  }

  if (providers.has("google")) {
    tools.push({
      type: "function",
      function: {
        name: "google_calendar_list_events",
        description: "Lista próximos eventos do Google Calendar primário.",
        parameters: {
          type: "object",
          properties: { max_results: { type: "number", description: "Padrão 10." } },
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_calendar_create_event",
        description: "Cria um evento no Google Calendar primário.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
            description: { type: "string" },
            start_iso: { type: "string", description: "Data/hora início ISO 8601 com timezone." },
            end_iso: { type: "string", description: "Data/hora fim ISO 8601 com timezone." },
          },
          required: ["summary", "start_iso", "end_iso"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_read",
        description: "Lê valores de um intervalo de uma planilha do Google Sheets.",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_id: { type: "string" },
            range: { type: "string", description: "Ex: 'Sheet1!A1:D10'." },
          },
          required: ["spreadsheet_id", "range"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_docs_create",
        description: "Cria um novo Google Doc com um título e conteúdo de texto opcional.",
        parameters: {
          type: "object",
          properties: { title: { type: "string" }, body: { type: "string" } },
          required: ["title"],
        },
      },
    });
  }

  if (providers.has("github")) {
    tools.push({
      type: "function",
      function: {
        name: "github_list_repos",
        description: "Lista repositórios do usuário no GitHub.",
        parameters: { type: "object", properties: {} },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_create_issue",
        description: "Cria uma issue em um repositório do GitHub.",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Nome completo do repositório (ex: dono/nome)." },
            title: { type: "string", description: "Título da issue." },
            body: { type: "string", description: "Corpo/descrição da issue." },
          },
          required: ["repo", "title"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_get_repo",
        description: "Obtém detalhes de um repositório específico do GitHub.",
        parameters: {
          type: "object",
          properties: { repo: { type: "string", description: "Nome completo do repositório (ex: dono/nome)." } },
          required: ["repo"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_read_file",
        description: "Lê o conteúdo de um arquivo em um repositório do GitHub.",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "dono/nome" },
            path: { type: "string", description: "Caminho do arquivo, ex: src/index.ts" },
            ref: { type: "string", description: "Branch/tag/commit (opcional)." },
          },
          required: ["repo", "path"],
        },
      },
    });
  }

  // Google extras: Drive + Sheets write
  if (providers.has("google")) {
    tools.push({
      type: "function",
      function: {
        name: "google_drive_list",
        description: "Lista arquivos recentes do Google Drive do usuário.",
        parameters: { type: "object", properties: { query: { type: "string", description: "Filtro opcional (Drive query)." }, page_size: { type: "number" } } },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_drive_read",
        description: "Lê o conteúdo de um arquivo do Google Drive (texto). Para Docs/Sheets use as ferramentas específicas.",
        parameters: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"] },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_write",
        description: "Escreve/atualiza valores em um intervalo de uma planilha do Google Sheets.",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_id: { type: "string" },
            range: { type: "string", description: "Ex: 'Sheet1!A1'." },
            values: { type: "array", description: "Matriz de linhas (array de arrays).", items: { type: "array", items: {} } },
          },
          required: ["spreadsheet_id", "range", "values"],
        },
      },
    });
  }

  if (providers.has("notion")) {
    tools.push({
      type: "function",
      function: {
        name: "notion_query_database",
        description: "Consulta um banco de dados do Notion pelo ID.",
        parameters: { type: "object", properties: { database_id: { type: "string" } }, required: ["database_id"] },
      },
    });
  }

  if (providers.has("linear")) {
    tools.push({
      type: "function",
      function: { name: "linear_list_projects", description: "Lista projetos do Linear.", parameters: { type: "object", properties: {} } },
    });
  }

  if (providers.has("asana")) {
    tools.push({
      type: "function",
      function: {
        name: "asana_list_projects",
        description: "Lista projetos do Asana em um workspace.",
        parameters: { type: "object", properties: { workspace_id: { type: "string" } }, required: ["workspace_id"] },
      },
    });
  }

  return tools;
}

// ---- Tool dispatcher ----
async function executeTool(
  name: string,
  args: any,
  ctx: { admin: any; userId: string; tokens: Map<string, TokenRow> },
): Promise<any> {
  const t = async (provider: string) => {
    const tok = await getValidToken(ctx.admin, ctx.userId, provider, ctx.tokens);
    if (!tok) throw new Error(`Conector ${provider} não está conectado.`);
    return tok;
  };

  try {
    if (name === "notion_search") {
      const tok = await t("notion");
      const r = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
        body: JSON.stringify({ query: args.query, page_size: 10 }),
      });
      return await r.json();
    }
    if (name === "notion_create_page") {
      const tok = await t("notion");
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
        body: JSON.stringify({
          parent: { page_id: args.parent_page_id },
          properties: { title: { title: [{ text: { content: args.title } }] } },
          children: args.content_markdown ? [{
            object: "block", type: "paragraph",
            paragraph: { rich_text: [{ type: "text", text: { content: args.content_markdown } }] },
          }] : [],
        }),
      });
      return await r.json();
    }
    if (name === "slack_send_message") {
      const tok = await t("slack");
      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ channel: args.channel, text: args.text }),
      });
      return await r.json();
    }
    if (name === "slack_list_channels") {
      const tok = await t("slack");
      const r = await fetch("https://slack.com/api/conversations.list?limit=100&types=public_channel", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const d = await r.json();
      return { channels: (d.channels ?? []).map((c: any) => ({ id: c.id, name: c.name })) };
    }
    if (name === "linear_list_teams") {
      const tok = await t("linear");
      const r = await fetch("https://api.linear.app/graphql", {
        method: "POST", headers: { Authorization: tok, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ teams { nodes { id name key } } }" }),
      });
      return await r.json();
    }
    if (name === "linear_create_issue") {
      const tok = await t("linear");
      const r = await fetch("https://api.linear.app/graphql", {
        method: "POST", headers: { Authorization: tok, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { id identifier url title } } }`,
          variables: { i: { teamId: args.team_id, title: args.title, description: args.description ?? "" } },
        }),
      });
      return await r.json();
    }
    if (name === "asana_list_workspaces") {
      const tok = await t("asana");
      const r = await fetch("https://app.asana.com/api/1.0/workspaces", { headers: { Authorization: `Bearer ${tok}` } });
      return await r.json();
    }
    if (name === "asana_create_task") {
      const tok = await t("asana");
      const r = await fetch("https://app.asana.com/api/1.0/tasks", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { workspace: args.workspace_id, name: args.name, notes: args.notes ?? "" } }),
      });
      return await r.json();
    }
    if (name === "google_calendar_list_events") {
      const tok = await t("google");
      const max = args.max_results ?? 10;
      const now = new Date().toISOString();
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=${max}&timeMin=${encodeURIComponent(now)}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      return await r.json();
    }
    if (name === "google_calendar_create_event") {
      const tok = await t("google");
      const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: args.summary, description: args.description ?? "",
          start: { dateTime: args.start_iso }, end: { dateTime: args.end_iso },
        }),
      });
      return await r.json();
    }
    if (name === "google_sheets_read") {
      const tok = await t("google");
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheet_id}/values/${encodeURIComponent(args.range)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      return await r.json();
    }
    if (name === "google_docs_create") {
      const tok = await t("google");
      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: args.title }),
      });
      const doc = await createRes.json();
      if (args.body && doc.documentId) {
        await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: args.body } }] }),
        });
      }
      return { documentId: doc.documentId, title: doc.title, url: doc.documentId ? `https://docs.google.com/document/d/${doc.documentId}/edit` : null };
    }
    if (name === "github_list_repos") {
      const tok = await t("github");
      const r = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: { 
          Authorization: `Bearer ${tok}`, 
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Vintel-IA"
        },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao listar repositórios");
      return Array.isArray(data) ? data.map((repo: any) => ({
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        updated_at: repo.updated_at
      })) : data;
    }
    if (name === "github_get_repo") {
      const tok = await t("github");
      const r = await fetch(`https://api.github.com/repos/${args.repo}`, {
        headers: { 
          Authorization: `Bearer ${tok}`, 
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Vintel-IA"
        },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao obter repositório");
      return data;
    }
    if (name === "github_create_issue") {
      const tok = await t("github");
      const r = await fetch(`https://api.github.com/repos/${args.repo}/issues`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${tok}`, 
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "Vintel-IA"
        },
        body: JSON.stringify({ title: args.title, body: args.body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao criar issue");
      return { id: data.id, number: data.number, url: data.html_url };
    }

    return { error: `Tool desconhecida: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro na execução" };
  }
}

// ---- Helpers ----
function sseChunk(content: string) {
  const payload = { choices: [{ delta: { content } }] };
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}
const SSE_DONE = new TextEncoder().encode("data: [DONE]\n\n");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, agent, plan, temperature: userTemp } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Identify user (optional) to load their oauth tokens for tool calling.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
        if (data?.claims?.sub) userId = data.claims.sub as string;
      } catch { /* anonymous chat */ }
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokens = new Map<string, TokenRow>();
    const connectedProviders = new Set<string>();
    if (userId) {
      const { data: rows } = await admin
        .from("oauth_tokens")
        .select("provider, access_token, refresh_token, expires_at")
        .eq("user_id", userId);
      for (const r of rows ?? []) {
        tokens.set(r.provider, r as TokenRow);
        connectedProviders.add(r.provider);
      }
    }
    const tools = buildToolsForProviders(connectedProviders);

    const systemPrompt = agent && agentSystemPrompts[agent] ? agentSystemPrompts[agent] : defaultSystemPrompt;

    // Silent eager context injection: pre-fetch lightweight metadata from connected
    // providers so the model knows about the user's environment without needing
    // to call a tool first. Best-effort; failures are swallowed.
    let eagerContext = "";
    if (connectedProviders.size > 0) {
      const blocks: string[] = [];
      await Promise.all([
        (async () => {
          if (!connectedProviders.has("github")) return;
          try {
            const tok = await getValidToken(admin, userId!, "github", tokens);
            if (!tok) return;
            const r = await fetch("https://api.github.com/user/repos?per_page=10&sort=updated", {
              headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "User-Agent": "Vintel-IA" },
            });
            if (!r.ok) return;
            const data = await r.json();
            if (Array.isArray(data) && data.length) {
              const list = data.slice(0, 10).map((x: any) => `- ${x.full_name}${x.description ? ` — ${x.description}` : ""}`).join("\n");
              blocks.push(`Repositórios recentes do GitHub do usuário:\n${list}`);
            }
          } catch { /* silent */ }
        })(),
        (async () => {
          if (!connectedProviders.has("google")) return;
          try {
            const tok = await getValidToken(admin, userId!, "google", tokens);
            if (!tok) return;
            const r = await fetch(
              "https://www.googleapis.com/drive/v3/files?pageSize=10&orderBy=modifiedTime+desc&fields=files(name,mimeType,modifiedTime)",
              { headers: { Authorization: `Bearer ${tok}` } },
            );
            if (!r.ok) return;
            const data = await r.json();
            const files = (data.files ?? []) as any[];
            if (files.length) {
              const list = files.map((f) => `- ${f.name} (${f.mimeType})`).join("\n");
              blocks.push(`Arquivos recentes do Google Drive do usuário:\n${list}`);
            }
          } catch { /* silent */ }
        })(),
      ]);
      if (blocks.length) {
        eagerContext = `\n\nContexto do Usuário (pré-carregado, use de forma natural se relevante):\n${blocks.join("\n\n")}`;
      }
    }

    const connectedNote = connectedProviders.size > 0
      ? `\n\nConectores ativos do usuário: ${[...connectedProviders].join(", ")}. Use as ferramentas disponíveis quando útil.${eagerContext}`
      : `\n\nO usuário não tem conectores ativos no momento.`;

    // Model selection
    const modelMap: Record<string, string> = {
      free: "google/gemini-2.5-flash",
      starter: "google/gemini-2.5-flash",
      pro: "google/gemini-2.5-pro",
      agency: "openai/gpt-5",
    };
    const model = modelMap[plan || "free"] || "google/gemini-2.5-flash";

    // Process attachments
    const processed = (messages as any[]).map((m: any) => {
      if (m.attachments?.length) {
        const imgs = m.attachments.filter((a: any) => a.type === "image");
        if (imgs.length) {
          return {
            role: m.role,
            content: [{ type: "text", text: m.content }, ...imgs.map((i: any) => ({ type: "image_url", image_url: { url: i.url } }))],
          };
        }
      }
      return { role: m.role, content: m.content };
    });

    const convo: any[] = [
      { role: "system", content: systemPrompt + connectedNote },
      ...processed,
    ];

    // If no tools available, behave like before: stream straight from the gateway.
    if (tools.length === 0) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: convo, stream: true, ...(model.startsWith("openai/") ? {} : { temperature: typeof userTemp === "number" ? userTemp : 0.7 }) }),
      });
      if (!r.ok) {
        if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Tool loop (non-streaming), then stream the final answer.
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < 5; i++) {
            const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model, messages: convo, tools, tool_choice: "auto", ...(model.startsWith("openai/") ? {} : { temperature: typeof userTemp === "number" ? userTemp : 0.7 }) }),
            });
            if (!r.ok) {
              const txt = await r.text();
              controller.enqueue(sseChunk(`\n\n⚠️ Erro no gateway: ${r.status} ${txt.slice(0, 200)}`));
              break;
            }
            const data = await r.json();
            const msg = data.choices?.[0]?.message;
            if (!msg) { controller.enqueue(sseChunk("\n\n⚠️ Resposta vazia do modelo.")); break; }

            convo.push(msg);

            if (msg.tool_calls?.length) {
              for (const tc of msg.tool_calls) {
                let parsedArgs: any = {};
                try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }
                controller.enqueue(sseChunk(`\n\n🔧 *Executando \`${tc.function.name}\`…*\n`));
                const result = await executeTool(tc.function.name, parsedArgs, { admin, userId: userId!, tokens });
                convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
              }
              continue;
            }

            // Final text — stream as one chunk so the frontend renders it.
            const content = msg.content || "";
            if (content) controller.enqueue(sseChunk(content));
            break;
          }
          controller.enqueue(SSE_DONE);
          controller.close();
        } catch (e) {
          controller.enqueue(sseChunk(`\n\n⚠️ ${e instanceof Error ? e.message : "Erro"}`));
          controller.enqueue(SSE_DONE);
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
