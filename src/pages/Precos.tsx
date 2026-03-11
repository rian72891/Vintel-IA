import { useState } from 'react';
import { Check, X, Crown, Zap, Building2, ArrowLeft, Shield, CreditCard, RotateCcw, ChevronDown } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS, PlanKey } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const faqItems = [
  {
    q: 'Posso trocar de plano?',
    a: 'Sim! Você pode fazer upgrade ou downgrade a qualquer momento. As mudanças são aplicadas imediatamente e o valor é ajustado proporcionalmente.',
  },
  {
    q: 'Como funciona a garantia?',
    a: 'Oferecemos 7 dias de garantia incondicional. Se não gostar, devolvemos 100% do valor, sem perguntas.',
  },
  {
    q: 'Precisa de cartão internacional?',
    a: 'Não! Aceitamos cartões nacionais (Visa, Mastercard, Elo, Amex) e também Pix e boleto via Gumroad.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem multa e sem burocracia. Você pode cancelar diretamente no portal de gerenciamento a qualquer momento.',
  },
];

export default function Precos() {
  const { plan: currentPlan, subscribed } = useSubscription();
  const [isYearly, setIsYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const planOrder: PlanKey[] = ['starter', 'pro', 'agency'];
  const planIcons: Record<string, any> = {
    starter: Zap,
    pro: Crown,
    agency: Building2,
  };

  const comparisonFeatures = [
    { label: 'Mensagens/dia', starter: '50', pro: 'Ilimitado', agency: 'Ilimitado' },
    { label: 'Imagens/mês', starter: '20', pro: '100', agency: 'Ilimitado' },
    { label: 'Arquivos/mês', starter: '5', pro: '20', agency: 'Ilimitado' },
    { label: 'Áudio/mês', starter: '30 min', pro: '2 horas', agency: 'Ilimitado' },
    { label: 'Análises de imagem', starter: '10', pro: 'Ilimitado', agency: 'Ilimitado' },
    { label: 'Usuários', starter: '1', pro: '1', agency: '5' },
    { label: 'API access', starter: '✗', pro: '✗', agency: '✓' },
    { label: 'White-label', starter: '✗', pro: '✗', agency: 'Parcial' },
    { label: 'Suporte', starter: 'Email', pro: 'Prioritário', agency: 'WhatsApp' },
    { label: 'Acesso antecipado', starter: '✗', pro: '✓', agency: '✓' },
    { label: 'Relatórios mensais', starter: '✗', pro: '✗', agency: '✓' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Planos</h1>
      </div>

      {/* Hero */}
      <div className="text-center px-4 pt-12 pb-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">
            Escolha seu plano e comece a{' '}
            <span className="gradient-text">criar 10x mais rápido</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Do roteiro ao arquivo final, tudo em uma conversa só
          </p>
        </motion.div>

        {/* Toggle mensal/anual */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={cn('text-sm font-medium', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>Mensal</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={cn(
              'relative w-14 h-7 rounded-full transition-colors',
              isYearly ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span className={cn(
              'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform shadow-sm',
              isYearly ? 'left-8' : 'left-1'
            )} />
          </button>
          <span className={cn('text-sm font-medium', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
            Anual <span className="text-xs text-primary font-semibold">-20%</span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {planOrder.map((key, i) => {
            const plan = PLANS[key];
            const isCurrent = key === currentPlan;
            const isPro = key === 'pro';
            const Icon = planIcons[key];
            const price = isYearly
              ? `R$ ${Math.round(plan.priceYearly / 12)}`
              : `R$ ${plan.priceMonthly}`;
            const gumroadUrl = isYearly ? plan.gumroadYearlyUrl : plan.gumroadUrl;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  'relative rounded-2xl border p-6 flex flex-col gap-4 transition-all',
                  isPro
                    ? 'border-transparent bg-gradient-to-b from-primary/5 to-accent/5 shadow-lg ring-1 ring-primary/30'
                    : 'border-border bg-card',
                  isCurrent ? 'ring-2 ring-primary' : ''
                )}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold rounded-full shadow-md">
                    MAIS POPULAR
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 right-4 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    Seu plano
                  </span>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Icon className={cn('h-5 w-5', isPro ? 'text-primary' : key === 'agency' ? 'text-yellow-500' : 'text-muted-foreground')} />
                  <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
                </div>

                <div>
                  <span className="text-3xl font-extrabold text-foreground">{price}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                  {isYearly && (
                    <p className="text-xs text-primary mt-1">
                      R$ {plan.priceYearly}/ano (economia de R$ {plan.priceMonthly * 12 - plan.priceYearly})
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isCurrent && gumroadUrl && (
                  <Button
                    onClick={() => window.open(gumroadUrl, '_blank')}
                    variant={isPro ? 'default' : 'outline'}
                    className={cn('w-full mt-2', isPro && 'bg-gradient-to-r from-primary to-accent hover:opacity-90')}
                  >
                    Assinar {plan.name}
                  </Button>
                )}

                {isCurrent && (
                  <p className="text-xs text-muted-foreground text-center mt-2">Plano atual</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: '7 dias de garantia' },
            { icon: CreditCard, label: 'Pagamento 100% seguro' },
            { icon: RotateCcw, label: 'Cancele quando quiser' },
            { icon: Crown, label: 'Suporte dedicado' },
          ].map((badge) => (
            <div key={badge.label} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl text-center">
              <badge.icon className="h-5 w-5 text-primary" />
              <span className="text-[11px] text-muted-foreground font-medium">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <h2 className="text-xl font-bold text-foreground text-center mb-6">Compare os planos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Recurso</th>
                <th className="text-center py-3 px-4 text-foreground font-semibold">Starter</th>
                <th className="text-center py-3 px-4 text-primary font-semibold">Pro</th>
                <th className="text-center py-3 px-4 text-yellow-500 font-semibold">Agency</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((f) => (
                <tr key={f.label} className="border-b border-border/50">
                  <td className="py-3 px-4 text-muted-foreground">{f.label}</td>
                  <td className="py-3 px-4 text-center text-foreground">{f.starter}</td>
                  <td className="py-3 px-4 text-center text-foreground font-medium">{f.pro}</td>
                  <td className="py-3 px-4 text-center text-foreground">{f.agency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-foreground text-center mb-6">Perguntas frequentes</h2>
        <div className="space-y-2">
          {faqItems.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                {faq.q}
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFaq === i && 'rotate-180')} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
