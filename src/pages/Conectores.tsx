import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    <path d="M4.46 1.93l13.9-1.03c1.71-.14 2.15-.04 3.22.74l4.43 3.12c.73.54.98.69.98 1.27v17.16c0 1.07-.39 1.71-1.75 1.81l-16.13.98c-1.03.05-1.51-.1-2.05-.78L3.74 21.07c-.59-.78-.83-1.37-.83-2.05V3.6c0-.88.39-1.61 1.55-1.67z" fill="white" stroke="black" strokeWidth=".5" />
    <path d="M18.36.9l-13.9 1.03c-1.16.06-1.55.79-1.55 1.67v15.42c0 .68.24 1.27.83 2.05l3.32 4.13c.54.68 1.02.83 2.05.78l16.13-.98c1.36-.1 1.75-.74 1.75-1.81V6.03c0-.54-.21-.7-.83-1.16L21.59 1.64C20.52.86 20.08.76 18.36.9zM8.7 5.04c-1.31.09-1.6.1-2.35-.5L4.45 3.03c-.19-.19-.1-.43.39-.48L18.2 1.55c1.12-.1 1.69.29 2.13.63l2.29 1.66c.09.05.32.32.05.32L8.9 5.02l-.2.02zm-1.55 17.6V7.39c0-.69.21-1.01.84-1.06L24 5.36v15.05c0 .69-.1 1.27-1.01 1.32l-15.84.91zm15-13.96c.1.45 0 .91-.45.96l-.74.15v10.78c-.64.34-1.23.53-1.71.53-.78 0-.97-.24-1.55-.96l-4.75-7.45v7.21l1.51.34s0 .88-1.21.88l-3.36.2c-.1-.19 0-.69.34-.78l.88-.24V8.49l-1.23-.1c-.1-.45.15-1.11.83-1.16l3.61-.24 4.94 7.55V7.96l-1.27-.15c-.1-.55.29-.96.78-1.01L21.15 8.68z" />
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
    <path d="M.4 14.05A12 12 0 009.95 23.6L.4 14.05zM.04 10.5l13.46 13.46A12 12 0 0023.96 13.5L10.5.04A12 12 0 00.04 10.5zm.65-3.9L17.4 23.3A12 12 0 0023.31 17.4L6.6.7A12 12 0 00.7 6.6zM2.74 3.36L20.64 21.26A12 12 0 0023.36 17.4 12 12 0 006.6.64 12 12 0 002.74 3.36z" />
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
  { id: 'notion', name: 'Notion', description: 'Crie e busque páginas e bancos de dados.', color: '#000000', icon: <NotionIcon /> },
  { id: 'slack', name: 'Slack', description: 'Envie mensagens em canais e DMs.', color: '#4A154B', icon: <SlackIcon /> },
  { id: 'linear', name: 'Linear', description: 'Crie e acompanhe issues do produto.', color: '#5E6AD2', icon: <LinearIcon /> },
  { id: 'asana', name: 'Asana', description: 'Tarefas e projetos sincronizados com a IA.', color: '#F06A6A', icon: <AsanaIcon /> },
  { id: 'github', name: 'GitHub', description: 'Conecte seus repositórios e fluxos de código.', color: '#181717', icon: <GitHubIcon /> },
];

const BASE_REDIRECT = window.location.origin + '/auth/callback';

export default function Conectores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('user_connectors')
        .select('provider, status')
        .eq('user_id', user.id);
      if (data) {
        setConnected(new Set(data.filter(d => d.status === 'connected').map(d => d.provider)));
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  const handleConnect = async (p: Provider) => {
    if (!user) return;
    setBusy(p.id);
    try {
      const redirect_uri = `${BASE_REDIRECT}/${p.id}`;
      const { data, error } = await supabase.functions.invoke('oauth-init', {
        body: { provider: p.id, redirect_uri },
      });
      if (error || !data?.url) {
        throw new Error(error?.message || data?.error || 'Falha ao iniciar OAuth');
      }
      window.location.href = data.url as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast.error(msg);
      setBusy(null);
    }
  };

  const handleDisconnect = async (p: Provider) => {
    if (!user) return;
    setBusy(p.id);
    const { error } = await supabase
      .from('user_connectors')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', p.id);
    if (error) {
      toast.error('Erro ao desconectar.');
      setBusy(null);
      return;
    }
    setConnected(prev => {
      const n = new Set(prev);
      n.delete(p.id);
      return n;
    });
    toast.success(`${p.name} desconectado.`);
    setBusy(null);
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
            const isBusy = busy === p.id;
            return (
              <Card key={p.id} className="p-5 bg-card/60 border-border/60 flex flex-col gap-4 transition-colors hover:border-border">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.color}1A`, color: p.color }}>
                    {p.icon}
                  </div>
                  <Badge
                    variant={isConnected ? 'default' : 'secondary'}
                    className={isConnected ? 'bg-primary/15 text-primary hover:bg-primary/20 border-primary/20' : ''}
                  >
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                </div>

                {isConnected ? (
                  <Button variant="destructive" size="sm" className="mt-auto" onClick={() => handleDisconnect(p)} disabled={loading || isBusy}>
                    {isBusy ? 'Desconectando…' : 'Desconectar'}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="mt-auto" onClick={() => handleConnect(p)} disabled={loading || isBusy}>
                    {isBusy ? 'Abrindo…' : 'Conectar'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
