import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Sparkles, MessageCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsage } from '@/hooks/useUsage';

export default function Obrigado() {
  const navigate = useNavigate();
  const { plan, checkSubscription } = useSubscription();
  const { refreshUsage } = useUsage();
  const [syncing, setSyncing] = useState(true);
  const [step, setStep] = useState(0);

  const steps = [
    'Confirmando pagamento...',
    'Ativando recursos do plano...',
    'Pronto! Acesso liberado.',
  ];

  const syncAccess = useCallback(async () => {
    await checkSubscription();
    await refreshUsage();
  }, [checkSubscription, refreshUsage]);

  useEffect(() => {
    // Poll until subscription is detected
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes

    const poll = setInterval(async () => {
      attempts++;
      await syncAccess();
      
      if (attempts <= 3) setStep(0);
      else if (attempts <= 6) setStep(1);
      
      if (plan !== 'free' || attempts >= maxAttempts) {
        clearInterval(poll);
        setStep(2);
        setSyncing(false);
      }
    }, 5000);

    // Initial check
    syncAccess();

    return () => clearInterval(poll);
  }, [syncAccess, plan]);

  const isPlanActive = plan !== 'free';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          {syncing ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          )}
        </div>

        <h1 className="text-2xl font-extrabold text-foreground mb-2">
          {isPlanActive ? 'Bem-vindo ao Vintel IA! 🎉' : 'Processando pagamento...'}
        </h1>

        {/* Progress steps */}
        <div className="space-y-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 justify-center">
              {i < step ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : i === step && syncing ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border" />
              )}
              <span className={`text-sm ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {isPlanActive && (
          <>
            <p className="text-muted-foreground mb-6">
              Plano <span className="font-semibold text-primary capitalize">{plan}</span> ativado. Todos os recursos estão liberados!
            </p>

            <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-left space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Dica: comece assim
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Digite <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/imagine</code> para gerar imagens com IA</li>
                <li>• Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/pdf</code> para criar documentos profissionais</li>
                <li>• Envie uma imagem para análise inteligente</li>
                <li>• Converse naturalmente sobre qualquer assunto</li>
              </ul>
            </div>
          </>
        )}

        {!isPlanActive && !syncing && (
          <p className="text-sm text-muted-foreground mb-6">
            Não detectamos o pagamento ainda. Se você acabou de pagar, aguarde alguns segundos — a ativação pode levar até 2 minutos.
          </p>
        )}

        <Button onClick={() => navigate('/')} className="w-full gap-2" size="lg">
          <MessageCircle className="h-4 w-4" />
          {isPlanActive ? 'Acessar Dashboard' : 'Voltar ao Chat'}
        </Button>

        <p className="text-[10px] text-muted-foreground mt-4">
          Precisa de ajuda? <a href="mailto:suporte@vintel.ia" className="text-primary hover:underline">suporte@vintel.ia</a>
        </p>
      </motion.div>
    </div>
  );
}
