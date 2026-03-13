import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Crown, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsage } from '@/hooks/useUsage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
}

export function UpgradeModal({ open, onOpenChange, feature }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { checkSubscription } = useSubscription();
  const { refreshUsage } = useUsage();
  const [syncing, setSyncing] = useState(false);

  const handleSyncAccess = async () => {
    if (!user) return;

    setSyncing(true);
    try {
      // First try the sync-subscription edge function
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-subscription', {
        body: { user_id: user.id, email: user.email },
      });

      if (syncError) {
        console.error('Sync function error:', syncError);
      }

      if (syncData?.success && syncData?.plan && syncData.plan !== 'free') {
        await checkSubscription();
        await refreshUsage();
        toast.success(`Plano ${syncData.plan} ativado! Acesso liberado.`);
        onOpenChange(false);
        return;
      }

      // Fallback: direct DB check
      await checkSubscription();
      await refreshUsage();

      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        toast.success('Pagamento confirmado. Acesso liberado!');
        onOpenChange(false);
      } else {
        toast.info('Pagamento ainda não foi processado. Aguarde até 2 minutos e tente novamente.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar assinatura';
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Limite atingido
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Você atingiu o limite de <span className="font-semibold text-foreground">{feature}</span> do seu plano atual.
          </p>
          <p className="text-sm text-muted-foreground">
            Faça upgrade para continuar usando sem limites.
          </p>

          <div className="space-y-2">
            <Button onClick={handleSyncAccess} variant="outline" className="w-full" disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Já paguei, sincronizar acesso'}
            </Button>

            <Button
              onClick={() => {
                onOpenChange(false);
                navigate('/precos');
              }}
              className="w-full gap-2"
            >
              <Crown className="h-4 w-4" />
              Ver planos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

