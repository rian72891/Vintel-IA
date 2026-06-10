// Vintel IA — Agente GitHub
// Executa ações reais nos repositórios do usuário usando o OAuth do GitHub
// armazenado em `oauth_tokens`. Marca tudo criado com a label `vintel-agent`
// para permitir reversão posterior.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DEPENDABOT,
  EDITORCONFIG,
  ESLINT_CONFIG,
  GH_ACTIONS_CI,
  GITIGNORE,
  ISSUE_TEMPLATE_BUG,
  LICENSE_APACHE2,
  LICENSE_MIT,
  PLAN_ISSUE_TITLE,
  PRETTIER_CONFIG,
  PR_TEMPLATE,
  README_TEMPLATE,
  planIssueBody,
  profileReadme,
} from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GH = "https://api.github.com";
const AGENT_LABEL = "vintel-agent";
const AGENT_BRANCH = "chore/vintel-standardize";

type Repo = {
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  description: string | null;
  topics?: string[];
  html_url: string;
  language: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${GH}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vintel-ia-agent",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function ghJson<T = any>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await gh(token, path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function listAllRepos(token: string, includePrivate: boolean): Promise<Repo[]> {
  const out: Repo[] = [];
  let page = 1;
  while (true) {
    const data = await ghJson<Repo[]>(
      token,
      `/user/repos?per_page=100&page=${page}&affiliation=owner&sort=updated`,
    );
    if (!data.length) break;
    for (const r of data) {
      if (!includePrivate && r.private) continue;
      out.push(r);
    }
    if (data.length < 100) break;
    page++;
  }
  // topics
  for (const r of out) {
    try {
      const t = await ghJson<{ names: string[] }>(
        token,
        `/repos/${r.full_name}/topics`,
        { headers: { Accept: "application/vnd.github.mercy-preview+json" } },
      );
      r.topics = t.names;
    } catch { r.topics = []; }
  }
  return out;
}

async function fileExists(token: string, full: string, path: string, ref: string) {
  const res = await gh(token, `/repos/${full}/contents/${encodeURIComponent(path)}?ref=${ref}`);
  return res.status === 200;
}

async function getMe(token: string) {
  return await ghJson<{ login: string; name: string | null }>(token, "/user");
}

// ---------- ACTIONS ----------

async function auditRepos(token: string, params: any) {
  const includePrivate = !!params?.include_private;
  const repos = await listAllRepos(token, includePrivate);
  const report: any[] = [];
  for (const r of repos) {
    const ref = r.default_branch;
    const [readme, license, editor, gitignore, eslint, actions, dependabot] = await Promise.all([
      fileExists(token, r.full_name, "README.md", ref),
      fileExists(token, r.full_name, "LICENSE", ref),
      fileExists(token, r.full_name, ".editorconfig", ref),
      fileExists(token, r.full_name, ".gitignore", ref),
      fileExists(token, r.full_name, "eslint.config.js", ref).then(
        async (e) => e || await fileExists(token, r.full_name, ".eslintrc.json", ref) || await fileExists(token, r.full_name, ".eslintrc.cjs", ref),
      ),
      fileExists(token, r.full_name, ".github/workflows/ci.yml", ref).then(
        async (e) => e || await fileExists(token, r.full_name, ".github/workflows/test.yml", ref) || await fileExists(token, r.full_name, ".github/workflows/build.yml", ref),
      ),
      fileExists(token, r.full_name, ".github/dependabot.yml", ref),
    ]);

    report.push({
      name: r.name,
      full_name: r.full_name,
      url: r.html_url,
      archived: r.archived,
      fork: r.fork,
      language: r.language,
      description: r.description,
      topics: r.topics ?? [],
      has: { readme, license, editor, gitignore, eslint, actions, dependabot },
      missing: [
        !readme && "README.md",
        !license && "LICENSE",
        !editor && ".editorconfig",
        !gitignore && ".gitignore",
        !eslint && "ESLint",
        !actions && "GitHub Actions",
        !dependabot && "Dependabot",
        !r.description && "descrição",
        (!r.topics || r.topics.length === 0) && "tópicos",
      ].filter(Boolean),
    });
  }

  // duplicate suspicion (prefix match)
  const groups = new Map<string, string[]>();
  for (const r of report) {
    const key = r.name.toLowerCase().replace(/[-_\d]+/g, "").slice(0, 6);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r.name);
  }
  const duplicates = [...groups.values()].filter((g) => g.length > 1);

  return { total: report.length, duplicates, repos: report };
}

