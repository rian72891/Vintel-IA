import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Github, Loader2, Play, ShieldAlert, Archive, FileText, GitPullRequest, ListChecks, Undo2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type ActionKey =
  | "audit_repos"
  | "create_org_plan_issues"
  | "open_standardization_prs"
  | "update_profile_readme"
  | "archive_repos"
  | "revert_recent";

interface ActionDef {
  key: ActionKey;
  title: string;
  desc: string;
  icon: any;
  needsRepos?: boolean;
  needsLicense?: boolean;
  togglePrivate?: boolean;
  destructive?: boolean;
  confirm?: string;
}

const ACTIONS: ActionDef[] = [
  { key: "audit_repos", title: "Auditar repositórios", desc: "Gera relatório do que falta em cada repo (README, LICENSE, CI, Dependabot, tópicos, candidatos a arquivar/unificar).", icon: ListChecks, togglePrivate: true },
  { key: "create_org_plan_issues", title: "Criar issues 'Plano de Organização'", desc: "Abre uma issue com checklist padrão em cada repo (label vintel-agent, reversível).", icon: FileText, togglePrivate: true, needsRepos: true },
  { key: "update_profile_readme", title: "Atualizar README do perfil", desc: "Recria seu README de perfil (@rian72891/rian72891) com índice A–Z e workflow diário.", icon: FileText },
  { key: "open_standardization_prs", title: "Abrir PRs de padronização", desc: "Cria branch e PR com README/LICENSE/.editorconfig/.gitignore/ESLint+Prettier/Actions/Dependabot/templates faltantes.", icon: GitPullRequest, togglePrivate: true, needsRepos: true, needsLicense: true },
  { key: "archive_repos", title: "Arquivar repositórios", desc: "Arquiva os repos que você listar (não deleta).", icon: Archive, needsRepos: true, destructive: true, confirm: "Isto vai ARQUIVAR os repositórios listados. Confirmar?" },
  { key: "revert_recent", title: "Reverter últimas 48h", desc: "Fecha issues/PRs criados pelo agente nas últimas 48h e remove branches temporárias.", icon: Undo2, destructive: true, confirm: "Fechar tudo que o agente criou nas últimas 48h?" },
];

