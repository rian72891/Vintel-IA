import { useState } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PLANS, PlanKey } from '@/lib/stripe';
import { Lightbulb, PenLine, Code2, BookOpen, Sparkles, Crown, Zap, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const suggestions = [
  { icon: Lightbulb, label: 'Explique computação quântica', color: 'text-yellow-500' },
  { icon: PenLine, label: 'Escreva um poema criativo', color: 'text-pink-500' },
  { icon: Code2, label: 'Ajude com código Python', color: 'text-emerald-500' },
  { icon: BookOpen, label: 'Resuma um artigo para mim', color: 'text-blue-500' },
];

export function AgentSelector() {
  const { createConversation } = useChatStore();
  const { plan: currentPlan, subscribed, subscriptionEnd } = useSubscription();
  const { session } = useAuth();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleSuggestion = async (text: string) => {
    await createConversation();
  };

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
    <div className="flex-1 flex flex-col items-center justify-start px-6 py-8 overflow-y-auto">
      <div className="max-w-lg w-full flex flex-col items-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="h-20 w-20 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-accent" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-2"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Olá! Como posso ajudar?
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-muted-foreground text-sm text-center mb-8 max-w-sm"
        >
          Sou seu assistente de IA. Posso ajudar com perguntas, análises, escrita criativa, código e muito mais.
        </motion.p>

        {/* Suggestion cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-2 gap-3 w-full"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s.label)}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border text-left hover:bg-muted/60 transition-colors"
            >
              <s.icon className={`h-5 w-5 shrink-0 mt-0.5 ${s.color}`} />
              <span className="text-sm text-muted-foreground leading-snug">{s.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Subscription Plans Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="w-full mt-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Planos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {planEntries.map(([key, plan]) => {
              const isCurrent = key === currentPlan;
              const isPro = key === 'pro';

              return (
                <div
                  key={key}
                  className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
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
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  </div>

                  <p className="text-xl font-bold text-foreground">{plan.price}</p>

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isPro && !subscribed && (
                    <Button
                      size="sm"
                      onClick={() => handleCheckout(plan.priceId!)}
                      disabled={loadingCheckout}
                      className="w-full mt-2"
                    >
                      {loadingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assinar Pro'}
                    </Button>
                  )}

                  {isPro && subscribed && isCurrent && (
                    <div className="space-y-2 mt-2">
                      {subscriptionEnd && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          Renova em {new Date(subscriptionEnd).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManage}
                        disabled={loadingPortal}
                        className="w-full"
                      >
                        {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerenciar assinatura'}
                      </Button>
                    </div>
                  )}

                  {!isPro && isCurrent && (
                    <p className="text-xs text-muted-foreground text-center mt-1">Plano atual</p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
