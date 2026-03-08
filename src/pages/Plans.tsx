import { useState } from 'react';
import { Check, Crown, Zap, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS, PlanKey } from '@/lib/stripe';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Plans() {
  const { session } = useAuth();
  const { plan: currentPlan, subscribed, subscriptionEnd, checkSubscription } = useSubscription();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async (priceId: string) => {
    if (!session) return;
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar checkout');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleManage = async () => {
    if (!session) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  const planEntries = Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Planos</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
          {planEntries.map(([key, plan]) => {
            const isCurrent = key === currentPlan;
            const isPro = key === 'pro';

            return (
              <div
                key={key}
                className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all ${
                  isPro
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-card'
                } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-4 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    Seu plano
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {isPro ? (
                    <Crown className="h-5 w-5 text-primary" />
                  ) : (
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
                </div>

                <p className="text-2xl font-bold text-foreground">{plan.price}</p>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isPro && !subscribed && (
                  <Button
                    onClick={() => handleCheckout(plan.priceId!)}
                    disabled={loadingCheckout}
                    className="w-full"
                  >
                    {loadingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assinar Pro'}
                  </Button>
                )}

                {isPro && subscribed && isCurrent && (
                  <div className="space-y-2">
                    {subscriptionEnd && (
                      <p className="text-xs text-muted-foreground text-center">
                        Renova em {new Date(subscriptionEnd).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleManage}
                      disabled={loadingPortal}
                      className="w-full"
                    >
                      {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerenciar assinatura'}
                    </Button>
                  </div>
                )}

                {!isPro && isCurrent && (
                  <p className="text-xs text-muted-foreground text-center">Plano atual</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