export default function GithubAgent() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [open, setOpen] = useState<ActionDef | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [reposInput, setReposInput] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [license, setLicense] = useState<"MIT" | "Apache-2.0">("MIT");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("oauth_tokens")
      .select("access_token, scope")
      .eq("user_id", user.id)
      .eq("provider", "github")
      .maybeSingle()
      .then(({ data }) => setConnected(!!data?.access_token));
    supabase
      .from("user_connectors")
      .select("account_label")
      .eq("user_id", user.id)
      .eq("provider", "github")
      .maybeSingle()
      .then(({ data }) => setAccount(data?.account_label ?? null));
  }, [user]);

  async function execute(def: ActionDef) {
    if (def.confirm && !confirm(def.confirm)) return;
    setRunning(true);
    setResult(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Faça login");
      const repos = reposInput
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const params: any = {};
      if (def.togglePrivate) params.include_private = includePrivate;
      if (def.needsRepos && repos.length) params.repos = repos;
      if (def.needsLicense) params.license = license;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: def.key, params }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setResult(data.result);
      toast.success("Ação concluída");
    } catch (e: any) {
      toast.error(e.message);
      setResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Faça login para usar o Agente GitHub.</p>
          <Link to="/"><Button>Voltar</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Github className="h-5 w-5" />
        <h1 className="font-semibold">Agente GitHub</h1>
        <div className="ml-auto flex items-center gap-2">
          {connected === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : connected ? (
            <Badge variant="secondary" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {account ?? "Conectado"}
            </Badge>
          ) : (
            <Link to="/conectores"><Button size="sm">Conectar GitHub</Button></Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {connected === false && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="text-sm">
              GitHub não conectado. Vá em <Link to="/conectores" className="underline">/conectores</Link> e autorize com o escopo <code>repo workflow</code>.
            </div>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {ACTIONS.map((a) => (
            <Card key={a.key} className="p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => { setOpen(a); setResult(null); }}>
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${a.destructive ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{a.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Tudo criado pelo agente recebe a label <code>vintel-agent</code> e pode ser revertido em 48h pelo botão "Reverter".
        </p>
      </main>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><open.icon className="h-4 w-4" />{open.title}</DialogTitle>
                <DialogDescription>{open.desc}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {open.togglePrivate && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="priv">Incluir repositórios privados</Label>
                    <Switch id="priv" checked={includePrivate} onCheckedChange={setIncludePrivate} />
                  </div>
                )}

                {open.needsRepos && (
                  <div>
                    <Label className="text-xs">Filtrar repositórios (opcional — um por linha ou separados por vírgula)</Label>
                    <Textarea
                      placeholder={`Ex:\nSportfy\nReelcutter\nrian72891/meu-repo`}
                      value={reposInput}
                      onChange={(e) => setReposInput(e.target.value)}
                      rows={4}
                      className="mt-1.5 font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Em branco = todos os repositórios elegíveis.</p>
                  </div>
                )}

                {open.needsLicense && (
                  <div>
                    <Label className="text-xs">Licença</Label>
                    <div className="flex gap-2 mt-1.5">
                      {(["MIT", "Apache-2.0"] as const).map((l) => (
                        <Button key={l} type="button" size="sm" variant={license === l ? "default" : "outline"} onClick={() => setLicense(l)}>
                          {l}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {result && (
                  <div className="border border-border rounded-md">
                    <div className="px-3 py-2 border-b border-border text-xs font-medium flex items-center justify-between">
                      <span>Resultado</span>
                      <Badge variant={result.error ? "destructive" : "secondary"}>{result.error ? "erro" : "ok"}</Badge>
                    </div>
                    <ScrollArea className="h-72">
                      <ResultView data={result} />
                    </ScrollArea>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(null)}>Fechar</Button>
                <Button onClick={() => execute(open)} disabled={running || !connected} variant={open.destructive ? "destructive" : "default"}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Executar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResultView({ data }: { data: any }) {
  if (data?.error) return <pre className="p-3 text-xs text-red-400 whitespace-pre-wrap">{data.error}</pre>;

  // audit
  if (Array.isArray(data?.repos)) {
    return (
      <div className="p-3 space-y-2">
        <div className="text-xs text-muted-foreground mb-2">
          {data.total} repos · {data.duplicates?.length ?? 0} grupos de possíveis duplicatas
        </div>
        {data.duplicates?.length > 0 && (
          <Card className="p-2 text-xs">
            <div className="font-medium mb-1">Possíveis duplicatas:</div>
            {data.duplicates.map((g: string[], i: number) => (
              <div key={i} className="text-muted-foreground">• {g.join(", ")}</div>
            ))}
          </Card>
        )}
        {data.repos.map((r: any) => (
          <div key={r.full_name} className="border border-border rounded p-2 text-xs">
            <div className="flex items-center gap-2">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-mono hover:underline flex items-center gap-1">{r.full_name}<ExternalLink className="h-3 w-3" /></a>
              {r.archived && <Badge variant="outline" className="text-[10px]">arquivado</Badge>}
              {r.fork && <Badge variant="outline" className="text-[10px]">fork</Badge>}
              {r.language && <Badge variant="secondary" className="text-[10px]">{r.language}</Badge>}
            </div>
            {r.missing.length > 0 ? (
              <div className="mt-1 text-muted-foreground">Falta: {r.missing.join(", ")}</div>
            ) : (
              <div className="mt-1 text-emerald-500">Tudo OK ✓</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // generic list
  const lists = ["created", "skipped", "opened", "closed", "errors", "failed", "archived"] as const;
  if (lists.some((k) => Array.isArray((data as any)[k]))) {
    return (
      <div className="p-3 space-y-3 text-xs">
        {lists.map((k) =>
          Array.isArray((data as any)[k]) && (data as any)[k].length > 0 ? (
            <div key={k}>
              <div className="font-medium mb-1 capitalize">{k} ({(data as any)[k].length})</div>
              <div className="space-y-1">
                {(data as any)[k].map((item: any, i: number) => (
                  <div key={i} className="text-muted-foreground">
                    {typeof item === "string" ? item : (
                      <>
                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline text-foreground">{item.repo}#{item.number}</a> : <span className="text-foreground">{item.repo}</span>}
                        {item.reason && <span> — {item.reason}</span>}
                        {item.added && <div className="ml-2 text-[10px]">{item.added.join(", ")}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>
    );
  }

  return <pre className="p-3 text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}
