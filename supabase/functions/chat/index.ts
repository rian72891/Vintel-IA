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

const defaultSystemPrompt = `Você é a Vintel IA — um AGENTE AUTÔNOMO ReAct (Reasoning + Acting) que opera em português brasileiro, direto e técnico, com markdown rico e código completo em blocos.

# CICLO ReAct
Você opera num loop contínuo:
1. **Pensamento (Thought)**: analise o estado, o que sabe e o que falta. Escreva o raciocínio dentro de um bloco \`<thinking>...</thinking>\` curto e focado no objetivo técnico.
2. **Ação (Action)**: quando precisar de dados externos ou efeitos colaterais, EXECUTE chamando as ferramentas reais via tool_calls nativos do modelo (function calling). NUNCA escreva "Ação: nome(...)" como texto — isso não executa nada. Sempre emita um tool_call de verdade.
3. **Observação (Observation)**: o resultado da ferramenta chega como mensagem \`tool\`. Use-o no próximo Pensamento.

Repita Pensamento → Ação → Observação quantas vezes precisar. Só dê a **Resposta Final** (texto normal para o usuário) quando a tarefa estiver concluída com sucesso.

# REGRAS CRÍTICAS
1. **Pense antes de agir**: nunca chame ferramentas sem um \`<thinking>\` prévio justificando.
2. **Paralelismo obrigatório**: se precisar de mais de 1 leitura/ação independente, EMITA TODAS as tool_calls JUNTAS na MESMA resposta. Nunca leia arquivos um a um em rodadas separadas.
3. **Trate erros**: se a Observação indicar falha, no próximo Pensamento planeje correção ou caminho alternativo — não repita a mesma chamada cegamente.
4. **Conciso**: \`<thinking>\` curto e técnico. A Resposta Final é completa, clara e sem enrolação.
5. **Confirmação só para ações destrutivas** (deletar/arquivar). Demais ações de escrita: execute direto.

# FERRAMENTAS (chame via tool_calls quando o conector estiver ativo)
- **GitHub** (escrita REAL liberada quando conectado): \`github_create_issue\`, \`github_commit_file\`, \`github_create_branch\`, \`github_create_pull_request\`, \`github_read_file\`, \`github_read_files\` (batch — PREFIRA esta para múltiplos arquivos). NUNCA diga "não faço commits nem abro PRs": você FAZ. Para fluxos em lote (auditoria, padronização, README de perfil, reversão 48h), informe que existe \`/github-agent\` com botões dedicados.
- **Lovable** (quando conectado): \`lovable_list_projects\`, \`lovable_create_project\`, \`lovable_send_message\` — crie e edite projetos Lovable direto pelo chat.
- **Web** (sempre disponível): \`web_search\` (buscar na web em tempo real) e \`web_scrape\` (extrair o conteúdo de uma URL). Use sempre que precisar de informação atual ou de conteúdo de um link enviado pelo usuário.
- Para sugerir mensagem de commit: leia no máximo 2–3 arquivos relevantes (README + package.json), não o repo inteiro.`;


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

// ---- Custom MCP client ----
type McpServerRow = {
  id: string;
  name: string;
  url: string;
  auth_token: string | null;
  enabled: boolean;
  tools_cache: any[] | null;
  last_synced_at: string | null;
};

function isPrivateIpv4(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function isPrivateIp(ip: string) {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return isPrivateIpv4(value) || value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

async function validateMcpUrl(raw: string) {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("URL do servidor MCP inválida."); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("O servidor MCP deve usar uma URL HTTP(S) sem credenciais embutidas.");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)) throw new Error("Por segurança, servidores MCP em endereços locais ou privados não são permitidos.");
  const records = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  if (records.flat().some(isPrivateIp)) throw new Error("O hostname do servidor MCP resolve para um endereço privado ou interno.");
  return parsed;
}

async function mcpJsonRpc(url: string, method: string, params: unknown, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }), signal: controller.signal, redirect: "error" });
    const text = await response.text();
    if (!response.ok) throw new Error(`Servidor MCP respondeu HTTP ${response.status}.`);
    let payload: any;
    try { payload = JSON.parse(text); } catch { throw new Error("Resposta inválida do servidor MCP."); }
    if (payload?.error) throw new Error(payload.error.message || "Erro JSON-RPC do servidor MCP.");
    return payload?.result ?? {};
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("O servidor MCP excedeu o tempo limite de 15 segundos.");
    throw error;
  } finally { clearTimeout(timer); }
}

async function fetchMcpTools(server: McpServerRow) {
  await validateMcpUrl(server.url);
  await mcpJsonRpc(server.url, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "vintel-ia", version: "1.0.0" } }, server.auth_token ?? undefined).catch(() => undefined);
  const result = await mcpJsonRpc(server.url, "tools/list", {}, server.auth_token ?? undefined);
  return Array.isArray(result?.tools) ? result.tools.slice(0, 100) : [];
}

function mcpSlug(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "servidor";
}

function mcpToolName(server: McpServerRow, toolName: string) {
  return `mcp_${mcpSlug(server.name)}_${server.id.slice(0, 8)}_${toolName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)}`;
}

async function loadMcpTools(admin: any, userId: string | null) {
  if (!userId) return { tools: [], servers: [] as McpServerRow[] };
  const { data, error } = await admin.from("mcp_servers").select("id, name, url, auth_token, enabled, tools_cache, last_synced_at").eq("user_id", userId).eq("enabled", true).limit(20);
  if (error) return { tools: [], servers: [] as McpServerRow[] };
  const servers = (data ?? []) as McpServerRow[];
  const tools: any[] = [];
  for (const server of servers) {
    try {
      const fresh = server.last_synced_at && Date.now() - new Date(server.last_synced_at).getTime() < 60 * 60 * 1000;
      const discovered = fresh && Array.isArray(server.tools_cache) ? server.tools_cache : await fetchMcpTools(server);
      if (!fresh) await admin.from("mcp_servers").update({ tools_cache: discovered, last_synced_at: new Date().toISOString() }).eq("id", server.id).eq("user_id", userId);
      for (const tool of discovered) {
        if (!tool?.name || typeof tool.name !== "string") continue;
        tools.push({ type: "function", function: { name: mcpToolName(server, tool.name), description: `[${server.name}] ${String(tool.description || `Ferramenta MCP ${tool.name}`).slice(0, 500)}`, parameters: tool.inputSchema ?? { type: "object", properties: {} } } });
      }
    } catch (error) {
      console.warn(`[mcp] ${server.name}:`, error instanceof Error ? error.message : error);
      await admin.from("mcp_servers").update({ enabled: false }).eq("id", server.id).eq("user_id", userId);
    }
  }
  return { tools, servers };
}

