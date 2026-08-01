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
    if (name === "linear_list_projects") {
      const tok = await t("linear");
      const r = await fetch("https://api.linear.app/graphql", {
        method: "POST", headers: { Authorization: tok, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ projects { nodes { id name description state } } }" }),
      });
      return await r.json();
    }
    if (name === "asana_list_projects") {
      const tok = await t("asana");
      const r = await fetch(`https://app.asana.com/api/1.0/projects?workspace=${args.workspace_id}&limit=50`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      return await r.json();
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
const SSE_DONE = new TextEncoder().encode("data: [DONE]\n\n");

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
        parts.push({ functionCall: { name: tc.function.name, args } });
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
  return await fetch(`${GEMINI_BASE}/${opts.model}:${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  });
}

/** Converte o SSE nativo do Gemini para o formato que o frontend espera. */
function geminiStreamToOpenAiSse(upstream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
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
              if (text) controller.enqueue(sseChunk(text));
            } catch { /* chunk parcial ignorado */ }
          }
        }
      } catch { /* fim inesperado */ }
      controller.enqueue(SSE_DONE);
      controller.close();
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, agent, temperature: userTemp } = await req.json();
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

    const convo: any[] = [
      { role: "system", content: systemPrompt + connectedNote },
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

    // Sem ferramentas: streaming direto da API do Gemini, convertido para o SSE do frontend.
    if (tools.length === 0) {
      const r = await callWithFallback({ stream: true });
      if (!r.ok || !r.body) {
        const txt = await r.text().catch(() => "");
        console.error("Gemini error:", r.status, txt.slice(0, 500));
        if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(geminiStreamToOpenAiSse(r.body), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Tool loop (non-streaming), then stream the final answer.
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < 5; i++) {
            const r = await callWithFallback({ tools });
            if (!r.ok) {
              const txt = await r.text();
              console.error("Gemini error:", r.status, txt.slice(0, 500));
              const label = r.status === 429 ? "Limite de requisições excedido" : `Erro no serviço de IA: ${r.status}`;
              controller.enqueue(sseChunk(`\n\n⚠️ ${label} ${txt.slice(0, 200)}`));
              break;
            }
            const data = await r.json();
            const parts = data.candidates?.[0]?.content?.parts;
            if (!parts) { controller.enqueue(sseChunk("\n\n⚠️ Resposta vazia do modelo.")); break; }

            // Converte a resposta do Gemini de volta para o formato OpenAI usado no loop.
            const text = parts.filter((p: any) => typeof p.text === "string").map((p: any) => p.text).join("");
            const calls = parts.filter((p: any) => p.functionCall).map((p: any, idx: number) => ({
              id: `call_${i}_${idx}`,
              type: "function",
              function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
            }));
            const msg: any = { role: "assistant", content: text, ...(calls.length ? { tool_calls: calls } : {}) };

            convo.push(msg);

            if (msg.tool_calls?.length) {
              const names = msg.tool_calls.map((tc: any) => `\`${tc.function.name}\``).join(", ");
              controller.enqueue(sseChunk(`\n\n🔧 *Executando ${msg.tool_calls.length} ferramenta(s) em paralelo: ${names}…*\n`));
              const results = await Promise.all(
                msg.tool_calls.map(async (tc: any) => {
                  let parsedArgs: any = {};
                  try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }
                  const result = await executeTool(tc.function.name, parsedArgs, { admin, userId: userId!, tokens });
                  return { tc, result };
                })
              );
              for (const { tc, result } of results) {
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
