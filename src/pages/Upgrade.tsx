import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Zap, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS } from '@/lib/stripe';
import { motion } from 'framer-motion';

export default function Upgrade() {
  const navigate = useNavigate();
  const { plan } = useSubscription();

  const blockedFeatures = [
    'Mensagens ilimitadas',
    'Mais imagens por mês',
    'Geração de áudio estendida',
    'Análises de imagem ilimitadas',
    'Suporte prioritário',
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Fazer upgrade</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Crown className="h-7 w-7 text-primary" />
          </div>

          <h1 className="text-2xl font-extrabold text-foreground mb-2">
            Desbloqueie todo o potencial
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Seu plano atual ({PLANS[plan].name}) tem limites. Faça upgrade para continuar criando.
          </p>

          <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-left">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              O que você desbloqueia
            </p>
            <ul className="space-y-2.5">
              {blockedFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button onClick={() => navigate('/precos')} className="w-full gap-2" size="lg">
            <Zap className="h-4 w-4" />
            Ver planos e preços
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
