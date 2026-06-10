# Agente GitHub no Vintel IA

Implementa um agente real que usa o token OAuth do GitHub já armazenado em `oauth_tokens` para auditar repositórios e executar ações (issues/PRs) sob comando.

## Escopo

1. **Edge Function `github-agent`** (Deno) — recebe `{ action, params }`, autentica usando o `access_token` do usuário em `oauth_tokens` (provider=`github`), chama a GitHub REST API.

   Ações suportadas:
   - `audit_repos` — lista repos públicos do usuário e retorna relatório (README, LICENSE, .editorconfig, .gitignore, ESLint, Actions, Dependabot, descrição, tópicos, candidatos a arquivar/unificar).
   - `create_org_plan_issues` — cria issue "Plano de Organização" em todos (ou subset) dos repos com checklist padrão.
   - `update_profile_readme` — atualiza `rian72891/rian72891` README com índice A–Z + workflow diário (commit direto na branch default).
   - `open_standardization_prs` — cria branch `chore/standardize`, adiciona arquivos faltantes (README/LICENSE MIT/.editorconfig/.gitignore/ESLint+Prettier/Actions/Dependabot/templates) e abre PR.
   - `archive_repos` — arquiva repos listados (após confirmação).
   - `revert_recent` — fecha issues/PRs abertos pelo agente nas últimas 48h com comentário "reversão solicitada pelo usuário" e remove branches `chore/standardize` criadas por automação.

   Cada ação aceita `filters`: `repos[]`, `include_private`, `license` (`MIT`|`Apache-2.0`|...). Marca tudo criado pelo agente com label `vintel-agent` (cria a label se não existir) para rastreio de reversão.

2. **Página `/github-agent`** — UI com:
   - Status de conexão (lê `oauth_tokens` provider=github; botão "Conectar" se ausente, leva a `/conectores`).
   - Lista de comandos como cards/botões: Auditar, Criar Issues de Plano, Atualizar README do perfil, Abrir PRs de padronização, Arquivar, Reverter últimas 48h.
   - Cada card abre um drawer com opções (subset de repos, licença, incluir privados) e botão "Executar".
   - Painel de resultado streaming/log + relatórios em markdown renderizado.
   - Histórico salvo em nova tabela `github_agent_runs` (id, user_id, action, params, result jsonb, created_at) com RLS por user_id.

3. **Integração no chat** — comando `/github <ação>` no `ChatInput` despacha para a mesma edge function e renderiza o resultado no chat (sem mudar o agente atual).

4. **Migração SQL** — cria `github_agent_runs` com RLS + GRANTs e label/index.

## Detalhes técnicos

- Endpoint: `supabase/functions/github-agent/index.ts`, `verify_jwt = false` (lemos JWT manualmente, padrão do projeto).
- GitHub API base: `https://api.github.com`, header `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
- Templates dos arquivos de padronização ficam em `supabase/functions/github-agent/templates.ts`.
- Paginação: percorre `/user/repos?per_page=100&type=owner` até esgotar.
- Auditoria checa existência de arquivos via `GET /repos/{o}/{r}/contents/{path}` (404 = ausente).
- PRs: cria blob/tree/commit/ref via Git Data API (não pisa em arquivos existentes — só adiciona).
- Reversão: lista issues/PRs com label `vintel-agent` e `created_at > now-48h`, fecha e comenta; deleta refs `heads/chore/standardize` em repos onde o último commit dela é do agente.
- UI usa AI Elements? Não — é painel de operações, não chat. Reusa `Card`/`Button`/`Dialog`/`Drawer` do shadcn já instalados.

## Fora de escopo

- Não implementa OAuth do Google (pausado pelo usuário).
- Não toca em repos privados a menos que `include_private=true`.
- Não faz force-push nem reescreve arquivos existentes em PRs.

## Pergunta antes de codar

O token OAuth do GitHub atual tem escopo `repo read:user`. Para criar PRs em repos privados e mexer em workflows do GitHub Actions, idealmente precisaria de `workflow` também. Posso:

(a) seguir com o escopo atual (issues + PRs em repos públicos funcionam, mas adicionar `.github/workflows/*.yml` via PR pode falhar em alguns casos), ou
(b) atualizar `oauth-init` para pedir `repo workflow read:user` e você reconecta o GitHub uma vez.

Se não responder, sigo com **(b)** por ser o caminho que faz tudo do seu pedido funcionar.
