import { motion } from 'framer-motion';
import { ArrowLeft, Crown, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useUsage } from '@/hooks/useUsage';
import { PLANS } from '@/lib/plans';
import { UsageBar } from '@/components/subscription/UsageBar';
import { GumroadCheckout } from '@/components/subscription/GumroadCheckout';

export default function Upgrade() {
  const navigate = useNavigate();
  const { plan, usage, checkUsage } = useUsage();
  const currentPlan = PLANS[plan];

  const messagesCheck = checkUsage('messages');
  const imagesCheck = checkUsage('images');
  const filesCheck = checkUsage('files');
  const audioCheck = checkUsage('audio');

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Fazer Upgrade</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-extrabold text-foreground mb-2">
              Desbloqueie todo o potencial
            </h2>
            <p className="text-muted-foreground text-sm">
              Seu plano atual: <strong>{currentPlan.name}</strong>
            </p>
          </div>

          {/* Current Usage */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-foreground">Seu uso atual</h3>
            <UsageBar label="Mensagens hoje" used={messagesCheck.used} limit={messagesCheck.limit} />
            <UsageBar label="Imagens este mês" used={imagesCheck.used} limit={imagesCheck.limit} />
            <UsageBar label="Arquivos este mês" used={filesCheck.used} limit={filesCheck.limit} />
            <UsageBar label="Áudio este mês" used={audioCheck.used} limit={audioCheck.limit} unit="min" />
          </div>

          {/* Upgrade Options */}
          <div className="space-y-4">
            {(['pro', 'agency'] as const).filter(k => k !== plan).map(key => {
              const p = PLANS[key];
              return (
                <div key={key} className="bg-card border border-primary/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">{p.name}</h3>
                    <span className="text-sm font-bold text-primary ml-auto">{p.price}/mês</span>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {p.features.slice(0, 4).map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.priceId && (
                    <GumroadCheckout
                      productUrl={p.priceId}
                      buttonText={`Assinar ${p.name}`}
                      className="w-full"
                    />
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