// ---- Tool definitions ----
function buildToolsForProviders(providers: Set<string>) {
  const tools: any[] = [];

  if (providers.has("lovable")) {
    tools.push({
      type: "function",
      function: {
        name: "lovable_list_projects",
        description: "Lista todos os projetos Lovable do usuário.",
        parameters: { type: "object", properties: {} },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "lovable_create_project",
        description: "Cria um novo projeto no Lovable.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Nome do projeto." },
            description: { type: "string", description: "Descrição do projeto." },
          },
          required: ["title"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "lovable_send_message",
        description: "Envia uma mensagem ao agente de um projeto Lovable para fazer alterações no código.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "ID do projeto Lovable." },
            message: { type: "string", description: "Instrução para o agente Lovable executar." },
          },
          required: ["project_id", "message"],
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
    tools.push({
      type: "function",
      function: {
        name: "github_read_files",
        description: "Lê VÁRIOS arquivos de um repo em PARALELO numa única chamada. Use SEMPRE que precisar de mais de 1 arquivo — é MUITO mais rápido que chamar github_read_file várias vezes.",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "dono/nome" },
            paths: { type: "array", items: { type: "string" }, description: "Lista de caminhos de arquivos." },
            ref: { type: "string", description: "Branch/tag/commit (opcional)." },
          },
          required: ["repo", "paths"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_commit_file",
        description: "Cria ou atualiza um arquivo no repositório GitHub com um commit direto na branch indicada (padrão: branch default). Faz commit REAL.",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "dono/nome" },
            path: { type: "string", description: "Caminho do arquivo, ex: README.md ou src/index.ts" },
            content: { type: "string", description: "Conteúdo completo do arquivo (texto)." },
            message: { type: "string", description: "Mensagem do commit." },
            branch: { type: "string", description: "Branch alvo (opcional; padrão: default branch)." },
          },
          required: ["repo", "path", "content", "message"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_create_branch",
        description: "Cria uma nova branch no repositório GitHub a partir de outra branch (padrão: default).",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "dono/nome" },
            new_branch: { type: "string" },
            from_branch: { type: "string", description: "Branch de origem (opcional; padrão: default)." },
          },
          required: ["repo", "new_branch"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "github_create_pull_request",
        description: "Abre um Pull Request REAL no GitHub.",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "dono/nome" },
            title: { type: "string" },
            head: { type: "string", description: "Branch com as mudanças." },
            base: { type: "string", description: "Branch alvo (ex: main)." },
            body: { type: "string" },
          },
          required: ["repo", "title", "head", "base"],
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


  if (Deno.env.get("FIRECRAWL_API_KEY")) {
    tools.push({
      type: "function",
      function: {
        name: "web_search",
        description: "Busca na web em tempo real. Use para informações atuais, notícias, preços, documentação recente.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Consulta de busca." },
            limit: { type: "number", description: "Número de resultados (padrão 5, máx 10)." },
          },
          required: ["query"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "web_scrape",
        description: "Extrai o conteúdo textual (markdown) de uma URL específica.",
        parameters: {
          type: "object",
          properties: { url: { type: "string", description: "URL completa da página." } },
          required: ["url"],
        },
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
    if (name.startsWith("mcp_")) {
      const parts = name.split("_");
      const serverIdPrefix = parts[2];
      const { data: serverRows } = await ctx.admin.from("mcp_servers").select("id, name, url, auth_token, enabled").eq("user_id", ctx.userId).limit(20);
      const server = (serverRows ?? []).find((candidate: any) => String(candidate.id).startsWith(serverIdPrefix));
      if (!server || !server.enabled) throw new Error("Servidor MCP não está disponível.");
      await validateMcpUrl(server.url);
      const originalName = name.slice(`mcp_${mcpSlug(server.name)}_${server.id.slice(0, 8)}_`.length);
      await mcpJsonRpc(server.url, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "vintel-ia", version: "1.0.0" } }, server.auth_token ?? undefined).catch(() => undefined);
      return await mcpJsonRpc(server.url, "tools/call", { name: originalName, arguments: args ?? {} }, server.auth_token ?? undefined);
    }
    if (name === "lovable_list_projects") {
      const tok = await t("lovable");
      const r = await fetch("https://api.lovable.dev/v1/projects", {
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      });
      return await r.json();
    }
    if (name === "lovable_create_project") {
      const tok = await t("lovable");
      const r = await fetch("https://api.lovable.dev/v1/projects", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: args.title, description: args.description ?? "" }),
      });
      return await r.json();
    }
    if (name === "lovable_send_message") {
      const tok = await t("lovable");
      const r = await fetch(`https://api.lovable.dev/v1/projects/${args.project_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: args.message }),
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

    if (name === "github_read_file") {
      const tok = await t("github");
      const url = `https://api.github.com/repos/${args.repo}/contents/${args.path}${args.ref ? `?ref=${encodeURIComponent(args.ref)}` : ""}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Vintel-IA" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao ler arquivo");
      const content = data.content ? atob(String(data.content).replace(/\n/g, "")) : "";
      return { path: data.path, size: data.size, content: content.slice(0, 8000) };
    }
    if (name === "github_read_files") {
      const tok = await t("github");
      const paths: string[] = Array.isArray(args.paths) ? args.paths.slice(0, 25) : [];
      const ref = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
      const headers = { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Vintel-IA" };
      const files = await Promise.all(paths.map(async (p) => {
        try {
          const r = await fetch(`https://api.github.com/repos/${args.repo}/contents/${p}${ref}`, { headers });
          const data = await r.json();
          if (!r.ok) return { path: p, error: data.message || `HTTP ${r.status}` };
          const content = data.content ? atob(String(data.content).replace(/\n/g, "")) : "";
          return { path: data.path, size: data.size, content: content.slice(0, 4000) };
        } catch (e) {
          return { path: p, error: e instanceof Error ? e.message : "erro" };
        }
      }));
      return { files };
    }
    if (name === "google_drive_list") {
      const tok = await t("google");
      const params = new URLSearchParams({
        pageSize: String(args.page_size ?? 20),
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      });
      if (args.query) params.set("q", args.query);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${tok}` } });
      return await r.json();
    }
    if (name === "google_drive_read") {
      const tok = await t("google");
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${args.file_id}?alt=media`, { headers: { Authorization: `Bearer ${tok}` } });
      const text = await r.text();
      return { content: text.slice(0, 8000) };
    }
    if (name === "google_sheets_write") {
      const tok = await t("google");
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheet_id}/values/${args.range}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: args.values }),
        },
      );
      return await r.json();
    }
    if (name === "web_search" || name === "web_scrape") {
      const key = Deno.env.get("FIRECRAWL_API_KEY");
      if (!key) throw new Error("Busca na web não está configurada.");
      const endpoint = name === "web_search" ? "search" : "scrape";
      const body = name === "web_search"
        ? { query: args.query, limit: Math.min(Number(args.limit) || 5, 10), scrapeOptions: { formats: ["markdown"] } }
        : { url: args.url, formats: ["markdown"], onlyMainContent: true };
      const r = await fetch(`https://api.firecrawl.dev/v1/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
      if (name === "web_search") {
        const items = (d.data ?? []).map((x: any) => ({
          title: x.title, url: x.url, description: x.description,
          content: typeof x.markdown === "string" ? x.markdown.slice(0, 4000) : undefined,
        }));
        return { results: items };
      }
      const md = d?.data?.markdown ?? d?.markdown ?? "";
      return { url: args.url, content: String(md).slice(0, 12000), metadata: d?.data?.metadata ?? d?.metadata };
    }

    if (name === "github_commit_file") {
      const tok = await t("github");
      const ghHeaders = { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "User-Agent": "Vintel-IA", "X-GitHub-Api-Version": "2022-11-28" };
      let branch = args.branch as string | undefined;
      if (!branch) {
        const rr = await fetch(`https://api.github.com/repos/${args.repo}`, { headers: ghHeaders });
        const rd = await rr.json();
        if (!rr.ok) throw new Error(rd.message || "Erro ao obter repo");
        branch = rd.default_branch;
      }
      // get existing sha if file exists
      let sha: string | undefined;
      const exist = await fetch(`https://api.github.com/repos/${args.repo}/contents/${encodeURIComponent(args.path)}?ref=${branch}`, { headers: ghHeaders });
      if (exist.ok) { const ed = await exist.json(); sha = ed.sha; }
      const b64 = btoa(unescape(encodeURIComponent(args.content)));
      const r = await fetch(`https://api.github.com/repos/${args.repo}/contents/${encodeURIComponent(args.path)}`, {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: args.message, content: b64, branch, ...(sha ? { sha } : {}) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao commitar");
      return { commit_url: data.commit?.html_url, content_url: data.content?.html_url, branch };
    }
    if (name === "github_create_branch") {
      const tok = await t("github");
      const ghHeaders = { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "User-Agent": "Vintel-IA" };
      let from = args.from_branch as string | undefined;
      if (!from) {
        const rr = await fetch(`https://api.github.com/repos/${args.repo}`, { headers: ghHeaders });
        const rd = await rr.json();
        from = rd.default_branch;
      }
      const refRes = await fetch(`https://api.github.com/repos/${args.repo}/git/refs/heads/${from}`, { headers: ghHeaders });
      const refData = await refRes.json();
      if (!refRes.ok) throw new Error(refData.message || "Erro ao obter ref base");
      const r = await fetch(`https://api.github.com/repos/${args.repo}/git/refs`, {
        method: "POST",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${args.new_branch}`, sha: refData.object.sha }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao criar branch");
      return { ref: data.ref, sha: data.object?.sha };
    }
    if (name === "github_create_pull_request") {
      const tok = await t("github");
      const r = await fetch(`https://api.github.com/repos/${args.repo}/pulls`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "User-Agent": "Vintel-IA", "Content-Type": "application/json" },
        body: JSON.stringify({ title: args.title, head: args.head, base: args.base, body: args.body ?? "" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao abrir PR");
      return { number: data.number, url: data.html_url, state: data.state };
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
/** Evento de progresso (trace visual) — ignorado por clients que só leem `choices`. */
function sseStep(step: { id: string; status: "running" | "done" | "error" | "waiting"; label: string; detail?: string; result?: unknown }) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type: "step", ...step })}\n\n`);
}

/** Evento de confirmação de ação irreversível. */
function sseConfirm(c: { id: string; tool: string; args: any; label: string }) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type: "confirm", ...c })}\n\n`);
}

const SSE_DONE = new TextEncoder().encode("data: [DONE]\n\n");

/** Rótulo legível por ferramenta, para a timeline. */
function toolLabel(name: string, args: any): string {
  if (name.startsWith("mcp_")) {
    const parts = name.split("_");
    const server = parts.slice(1, -2).join(" ") || "Servidor";
    const action = parts.slice(3).join(" ").replace(/_/g, " ");
    return `${server} (MCP): ${action}${args?.title ? ` — ${String(args.title).slice(0, 60)}` : ""}`;
  }
  const svc = name.split("_")[0];
  const map: Record<string, string> = {
    github: "GitHub", google: "Google Workspace", gmail: "Gmail",
    lovable: "Lovable", web: "Web",
  };
  const service = map[svc] ?? svc;
  const target = args?.repo || args?.query || args?.path || args?.channel || args?.title || args?.url || args?.name || "";
  const action = name.replace(`${svc}_`, "").replace(/_/g, " ");
  return `${service}: ${action}${target ? ` — ${String(target).slice(0, 60)}` : ""}`;
}

/** Ferramentas que criam/editam/deletam algo em serviços externos → exigem confirmação. */
const IRREVERSIBLE_TOOLS = new Set([
  "github_create_issue",
  "github_commit_file",
  "github_create_branch",
  "github_create_pull_request",
  "github_archive_repos",
  "google_calendar_create_event",
  "google_calendar_update_event",
  "google_docs_create",
  "google_sheets_write",
  "google_drive_move",
  "lovable_create_project",
  "lovable_send_message",
]);

function isIrreversible(name: string) {
  if (name.startsWith("mcp_")) return true;
  if (IRREVERSIBLE_TOOLS.has(name)) return true;
  return /_(create|update|write|delete|send|commit|archive|move|edit)(_|$)/.test(name);
}

/** Chave determinística (mesma ação → mesma chave entre requisições). */
function actionKey(name: string, args: any): string {
  const stable = JSON.stringify(args ?? {}, Object.keys(args ?? {}).sort());
  const raw = `${name}|${stable}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  return `act_${h.toString(36)}`;
}

/** Descrição legível da ação irreversível, mostrada no card de confirmação. */
function actionLabel(name: string, args: any): string {
  const t = (v: unknown) => String(v ?? "").slice(0, 120);
  if (name.startsWith("mcp_")) return `Executar ação externa em ${toolLabel(name, args)} — confirmação obrigatória`;
  switch (name) {
    case "github_create_issue":
      return `Abrir uma issue no GitHub em ${t(args.repo)} com o título: "${t(args.title)}"`;
    case "github_commit_file":
      return `Fazer commit do arquivo ${t(args.path)} em ${t(args.repo)}`;
    case "github_create_branch":
      return `Criar a branch "${t(args.branch)}" em ${t(args.repo)}`;
    case "github_create_pull_request":
      return `Abrir um pull request em ${t(args.repo)}: "${t(args.title)}"`;
    case "google_calendar_create_event":
      return `Criar o evento "${t(args.summary || args.title)}" no Google Agenda`;
    case "google_docs_create":
      return `Criar o documento "${t(args.title)}" no Google Docs`;
    case "google_sheets_write":
      return `Escrever dados na planilha ${t(args.spreadsheetId)} (${t(args.range)})`;
    case "lovable_create_project":
      return `Criar o projeto "${t(args.name)}" na Lovable`;
    case "lovable_send_message":
      return `Enviar mensagem para o projeto ${t(args.projectId)} na Lovable`;
    default:
      return `Executar ação: ${toolLabel(name, args)}`;
  }
}



// ---- Google Gemini (API oficial) ----
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function cleanSchema(s: any): any {
  if (Array.isArray(s)) return s.map(cleanSchema);
  if (!s || typeof s !== "object") return s;
  const out: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (["additionalProperties", "$schema", "default", "examples", "exclusiveMinimum", "exclusiveMaximum"].includes(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      out[k] = Object.fromEntries(Object.entries(v as any).map(([pk, pv]) => [pk, cleanSchema(pv)]));
    } else {
      out[k] = cleanSchema(v);
    }
  }
  return out;
}

function toGeminiTools(tools: any[]) {
  if (!tools?.length) return undefined;
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: cleanSchema(t.function.parameters ?? { type: "object", properties: {} }),
    })),
  }];
}

function contentToParts(content: any): any[] {
  if (typeof content === "string") return content ? [{ text: content }] : [{ text: "" }];
  if (Array.isArray(content)) {
    const parts: any[] = [];
    for (const c of content) {
      if (c.type === "text") parts.push({ text: c.text });
      else if (c.type === "image_url") {
        const url: string = c.image_url?.url ?? "";
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        else parts.push({ text: `[imagem: ${url}]` });
      }
    }
    return parts.length ? parts : [{ text: "" }];
  }
  return [{ text: "" }];
}

/** Converte a conversa em formato OpenAI para o formato do Gemini. */
function toGeminiRequest(convo: any[]) {
  let systemInstruction: any = undefined;
  const contents: any[] = [];
  const callNames = new Map<string, string>();

  for (const m of convo) {
    if (m.role === "system") {
      systemInstruction = { role: "user", parts: contentToParts(m.content) };
      continue;
    }
    if (m.role === "tool") {
      const name = callNames.get(m.tool_call_id) ?? "tool";
      let resp: any;
      try { resp = JSON.parse(m.content); } catch { resp = { result: m.content }; }
      if (resp === null || typeof resp !== "object" || Array.isArray(resp)) resp = { result: resp };
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: resp } }] });
      continue;
    }
    if (m.role === "assistant") {
      const parts: any[] = [];
      if (m.content) parts.push({ text: typeof m.content === "string" ? m.content : "" });
      for (const tc of m.tool_calls ?? []) {
        callNames.set(tc.id, tc.function.name);
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
        const part: any = { functionCall: { name: tc.function.name, args } };
        // Gemini exige que a assinatura de pensamento volte inalterada na mesma part.
        if (tc.thought_signature) part.thoughtSignature = tc.thought_signature;
        parts.push(part);
      }

      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
      continue;
    }
    contents.push({ role: "user", parts: contentToParts(m.content) });
  }

  return { systemInstruction, contents };
}

async function callGemini(opts: {
  apiKey: string;
  model: string;
  convo: any[];
  tools?: any[];
  temperature?: number;
  stream?: boolean;
}) {
  const { systemInstruction, contents } = toGeminiRequest(opts.convo);
  const body: any = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(opts.tools?.length ? { tools: toGeminiTools(opts.tools) } : {}),
    generationConfig: { temperature: typeof opts.temperature === "number" ? opts.temperature : 0.7 },
  };
  const method = opts.stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = `${GEMINI_BASE}/${opts.model}:${method}`;
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  };

  // Retry com backoff exponencial (1s, 2s, 4s) em 503/UNAVAILABLE
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < 3 && res.status === 503; attempt++) {
    const delay = 1000 * Math.pow(2, attempt);
    console.warn(`Gemini 503 (UNAVAILABLE). Retry ${attempt + 1}/3 em ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(url, init);
  }
  return res;
}

/* ==================== CADEIA DE PROVEDORES (FAILOVER) ====================
   Ordem: Gemini → Groq → Mistral → Cerebras → OpenRouter.
   Provedores 2-5 são compatíveis com o formato OpenAI, então usamos
   `convo`/`tools` internos diretamente, sem conversão.                    */

type OaiProvider = { name: string; base: string; model: string; env: string };

const OAI_PROVIDERS: OaiProvider[] = [
  { name: "Groq", base: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", env: "GROQ_API_KEY" },
  { name: "Mistral", base: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", env: "MISTRAL_API_KEY" },
  // "llama-3.3-70b" foi descontinuado na Cerebras; o catálogo atual expõe "gpt-oss-120b".
  { name: "Cerebras", base: "https://api.cerebras.ai/v1/chat/completions", model: "gpt-oss-120b", env: "CEREBRAS_API_KEY" },
  // Modelo gratuito confirmado no catálogo do OpenRouter (pricing 0, suporta tools).
  { name: "OpenRouter", base: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemma-4-31b-it:free", env: "OPENROUTER_API_KEY" },
];

/**
 * Consome o SSE de um provedor (Gemini ou OpenAI-compatible) incrementalmente.
 * Texto é repassado a `onText` assim que chega; chamadas de ferramenta são
 * acumuladas até o chunk de conclusão (finish_reason / finishReason).
 */
async function consumeAgentStream(
  kind: "gemini" | "openai",
  body: ReadableStream<Uint8Array>,
  iter: number,
  onText: (t: string) => void,
): Promise<{ text: string; calls: any[]; finished: boolean }> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let text = "";
  let finished = false;
  const geminiCalls: any[] = [];
  const oaiCalls = new Map<number, { id: string; name: string; args: string }>();

  const handle = (json: string) => {
    if (!json || json === "[DONE]") { if (json === "[DONE]") finished = true; return; }
    let parsed: any;
    try { parsed = JSON.parse(json); } catch { return; }
    if (kind === "gemini") {
      const cand = parsed.candidates?.[0];
      for (const p of cand?.content?.parts ?? []) {
        if (p.thought) continue;
        if (typeof p.text === "string" && p.text) { text += p.text; onText(p.text); }
        if (p.functionCall) {
          geminiCalls.push({
            id: `call_${iter}_${geminiCalls.length}`,
            type: "function",
            thought_signature: p.thoughtSignature ?? p.thought_signature ?? null,
            function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
          });
        }
      }
      if (cand?.finishReason) finished = true;
    } else {
      const choice = parsed.choices?.[0];
      const delta = choice?.delta ?? {};
      if (typeof delta.content === "string" && delta.content) { text += delta.content; onText(delta.content); }
      for (const tc of delta.tool_calls ?? []) {
        const idx = typeof tc.index === "number" ? tc.index : oaiCalls.size;
        const cur = oaiCalls.get(idx) ?? { id: "", name: "", args: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) {
          cur.args += typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments);
        }
        oaiCalls.set(idx, cur);
      }
      if (choice?.finish_reason) finished = true;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (line.startsWith("data:")) handle(line.slice(5).trim());
    }
  }
  if (buffer.startsWith("data:")) handle(buffer.slice(5).trim());

  const calls = kind === "gemini"
    ? geminiCalls
    : [...oaiCalls.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({
        id: c.id || `call_${iter}_${i}`,
        type: "function",
        function: { name: c.name, arguments: c.args || "{}" },
      }));
  return { text, calls, finished };
}

/** Remove campos específicos do Gemini e normaliza o conteúdo para o formato OpenAI. */
function sanitizeConvoForOpenAI(convo: any[]) {
  return convo.map((m) => {
    const out: any = { role: m.role };
    if (Array.isArray(m.content)) {
      const parts = m.content
        .map((c: any) => {
          if (typeof c === "string") return { type: "text", text: c };
          if (c?.type === "image_url" && c.image_url?.url) return c;
          if (c?.text) return { type: "text", text: c.text };
          return null;
        })
        .filter(Boolean);
      out.content = parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
    } else {
      out.content = m.content ?? "";
    }
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.tool_calls?.length) {
      out.tool_calls = m.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments ?? "{}" },
      }));
    }
    return out;
  });
}