async function ensureLabel(token: string, full: string) {
  const res = await gh(token, `/repos/${full}/labels/${AGENT_LABEL}`);
  if (res.status === 200) return;
  await gh(token, `/repos/${full}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: AGENT_LABEL,
      color: "5B7CFA",
      description: "Criado pelo Vintel IA · Agente GitHub",
    }),
  });
}

async function createOrgPlanIssues(token: string, params: any) {
  const includePrivate = !!params?.include_private;
  const only: string[] | undefined = params?.repos;
  const repos = await listAllRepos(token, includePrivate);
  const filtered = only?.length ? repos.filter((r) => only.includes(r.name) || only.includes(r.full_name)) : repos;

  const created: any[] = [];
  const skipped: any[] = [];
  for (const r of filtered) {
    if (r.archived) { skipped.push({ repo: r.full_name, reason: "archived" }); continue; }
    // skip if open issue with same title already exists
    const search = await ghJson<{ items: any[] }>(
      token,
      `/search/issues?q=${encodeURIComponent(`repo:${r.full_name} is:issue is:open in:title "${PLAN_ISSUE_TITLE}"`)}`,
    ).catch(() => ({ items: [] }));
    if (search.items.length) { skipped.push({ repo: r.full_name, reason: "already exists", url: search.items[0].html_url }); continue; }

    try {
      await ensureLabel(token, r.full_name);
      const issue = await ghJson<{ html_url: string; number: number }>(
        token,
        `/repos/${r.full_name}/issues`,
        {
          method: "POST",
          body: JSON.stringify({
            title: PLAN_ISSUE_TITLE,
            body: planIssueBody(r.full_name),
            labels: [AGENT_LABEL],
          }),
        },
      );
      created.push({ repo: r.full_name, url: issue.html_url, number: issue.number });
    } catch (e) {
      skipped.push({ repo: r.full_name, reason: (e as Error).message });
    }
  }
  return { created, skipped, totalScanned: filtered.length };
}

// Git data API helpers
async function getRef(token: string, full: string, branch: string) {
  return await ghJson<{ object: { sha: string } }>(token, `/repos/${full}/git/refs/heads/${branch}`);
}
async function getCommit(token: string, full: string, sha: string) {
  return await ghJson<{ tree: { sha: string } }>(token, `/repos/${full}/git/commits/${sha}`);
}
async function createBlob(token: string, full: string, content: string) {
  return await ghJson<{ sha: string }>(token, `/repos/${full}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: btoa(unescape(encodeURIComponent(content))), encoding: "base64" }),
  });
}
async function createTree(token: string, full: string, baseTree: string, entries: Array<{ path: string; sha: string }>) {
  return await ghJson<{ sha: string }>(token, `/repos/${full}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: entries.map((e) => ({ path: e.path, mode: "100644", type: "blob", sha: e.sha })),
    }),
  });
}
async function createCommit(token: string, full: string, message: string, treeSha: string, parentSha: string) {
  return await ghJson<{ sha: string }>(token, `/repos/${full}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
}
async function createBranchRef(token: string, full: string, branch: string, sha: string) {
  return await ghJson(token, `/repos/${full}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
}

async function openStandardizationPRs(token: string, params: any) {
  const includePrivate = !!params?.include_private;
  const only: string[] | undefined = params?.repos;
  const license = (params?.license ?? "MIT") as "MIT" | "Apache-2.0";
  const me = await getMe(token);
  const repos = await listAllRepos(token, includePrivate);
  const filtered = only?.length ? repos.filter((r) => only.includes(r.name) || only.includes(r.full_name)) : repos;

  const opened: any[] = [];
  const skipped: any[] = [];

  for (const r of filtered) {
    if (r.archived || r.fork) { skipped.push({ repo: r.full_name, reason: r.archived ? "archived" : "fork" }); continue; }
    try {
      const ref = r.default_branch;
      const isJsTs = ["JavaScript", "TypeScript"].includes(r.language ?? "");

      const candidates: Record<string, string> = {
        "README.md": README_TEMPLATE(r.name),
        "LICENSE": license === "Apache-2.0"
          ? LICENSE_APACHE2(new Date().getFullYear(), me.name ?? me.login)
          : LICENSE_MIT(new Date().getFullYear(), me.name ?? me.login),
        ".editorconfig": EDITORCONFIG,
        ".gitignore": GITIGNORE,
        ".github/workflows/ci.yml": GH_ACTIONS_CI,
        ".github/dependabot.yml": DEPENDABOT,
        ".github/ISSUE_TEMPLATE/bug_report.md": ISSUE_TEMPLATE_BUG,
        ".github/PULL_REQUEST_TEMPLATE.md": PR_TEMPLATE,
      };
      if (isJsTs) {
        candidates["eslint.config.js"] = ESLINT_CONFIG;
        candidates[".prettierrc.json"] = PRETTIER_CONFIG;
      }

      // keep only files that don't exist (don't overwrite)
      const toAdd: Array<{ path: string; content: string }> = [];
      for (const [path, content] of Object.entries(candidates)) {
        if (!(await fileExists(token, r.full_name, path, ref))) {
          toAdd.push({ path, content });
        }
      }
      if (!toAdd.length) { skipped.push({ repo: r.full_name, reason: "nada faltando" }); continue; }

      // create branch
      const baseRef = await getRef(token, r.full_name, ref);
      const baseCommit = await getCommit(token, r.full_name, baseRef.object.sha);

      const branchName = `${AGENT_BRANCH}-${Date.now().toString(36)}`;
      await createBranchRef(token, r.full_name, branchName, baseRef.object.sha);

      const blobs = await Promise.all(toAdd.map((f) => createBlob(token, r.full_name, f.content)));
      const tree = await createTree(token, r.full_name, baseCommit.tree.sha, toAdd.map((f, i) => ({ path: f.path, sha: blobs[i].sha })));
      const commit = await createCommit(
        token, r.full_name,
        `chore: padronização (Vintel IA Agente)\n\nAdiciona: ${toAdd.map((f) => f.path).join(", ")}`,
        tree.sha, baseRef.object.sha,
      );
      await ghJson(token, `/repos/${r.full_name}/git/refs/heads/${branchName}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });

      await ensureLabel(token, r.full_name);
      const pr = await ghJson<{ html_url: string; number: number }>(
        token,
        `/repos/${r.full_name}/pulls`,
        {
          method: "POST",
          body: JSON.stringify({
            title: "chore: padronização do repositório (Vintel IA Agente)",
            head: branchName,
            base: ref,
            body: `Este PR adiciona arquivos de padronização ausentes:\n\n${toAdd.map((f) => `- \`${f.path}\``).join("\n")}\n\n_Aberto automaticamente pelo **Vintel IA · Agente GitHub**. Reversível em 48h._`,
            maintainer_can_modify: true,
          }),
        },
      );
      // attach label
      await gh(token, `/repos/${r.full_name}/issues/${pr.number}/labels`, {
        method: "POST",
        body: JSON.stringify({ labels: [AGENT_LABEL] }),
      });

      opened.push({ repo: r.full_name, url: pr.html_url, number: pr.number, added: toAdd.map((f) => f.path) });
    } catch (e) {
      skipped.push({ repo: r.full_name, reason: (e as Error).message });
    }
  }
  return { opened, skipped, totalScanned: filtered.length };
}

async function updateProfileReadme(token: string, params: any) {
  const me = await getMe(token);
  const includePrivate = false;
  const repos = await listAllRepos(token, includePrivate);
  const visible = repos.filter((r) => !r.fork && !r.archived && r.name !== me.login);
  const content = profileReadme({
    username: me.login,
    repos: visible.map((r) => ({ name: r.name, description: r.description, html_url: r.html_url })),
  });

  const full = `${me.login}/${me.login}`;
  // ensure profile repo exists
  const repoCheck = await gh(token, `/repos/${full}`);
  if (repoCheck.status === 404) {
    await gh(token, `/user/repos`, {
      method: "POST",
      body: JSON.stringify({ name: me.login, private: false, auto_init: true, description: "Perfil mantido pelo Vintel IA" }),
    });
  }
  // fetch current sha if exists
  let sha: string | undefined;
  const cur = await gh(token, `/repos/${full}/contents/README.md`);
  if (cur.status === 200) {
    const d = await cur.json();
    sha = d.sha;
  }
  const res = await ghJson<{ commit: { html_url: string } }>(token, `/repos/${full}/contents/README.md`, {
    method: "PUT",
    body: JSON.stringify({
      message: "docs: atualização do README pelo Vintel IA",
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });
  return { repo: full, commit: res.commit.html_url, repos: visible.length };
}

async function archiveRepos(token: string, params: any) {
  const names: string[] = params?.repos ?? [];
  if (!names.length) throw new Error("Lista de repos vazia");
  const me = await getMe(token);
  const done: any[] = [];
  const failed: any[] = [];
  for (const n of names) {
    const full = n.includes("/") ? n : `${me.login}/${n}`;
    try {
      await ghJson(token, `/repos/${full}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      done.push(full);
    } catch (e) {
      failed.push({ repo: full, reason: (e as Error).message });
    }
  }
  return { archived: done, failed };
}

