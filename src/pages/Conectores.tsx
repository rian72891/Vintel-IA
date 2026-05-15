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

const GoogleDriveIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#4285F4">
    <path d="M7.71 3.5l-7.71 13.5 4.29 0 7.71-13.5zM12 3.5l4.29 7.5h-8.58zM16.29 17l-4.29-7.5h-7.71l4.29 7.5zM24 17l-7.71-13.5h-3.86l7.71 13.5z" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.73 18.27.5 12 .5z" />
  </svg>
);

const GmailIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#EA4335">
    <path d="M22 6.27v11.46c0 .73-.59 1.32-1.32 1.32H18V9.5l-6 4.5-6-4.5V19H3.32C2.59 19 2 18.41 2 17.68V6.27c0-.83.94-1.31 1.61-.81L12 11.75l8.39-6.29c.67-.5 1.61-.02 1.61.81z" />
  </svg>
);

const PROVIDERS: Provider[] = [
  { id: 'google_drive', name: 'Google Drive', description: 'Acesse e organize seus arquivos na nuvem.', color: '#4285F4', icon: <GoogleDriveIcon /> },
  { id: 'github', name: 'GitHub', description: 'Conecte seus repositórios e fluxos de código.', color: '#181717', icon: <GitHubIcon /> },
  { id: 'gmail', name: 'Gmail', description: 'Integre suas mensagens e contatos.', color: '#EA4335', icon: <GmailIcon /> },
];

export default function Conectores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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

    if (p.id === 'github') {
      try {
        const redirect_uri = `${window.location.origin}/auth/callback/github`;
        const { data, error } = await supabase.functions.invoke('oauth-init', {
          body: { provider: 'github', redirect_uri },
        });
        if (error || !data?.url) throw new Error(error?.message || data?.error || 'Falha ao iniciar OAuth');
        window.location.href = data.url as string;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        toast.error(`Não foi possível iniciar GitHub OAuth: ${msg}`);
      }
      return;
    }

    toast(`Em breve! A integração com ${p.name} está sendo configurada.`);
  };

  const handleDisconnect = async (p: Provider) => {
    if (!user) return;
    const { error } = await supabase
      .from('user_connectors')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', p.id);
    if (error) {
      toast.error('Erro ao desconectar.');
      return;
    }
    setConnected(prev => {
      const n = new Set(prev);
      n.delete(p.id);
      return n;
    });
    toast.success(`${p.name} desconectado.`);
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
            Integre suas ferramentas ao Vintel IA
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => {
            const isConnected = connected.has(p.id);
            return (
              <Card
                key={p.id}
                className="p-5 bg-card/60 border-border/60 flex flex-col gap-4 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${p.color}1A`, color: p.color }}
                  >
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
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-auto"
                    onClick={() => handleDisconnect(p)}
                    disabled={loading}
                  >
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-auto"
                    onClick={() => handleConnect(p)}
                    disabled={loading}
                  >
                    Conectar
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