/** Chamada genérica a qualquer endpoint compatível com a API da OpenAI. */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  convo: any[],
  tools?: any[],
  opts?: { stream?: boolean; temperature?: number },
) {
  const body: any = {
    model,
    messages: sanitizeConvoForOpenAI(convo),
    temperature: typeof opts?.temperature === "number" ? opts.temperature : 0.7,
    ...(opts?.stream ? { stream: true } : {}),
    ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
  };
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  };

  let res = await fetch(baseUrl, init);
  for (let attempt = 0; attempt < 3 && res.status === 503; attempt++) {
    const delay = 1000 * Math.pow(2, attempt);
    console.warn(`${baseUrl} ${res.status}. Retry ${attempt + 1}/3 em ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(baseUrl, init);
  }
  return res;
}

/** Converte o SSE de um provedor OpenAI-compatible para o SSE do frontend. */
function openAiStreamToSse(upstream: ReadableStream<Uint8Array>, prelude?: Uint8Array) {
  const decoder = new TextDecoder();
  let buffer = "";
  const filter = createThinkingFilter();
  return new ReadableStream({
    async start(controller) {
      if (prelude) controller.enqueue(prelude);
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed.choices?.[0]?.delta?.content ?? "";
              if (text) {
                const visible = filter.push(text);
                if (visible) controller.enqueue(sseChunk(visible));
              }
            } catch { /* chunk parcial */ }
          }
        }
      } catch { /* fim inesperado */ }
      const tail = filter.flush();
      if (tail) controller.enqueue(sseChunk(tail));
      controller.enqueue(SSE_DONE);
      controller.close();
    },
  });
}




/**
 * Filtro incremental de blocos <thinking>…</thinking>.
 * Bufferiza texto quando uma tag pode estar quebrada entre chunks,
 * garantindo que nenhum pedaço do raciocínio vaze para o usuário.
 */
const OPEN_TAG = "<thinking>";
const CLOSE_TAG = "</thinking>";

function createThinkingFilter() {
  let pending = "";
  let inside = false;

  /** Maior sufixo de `s` que é prefixo de `tag` (tag possivelmente quebrada). */
  const partialTail = (s: string, tag: string) => {
    const max = Math.min(s.length, tag.length - 1);
    for (let n = max; n > 0; n--) {
      if (tag.startsWith(s.slice(s.length - n))) return n;
    }
    return 0;
  };

  return {
    push(chunk: string): string {
      pending += chunk;
      let out = "";
      while (pending.length) {
        if (!inside) {
          const i = pending.indexOf(OPEN_TAG);
          if (i !== -1) {
            out += pending.slice(0, i);
            pending = pending.slice(i + OPEN_TAG.length);
            inside = true;
            continue;
          }
          const hold = partialTail(pending, OPEN_TAG);
          out += pending.slice(0, pending.length - hold);
          pending = pending.slice(pending.length - hold);
          break;
        } else {
          const j = pending.indexOf(CLOSE_TAG);
          if (j !== -1) {
            pending = pending.slice(j + CLOSE_TAG.length);
            inside = false;
            continue;
          }
          const hold = partialTail(pending, CLOSE_TAG);
          pending = pending.slice(pending.length - hold);
          break;
        }
      }
      return out;
    },
    flush(): string {
      const rest = inside ? "" : pending;
      pending = "";
      return rest;
    },
  };
}

/** Remove blocos <thinking> de um texto completo (não-streaming). */
function stripThinking(text: string): string {
  const f = createThinkingFilter();
  return (f.push(text) + f.flush()).replace(/^\s+/, "");
}

/** Converte o SSE nativo do Gemini para o formato que o frontend espera. */
function geminiStreamToOpenAiSse(upstream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  const filter = createThinkingFilter();
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const parts = parsed.candidates?.[0]?.content?.parts ?? [];
              const text = parts.map((p: any) => p.text ?? "").join("");
              if (text) {
                const visible = filter.push(text);
                if (visible) controller.enqueue(sseChunk(visible));
              }
            } catch { /* chunk parcial ignorado */ }
          }
        }
      } catch { /* fim inesperado */ }
      const tail = filter.flush();
      if (tail) controller.enqueue(sseChunk(tail));
      controller.enqueue(SSE_DONE);
      controller.close();
    },
  });
}

/* ============================ MEMÓRIA PERSISTENTE ============================ */

type MemoryRow = { id: string; content: string };

/** Carrega as memórias duráveis do usuário para injetar no system prompt. */
async function loadMemories(admin: any, userId: string): Promise<MemoryRow[]> {
  try {
    const { data } = await admin
      .from("user_memories")
      .select("id, content")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40);
    return (data ?? []) as MemoryRow[];
  } catch {
    return [];
  }
}

const SENSITIVE_HINTS = [
  "saúde", "saude", "doença", "doenca", "diagnóstico", "diagnostico", "remédio", "remedio",
  "religi", "igreja", "deus", "política", "politica", "partido", "voto", "eleição", "eleicao",
  "orientação sexual", "orientacao sexual", "gay", "hétero", "hetero", "lésbic", "lesbic", "bissexual",
  "senha", "password", "token", "api key", "api_key", "chave secreta", "cpf", "cartão", "cartao",
  "conta bancária", "conta bancaria", "salário", "salario", "renda",
];

function isSensitive(text: string): boolean {
  const t = text.toLowerCase();
  return SENSITIVE_HINTS.some((h) => t.includes(h));
}

/**
 * Extrai fatos duráveis sobre o usuário a partir do turno atual e
 * salva/atualiza em `user_memories`, evitando duplicatas.
 * Roda em background (waitUntil) — falhas são silenciosas.
 */
async function extractAndSaveMemories(opts: {
  apiKey: string;
  admin: any;
  userId: string;
  convo: any[];
  existing: MemoryRow[];
}) {
  const { apiKey, admin, userId, convo, existing } = opts;
  try {
    const transcript = convo
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
      .join("\n")
      .slice(0, 12000);

    if (!transcript.trim()) return;

    const existingList = existing.map((m, i) => `${i + 1}. [${m.id}] ${m.content}`).join("\n") || "(nenhuma)";

    const prompt = `Você extrai FATOS DURÁVEIS sobre o usuário a partir de uma conversa, para memória de longo prazo.

REGRAS ESTRITAS:
- Só registre fatos que o PRÓPRIO USUÁRIO contou sobre si (preferências, contexto de trabalho, stack, projetos, objetivos, forma de trabalhar).
- NUNCA registre: saúde, orientação sexual, religião, política, dados financeiros detalhados, credenciais, tokens ou chaves.
- Nada de fatos efêmeros ("pediu para corrigir um bug agora").
- Se um fato já existe e mudou, use "update" com o id existente. Se já existe igual, ignore.
- Se não houver nada relevante, devolva listas vazias.

MEMÓRIAS EXISTENTES:
${existingList}

CONVERSA:
${transcript}

Responda SOMENTE com JSON válido no formato:
{"new":["fato 1","fato 2"],"update":[{"id":"uuid","content":"fato atualizado"}]}`;

    const r = await fetch(`${GEMINI_BASE}/gemini-flash-lite-latest:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) return;
    const data = await r.json();
    const raw = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text || "").join("").trim();
    if (!raw) return;

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return; }

    const existingLower = new Set(existing.map((m) => m.content.trim().toLowerCase()));

    const inserts: { user_id: string; content: string }[] = [];
    for (const fact of Array.isArray(parsed.new) ? parsed.new : []) {
      if (typeof fact !== "string") continue;
      const clean = fact.trim();
      if (clean.length < 8 || clean.length > 400) continue;
      if (isSensitive(clean)) continue;
      if (existingLower.has(clean.toLowerCase())) continue;
      existingLower.add(clean.toLowerCase());
      inserts.push({ user_id: userId, content: clean });
    }
    if (inserts.length) {
      await admin.from("user_memories").insert(inserts.slice(0, 10));
    }

    for (const up of Array.isArray(parsed.update) ? parsed.update : []) {
      if (!up?.id || typeof up.content !== "string") continue;
      const clean = up.content.trim();
      if (!clean || isSensitive(clean)) continue;
      if (!existing.some((m) => m.id === up.id)) continue;
      await admin.from("user_memories")
        .update({ content: clean.slice(0, 400) })
        .eq("id", up.id).eq("user_id", userId);
    }
  } catch (e) {
    console.warn("[memory] extração falhou:", e instanceof Error ? e.message : e);
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, agent, temperature: userTemp, approvals, conversationId } = await req.json();
    /** Decisões do usuário sobre ações irreversíveis: { [actionKey]: "approved" | "cancelled" } */
    const decisions: Record<string, "approved" | "cancelled"> =
      (approvals && typeof approvals === "object") ? approvals : {};

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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

    // Derive plan SERVER-SIDE from authenticated user's subscription.
    // Never trust a client-supplied `plan` field — that would let anyone
    // request premium models for free.
    let plan = "free";
    if (userId) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", userId)
        .maybeSingle();
      if (sub?.status === "active" && sub.plan) {
        plan = sub.plan;
      } else {
        const { data: prof } = await admin
          .from("profiles").select("plan").eq("id", userId).maybeSingle();
        if (prof?.plan) plan = prof.plan;
      }
    }

    // Verificar limite de mensagens ANTES de chamar o gateway
    if (userId) {
      const { data: usage } = await admin
        .from("usage_limits")
        .select("messages_used, plan")
        .eq("user_id", userId)
        .maybeSingle();

      if (usage) {
        const planLimits: Record<string, number> = {
          free: 10,
          starter: 50,
          pro: Infinity,
          agency: Infinity,
        };
        const limit = planLimits[plan] ?? 10;
        if (limit !== Infinity && usage.messages_used >= limit) {
          return new Response(
            JSON.stringify({
              error: "limite_atingido",
              message: `Você atingiu o limite de ${limit} mensagens diárias do plano ${plan}. Faça upgrade para continuar.`,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }


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
    const nativeTools = buildToolsForProviders(connectedProviders);
    const { tools: mcpTools } = await loadMcpTools(admin, userId);
    const tools = [...nativeTools, ...mcpTools];

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

    // Model selection (aliases estáveis da API do Gemini)
    const modelMap: Record<string, string> = {
      free: "gemini-flash-lite-latest",
      starter: "gemini-flash-latest",
      pro: "gemini-pro-latest",
      agency: "gemini-pro-latest",
    };
    const FLASH_FALLBACK = "gemini-flash-latest";

    // Fallback automático: se uso mensal > 70% do teto estimado, usa modelo mais econômico
    let model = modelMap[plan] || FLASH_FALLBACK;
    if (userId && (plan === "pro" || plan === "agency")) {
      try {
        const { data: usage } = await admin
          .from("usage_limits")
          .select("messages_used, reset_date")
          .eq("user_id", userId)
          .maybeSingle();

        if (usage) {
          const resetDate = new Date(usage.reset_date);
          const now = new Date();
          const daysInCycle = 30;
          const daysPassed = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
          const expectedUsage = (daysPassed / daysInCycle) * 1000;
          const usageRatio = usage.messages_used / Math.max(expectedUsage, 1);

          if (usageRatio > 0.7) {
            model = FLASH_FALLBACK;
            console.log(`[FALLBACK] plan=${plan} ratio=${usageRatio.toFixed(2)} → model=${model}`);
          }
        }
      } catch { /* fallback silencioso */ }
    }

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
    const hasVisualInput = processed.some((m: any) =>
      Array.isArray(m.content) && m.content.some((part: any) => part?.type === "image_url"),
    );

    // Memória persistente entre conversas
    const memories = userId ? await loadMemories(admin, userId) : [];
    const memoryNote = memories.length
      ? `\n\nMemória de longo prazo sobre o usuário (fatos que ele já contou em conversas anteriores — use com naturalidade, nunca liste isso de volta sem motivo):\n${memories.map((m) => `- ${m.content}`).join("\n")}`
      : "";

    // Documentos anexados a esta conversa
    let docsNote = "";
    if (userId && conversationId) {
      try {
        const { data: docs } = await admin
          .from("conversation_documents")
          .select("name, mime_type, extracted_text")
          .eq("user_id", userId)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(10);
        if (docs?.length) {
          const parts = docs
            .filter((d: any) => d.extracted_text)
            .map((d: any) => `### ${d.name}\n${String(d.extracted_text).slice(0, 12000)}`);
          if (parts.length) {
            docsNote = `\n\nDocumentos anexados a esta conversa (use o conteúdo quando for relevante e cite o nome do arquivo):\n${parts.join("\n\n")}`;
          }
        }
      } catch (_) { /* ignore */ }
    }

    const convo: any[] = [
      { role: "system", content: systemPrompt + connectedNote + memoryNote + docsNote },
      ...processed,
    ];

    // Chamada com retry automático: 429 (quota do modelo Pro) → degrada para Flash.
    const callWithFallback = async (opts: { tools?: any[]; stream?: boolean }) => {
      let r = await callGemini({ apiKey: GEMINI_API_KEY, model, convo, tools: opts.tools, temperature: userTemp, stream: opts.stream });
      if (r.status === 429 && model !== FLASH_FALLBACK) {
        const txt = await r.text().catch(() => "");
        console.warn(`[QUOTA] 429 em ${model}, degradando para ${FLASH_FALLBACK}: ${txt.slice(0, 300)}`);
        model = FLASH_FALLBACK;
        r = await callGemini({ apiKey: GEMINI_API_KEY, model, convo, tools: opts.tools, temperature: userTemp, stream: opts.stream });
      }
      return r;
    };

    /** Cadeia de failover: Gemini → Groq → Mistral → Cerebras → OpenRouter. */
    const callChain = async (
      opts: { tools?: any[]; stream?: boolean },
    ): Promise<{ provider: string; kind: "gemini" | "openai"; res: Response } | { provider: null; status: number; detail: string }> => {
      let lastStatus = 500;
      let lastDetail = "";

      try {
        const r = await callWithFallback(opts);
        if (r.ok && (!opts.stream || r.body)) return { provider: "Gemini", kind: "gemini", res: r };
        lastStatus = r.status;
        lastDetail = await r.text().catch(() => "");
        console.error("[failover] Gemini falhou:", r.status, lastDetail.slice(0, 300));
      } catch (e) {
        lastDetail = e instanceof Error ? e.message : String(e);
        console.error("[failover] Gemini exception:", lastDetail);
      }

      for (const p of OAI_PROVIDERS) {
        const key = Deno.env.get(p.env);
        if (!key) continue;
        try {
          const r = await callOpenAICompatible(p.base, key, p.model, convo, opts.tools, {
            stream: opts.stream,
            temperature: userTemp,
          });
          if (r.ok && (!opts.stream || r.body)) return { provider: p.name, kind: "openai", res: r };
          lastStatus = r.status;
          lastDetail = await r.text().catch(() => "");
          console.error(`[failover] ${p.name} falhou:`, r.status, lastDetail.slice(0, 300));
        } catch (e) {
          lastDetail = e instanceof Error ? e.message : String(e);
          console.error(`[failover] ${p.name} exception:`, lastDetail);
        }
      }

      return { provider: null, status: lastStatus, detail: lastDetail };
    };

    const scheduleMemory = () => {
      if (!userId) return;
      const p = extractAndSaveMemories({ apiKey: GEMINI_API_KEY, admin, userId, convo: [...convo], existing: memories });
      try { (globalThis as any).EdgeRuntime?.waitUntil?.(p); } catch { /* noop */ }
    };

    // Sem ferramentas: streaming direto do provedor ativo, convertido para o SSE do frontend.
    if (tools.length === 0) {
      const chosen = await callChain({ stream: true });
      if (!chosen.provider) {
        const status = (chosen as any).status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const error = hasVisualInput
          ? "Nenhum provedor de IA disponível conseguiu analisar esta imagem. Tente novamente em instantes."
          : "Erro no serviço de IA";
        return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      scheduleMemory();
      const prelude =
        chosen.provider !== "Gemini"
          ? sseStep({ id: "provider", status: "done", label: `Respondido via ${chosen.provider} (fallback)` })
          : undefined;
      const body =
        chosen.kind === "gemini"
          ? geminiStreamToOpenAiSse(chosen.res.body!)
          : openAiStreamToSse(chosen.res.body!, prelude);
      return new Response(body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    /* ================= EXECUÇÃO EM SEGUNDO PLANO =================
       O loop do agente roda desacoplado da conexão HTTP: se o usuário
       fechar o app, o `EdgeRuntime.waitUntil` mantém o processamento vivo
       e o progresso/resultado é persistido em `background_tasks`.       */

    let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
    let clientOpen = true;
    const emit = (chunk: Uint8Array) => {
      if (!clientOpen || !ctrl) return;
      try { ctrl.enqueue(chunk); } catch { clientOpen = false; }
    };

    let taskId: string | null = null;
    const steps: any[] = [];

    const ensureTask = async () => {
      if (taskId || !userId) return;
      const { data, error } = await admin
        .from("background_tasks")
        .insert({
          user_id: userId,
          conversation_id: conversationId ?? null,
          status: "running",
          input: { agent: agent ?? null, prompt: String(messages?.[messages.length - 1]?.content ?? "").slice(0, 4000) },
        })
        .select("id")
        .single();
      if (error) { console.warn("[bg] insert falhou:", error.message); return; }
      taskId = data.id;
    };

    const patchTask = async (patch: Record<string, unknown>) => {
      if (!taskId) return;
      const { error } = await admin.from("background_tasks").update(patch).eq("id", taskId);
      if (error) console.warn("[bg] update falhou:", error.message);
    };

    const step = (s: { id: string; status: "running" | "done" | "error" | "waiting"; label: string; detail?: string; result?: unknown }) => {
      steps.push(s);
      emit(sseStep(s));
    };

    const runAgent = async () => {
      let finalContent = "";
      let finished = false;
      try {
        for (let i = 0; i < 5; i++) {
          const thinkId = `think_${i}`;
          step({ id: thinkId, status: "running", label: i === 0 ? "Pensando…" : "Analisando resultados…" });
          const chosen = await callChain({ tools });
          if (!chosen.provider) {
            const status = (chosen as any).status;
            const txt = String((chosen as any).detail ?? "");
            const label = status === 429
              ? "Limite de requisições excedido"
              : hasVisualInput
              ? "Nenhum provedor disponível conseguiu analisar a imagem"
              : `Erro no serviço de IA: ${status}`;
            step({ id: thinkId, status: "error", label, detail: txt.slice(0, 200) });
            finalContent = `\n\n⚠️ ${label} ${txt.slice(0, 200)}`;
            emit(sseChunk(finalContent));
            await patchTask({ status: "failed", result: { error: label, steps } });
            return;
          }
          if (chosen.provider !== "Gemini") {
            step({ id: `provider_${i}`, status: "done", label: `Respondido via ${chosen.provider} (fallback)` });
          }

          const data = await chosen.res.json();

          let text = "";
          let calls: any[] = [];

          if (chosen.kind === "gemini") {
            const parts = data.candidates?.[0]?.content?.parts;
            if (!parts) {
              step({ id: thinkId, status: "error", label: "Resposta vazia do modelo" });
              finalContent = "\n\n⚠️ Resposta vazia do modelo.";
              emit(sseChunk(finalContent));
              await patchTask({ status: "failed", result: { error: "Resposta vazia do modelo", steps } });
              return;
            }
            // Converte a resposta do Gemini de volta para o formato OpenAI usado no loop.
            text = parts.filter((p: any) => typeof p.text === "string").map((p: any) => p.text).join("");
            calls = parts.filter((p: any) => p.functionCall).map((p: any, idx: number) => ({
              id: `call_${i}_${idx}`,
              type: "function",
              thought_signature: p.thoughtSignature ?? p.thought_signature ?? null,
              function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
            }));
          } else {
            const message = data.choices?.[0]?.message;
            if (!message) {
              step({ id: thinkId, status: "error", label: "Resposta vazia do modelo" });
              finalContent = "\n\n⚠️ Resposta vazia do modelo.";
              emit(sseChunk(finalContent));
              await patchTask({ status: "failed", result: { error: "Resposta vazia do modelo", steps } });
              return;
            }
            text = typeof message.content === "string" ? message.content : "";
            calls = (message.tool_calls ?? []).map((tc: any, idx: number) => ({
              id: tc.id || `call_${i}_${idx}`,
              type: "function",
              function: {
                name: tc.function?.name,
                arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {}),
              },
            }));
          }

          step({ id: thinkId, status: "done", label: i === 0 ? "Raciocínio concluído" : "Resultados analisados" });

          const msg: any = { role: "assistant", content: text, ...(calls.length ? { tool_calls: calls } : {}) };
          convo.push(msg);

          if (msg.tool_calls?.length) {
            // Fluxo de agente: registra a tarefa para sobreviver à queda da conexão.
            await ensureTask();
            let awaitingConfirmation = false;

            const results = await Promise.all(
              msg.tool_calls.map(async (tc: any) => {
                let parsedArgs: any = {};
                try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }
                const name = tc.function.name;
                const label = toolLabel(name, parsedArgs);

                if (isIrreversible(name)) {
                  const key = actionKey(name, parsedArgs);
                  const decision = decisions[key];

                  if (decision === "cancelled") {
                    step({ id: tc.id, status: "error", label, detail: "Cancelado pelo usuário" });
                    return { tc, result: { cancelled: true, reason: "Ação cancelada pelo usuário. Não execute novamente; siga sem ela e comente brevemente." } };
                  }

                  if (decision !== "approved") {
                    awaitingConfirmation = true;
                    const human = actionLabel(name, parsedArgs);
                    step({ id: tc.id, status: "waiting", label: `Aguardando confirmação — ${label}`, detail: human });
                    emit(sseConfirm({ id: key, tool: name, args: parsedArgs, label: human }));
                    return { tc, result: { pending_user_confirmation: true, action: human } };
                  }
                }

                step({ id: tc.id, status: "running", label, detail: name });
                const result = await executeTool(name, parsedArgs, { admin, userId: userId!, tokens });
                const failed = result && typeof result === "object" && "error" in (result as any);
                step({
                  id: tc.id,
                  status: failed ? "error" : "done",
                  label,
                  detail: failed ? String((result as any).error).slice(0, 160) : name,
                  ...(name === "web_search" && !failed
                    ? {
                        result: {
                          sources: (Array.isArray((result as any)?.results) ? (result as any).results : [])
                            .map((source: any) => ({
                              title: String(source?.title || source?.url || "Fonte web").slice(0, 240),
                              url: typeof source?.url === "string" ? source.url : "",
                            }))
                            .filter((source: any) => source.url)
                            .slice(0, 10),
                        },
                      }
                    : {}),
                });
                return { tc, result };
              })
            );
            for (const { tc, result } of results) {
              convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
            }

            await patchTask({ result: { steps, partial: true } });

            // Pausa o turno: o usuário precisa confirmar as ações irreversíveis pendentes.
            if (awaitingConfirmation) {
              await patchTask({ status: "waiting_confirmation", result: { steps, awaiting_confirmation: true } });
              finished = true;
              return;
            }
            continue;
          }

          // Final text — stream as one chunk so the frontend renders it.
          // `convo` mantém o texto original (com <thinking>); só filtramos a exibição.
          step({ id: "final", status: "running", label: "Escrevendo resposta…" });
          finalContent = stripThinking(msg.content || "");
          if (finalContent) emit(sseChunk(finalContent));
          step({ id: "final", status: "done", label: "Resposta pronta" });
          finished = true;
          break;
        }

        if (!finished) {
          const error = "A tarefa era complexa demais e não foi concluída dentro do limite de passos — tente dividir o pedido em partes menores";
          step({ id: "iteration_limit", status: "error", label: "Limite de passos atingido", detail: error });
          finalContent = `\n\n⚠️ ${error}`;
          emit(sseChunk(finalContent));
          await patchTask({ status: "failed", result: { error, steps } });
          return;
        }

        if (taskId) {
          await patchTask({ status: "completed", result: { steps, content: finalContent } });
          // Se o cliente caiu no meio, persistimos a resposta na conversa
          // para que ela apareça quando o usuário reabrir o app.
          if (!clientOpen && conversationId && userId && finalContent) {
            await admin.from("messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              content: finalContent,
              agent: agent ?? null,
            });
          }
        }
        if (finished) scheduleMemory();
      } catch (e) {
        const m = e instanceof Error ? e.message : "Erro";
        emit(sseChunk(`\n\n⚠️ ${m}`));
        await patchTask({ status: "failed", result: { error: m, steps } });
      } finally {
        if (clientOpen && ctrl) {
          try { ctrl.enqueue(SSE_DONE); ctrl.close(); } catch { /* já fechado */ }
        }
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) { ctrl = controller; },
      cancel() { clientOpen = false; },
    });

    const runPromise = runAgent();
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(runPromise); } catch { /* noop */ }

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
