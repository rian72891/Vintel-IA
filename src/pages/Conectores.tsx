import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plug, MoreVertical, RefreshCw, RotateCw, Unplug, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useConnectors } from '@/hooks/useConnectors';

type Provider = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: JSX.Element;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#4285F4">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.73 18.27.5 12 .5z" />
  </svg>
);
const NotionIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M4.46 1.93l13.9-1.03c1.71-.14 2.15-.04 3.22.74l4.43 3.12c.73.54.98.69.98 1.27v17.16c0 1.07-.39 1.71-1.75 1.81l-16.13.98c-1.03.05-1.51-.1-2.05-.78L3.74 21.07c-.59-.78-.83-1.37-.83-2.05V3.6c0-.88.39-1.61 1.55-1.67z" />
  </svg>
);
const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7">
    <path d="M5.04 15.16a2.52 2.52 0 11-2.52-2.52h2.52v2.52zm1.27 0a2.52 2.52 0 015.04 0v6.32a2.52 2.52 0 01-5.04 0v-6.32z" fill="#E01E5A" />
    <path d="M8.83 5.04a2.52 2.52 0 112.52-2.52v2.52H8.83zm0 1.27a2.52 2.52 0 010 5.04H2.52a2.52 2.52 0 010-5.04h6.31z" fill="#36C5F0" />
    <path d="M18.96 8.83a2.52 2.52 0 112.52 2.52h-2.52V8.83zm-1.27 0a2.52 2.52 0 01-5.04 0V2.52a2.52 2.52 0 015.04 0v6.31z" fill="#2EB67D" />
    <path d="M15.16 18.96a2.52 2.52 0 11-2.52 2.52v-2.52h2.52zm0-1.27a2.52 2.52 0 010-5.04h6.32a2.52 2.52 0 010 5.04h-6.32z" fill="#ECB22E" />
  </svg>
);
const LinearIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#5E6AD2">
    <path d="M.4 14.05A12 12 0 009.95 23.6L.4 14.05zM.04 10.5l13.46 13.46A12 12 0 0023.96 13.5L10.5.04A12 12 0 00.04 10.5z" />
  </svg>
);
const AsanaIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7">
    <circle cx="12" cy="17.5" r="4.5" fill="#F06A6A" />
    <circle cx="6.5" cy="8" r="4.5" fill="#F06A6A" />
    <circle cx="17.5" cy="8" r="4.5" fill="#F06A6A" />
  </svg>
);

const PROVIDERS: Provider[] = [
  { id: 'google', name: 'Google Workspace', description: 'Drive, Calendar, Sheets e Docs em uma só conexão.', color: '#4285F4', icon: <GoogleIcon /> },
  { id: 'notion', name: 'Notion', description: 'Crie e busque páginas e bancos de dados.', color: '#FFFFFF', icon: <NotionIcon /> },
  { id: 'slack', name: 'Slack', description: 'Envie mensagens em canais e DMs.', color: '#4A154B', icon: <SlackIcon /> },
  { id: 'linear', name: 'Linear', description: 'Crie e acompanhe issues do produto.', color: '#5E6AD2', icon: <LinearIcon /> },
  { id: 'asana', name: 'Asana', description: 'Tarefas e projetos sincronizados com a IA.', color: '#F06A6A', icon: <AsanaIcon /> },
  { id: 'github', name: 'GitHub', description: 'Conecte seus repositórios e fluxos de código.', color: '#FFFFFF', icon: <GitHubIcon /> },
];