async function revertRecent(token: string, params: any) {
  const me = await getMe(token);
  const sinceMs = Date.now() - 48 * 60 * 60 * 1000;
  // search issues/PRs the agent created (by label)
  const q = `author:${me.login} label:${AGENT_LABEL} updated:>${new Date(sinceMs).toISOString().slice(0, 10)}`;
  const search = await ghJson<{ items: any[] }>(token, `/search/issues?q=${encodeURIComponent(q)}&per_page=100`);
  const closed: any[] = [];
  const errors: any[] = [];
  for (const it of search.items) {
    const repo = it.repository_url.split("/repos/")[1];
    try {
      await gh(token, `/repos/${repo}/issues/${it.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: "Reversão solicitada pelo usuário (Vintel IA)." }),
      });
      await ghJson(token, `/repos/${repo}/issues/${it.number}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      // if PR, also delete the head branch
      if (it.pull_request) {
        const pr = await ghJson<{ head: { ref: string } }>(token, `/repos/${repo}/pulls/${it.number}`);
        if (pr.head.ref.startsWith(AGENT_BRANCH)) {
          await gh(token, `/repos/${repo}/git/refs/heads/${pr.head.ref}`, { method: "DELETE" });
        }
      }
      closed.push({ repo, number: it.number, type: it.pull_request ? "pr" : "issue", url: it.html_url });
    } catch (e) {
      errors.push({ repo, number: it.number, reason: (e as Error).message });
    }
  }
  return { closed, errors };
}

// ---------- HANDLER ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claims, error: cerr } = await supabase.auth.getClaims(jwt);
    if (cerr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokenRow } = await admin
      .from("oauth_tokens")
      .select("access_token, scope")
      .eq("user_id", userId).eq("provider", "github").maybeSingle();
    if (!tokenRow?.access_token) {
      return json({ error: "GitHub não conectado. Vá em /conectores e conecte o GitHub." }, 400);
    }
    const token = tokenRow.access_token as string;

    const { action, params = {} } = await req.json().catch(() => ({}));
    if (!action) return json({ error: "Missing action" }, 400);

    let result: unknown;
    let status: "success" | "error" = "success";
    try {
      switch (action) {
        case "audit_repos":           result = await auditRepos(token, params); break;
        case "create_org_plan_issues":result = await createOrgPlanIssues(token, params); break;
        case "open_standardization_prs": result = await openStandardizationPRs(token, params); break;
        case "update_profile_readme": result = await updateProfileReadme(token, params); break;
        case "archive_repos":         result = await archiveRepos(token, params); break;
        case "revert_recent":         result = await revertRecent(token, params); break;
        default: return json({ error: `Ação desconhecida: ${action}` }, 400);
      }
    } catch (e) {
      status = "error";
      result = { error: (e as Error).message };
    }

    await admin.from("github_agent_runs").insert({
      user_id: userId, action, params, result: result as any, status,
    });

    return json({ ok: status === "success", action, result }, status === "success" ? 200 : 500);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
