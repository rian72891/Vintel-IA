import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google Workspace',
  google_drive: 'Google Drive',
  gmail: 'Gmail',
  lovable: 'Lovable',
};

const BASE_REDIRECT = window.location.origin + '/auth/callback';

export default function OAuthCallback() {
  const { provider } = useParams<{ provider: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (loading || ranRef.current) return;
    ranRef.current = true;

    const code = params.get('code');
    const error = params.get('error');
    const label = PROVIDER_LABELS[provider || ''] || provider;

    if (error) {
      toast.error(`Falha ao conectar ${label}: ${error}`);
      navigate('/conectores');
      return;
    }
    if (!code || !provider) {
      toast.error('Código OAuth ausente.');
      navigate('/conectores');
      return;
    }
    if (!user) {
      toast.error('Você precisa estar logado para concluir a conexão.');
      navigate('/');
      return;
    }

    (async () => {
      try {
        const redirect_uri = `${BASE_REDIRECT}/${provider}`;
        const { data, error: fnErr } = await supabase.functions.invoke('oauth-callback', {
          body: { code, provider, redirect_uri },
        });
        if (fnErr || !data?.success) {
          throw new Error(fnErr?.message || data?.error || 'Falha na troca de tokens');
        }
        toast.success(`${label} conectado com sucesso!`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        toast.error(`Não foi possível conectar ${label}: ${msg}`);
      } finally {
        navigate('/conectores');
      }
    })();
  }, [provider, params, user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Concluindo conexão…</p>
      </div>
    </div>
  );
}