const BASE_REDIRECT = window.location.origin + '/auth/callback';

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export default function Conectores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connected, records, loading } = useConnectors();
  const [busy, setBusy] = useState<string | null>(null);

  const startOAuth = async (p: Provider) => {
    if (!user) return;
    setBusy(p.id);
    try {
      const redirect_uri = `${BASE_REDIRECT}/${p.id}`;
      const { data, error } = await supabase.functions.invoke('oauth-init', {
        body: { provider: p.id, redirect_uri },
      });
      const payloadError = (data as { error?: string } | null)?.error;
      const rawMsg = error?.message || payloadError || '';
      const isPending = /não configurado|not configured|CLIENT_ID/i.test(rawMsg);
      if (isPending) {
        toast.message('Configuração pendente', {
          description: `Adicione as chaves de desenvolvedor do ${p.name} no backend.`,
        });
        setBusy(null);
        return;
      }
      if (error || !data?.url) throw new Error(rawMsg || 'Falha ao iniciar OAuth');
      window.location.href = data.url as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro desconhecido');
      setBusy(null);
    }
  };

  const handleDisconnect = async (p: Provider) => {
    if (!user) return;
    setBusy(p.id);
    const { error } = await supabase
      .from('user_connectors').delete()
      .eq('user_id', user.id).eq('provider', p.id);
    await supabase.from('oauth_tokens').delete()
      .eq('user_id', user.id).eq('provider', p.id);
    if (error) { toast.error('Erro ao desconectar.'); setBusy(null); return; }
    toast.success(`${p.name} desconectado.`);
    setBusy(null);
  };

  const handleTest = async (p: Provider) => {
    if (!user) return;
    setBusy(p.id);
    const tId = toast.loading(`Testando ${p.name}…`);
    try {
      const { data, error } = await supabase.functions.invoke('connector-test', {
        body: { provider: p.id },
      });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        toast.success(`${p.name} OK${data.label ? ` — ${data.label}` : ''}`, { id: tId });
      } else {
        toast.error(`${p.name}: ${data?.error ?? 'falhou'}`, { id: tId });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao testar', { id: tId });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Conectores</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {connected.size}/{PROVIDERS.length} conectados
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-16">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Conectores
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Integre suas ferramentas ao Vintel IA. A IA pode usar essas conexões automaticamente no chat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => {
            const isConnected = connected.has(p.id);
            const rec = records[p.id];
            const hasError = rec?.status === 'error';
            const isBusy = busy === p.id;

            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="relative p-5 bg-card/60 border-border/60 flex flex-col gap-4 transition-all hover:border-border hover:bg-card/80 overflow-hidden">
                  {isConnected && (
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` }}
                    />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${p.color}1A`, color: p.color }}
                    >
                      {p.icon}
                    </div>

                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <Badge className="bg-[hsl(142_72%_55%/0.12)] text-[hsl(142_72%_55%)] border border-[hsl(142_72%_55%/0.3)] hover:bg-[hsl(142_72%_55%/0.18)] gap-1.5">
                          <motion.span
                            className="h-1.5 w-1.5 rounded-full bg-[hsl(142_72%_55%)]"
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                            style={{ boxShadow: '0 0 6px hsl(142 72% 55%)' }}
                          />
                          Conectado
                        </Badge>
                      ) : hasError ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Erro
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Desconectado</Badge>
                      )}

                      {isConnected && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isBusy}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleTest(p)}>
                              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Testar conexão
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startOAuth(p)}>
                              <RotateCw className="h-3.5 w-3.5 mr-2" /> Reconectar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDisconnect(p)}
                            >
                              <Unplug className="h-3.5 w-3.5 mr-2" /> Desconectar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>

                  {isConnected && (
                    <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border/40 pt-3">
                      {rec?.account_label && (
                        <div className="flex items-center gap-1.5 text-foreground/80">
                          <CheckCircle2 className="h-3 w-3 text-[hsl(142_72%_55%)]" />
                          <span className="truncate">{rec.account_label}</span>
                        </div>
                      )}
                      <div>Última sincronização: {timeAgo(rec?.last_synced_at ?? null)}</div>
                    </div>
                  )}

                  {hasError && rec?.last_error && (
                    <p className="text-[11px] text-destructive/90 border-t border-destructive/20 pt-3">
                      {rec.last_error}
                    </p>
                  )}

                  {!isConnected && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-auto"
                      onClick={() => startOAuth(p)}
                      disabled={loading || isBusy}
                    >
                      {isBusy ? 'Abrindo…' : hasError ? 'Reconectar' : 'Conectar'}
                    </Button>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
