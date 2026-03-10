import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Crown, Zap, Building2, ArrowLeft, Shield, CreditCard, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { PLANS, PlanKey } from '@/lib/plans';
import { useUsage } from '@/hooks/useUsage';
import { GumroadCheckout } from '@/components/subscription/GumroadCheckout';

const planIcons: Record<PlanKey, any> = {
  free: Zap,
  starter: Zap,
  pro: Crown,
  agency: Building2,
};

const faqs = [
  {
    q: 'Posso trocar de plano?',
    a: 'Sim! Você pode fazer upgrade ou downgrade a qualquer momento. A mudança é imediata e o valor é ajustado proporcionalmente.',
  },
  {
    q: 'Como funciona a garantia?',
    a: 'Oferecemos 7 dias de garantia incondicional. Se não gostar, devolvemos 100% do valor sem burocracia.',
  },
  {
    q: 'Precisa de cartão internacional?',
    a: 'O Gumroad aceita cartões nacionais e internacionais (Visa, Mastercard, Amex), além de PayPal.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem multa e sem complicação. Basta acessar sua conta no Gumroad e cancelar. Você continua com acesso até o fim do período pago.',
  },
];

export default function Precos() {
  const navigate = useNavigate();
  const { plan: currentPlan } = useUsage();
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const paidPlans: PlanKey[] = ['starter', 'pro', 'agency'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Planos & Preços</h1>
      </div>

      {/* Hero */}
      <div className="text-center px-4 pt-12 pb-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-4">
            Escolha seu plano e comece a criar{' '}
            <span className="gradient-text">10x mais rápido</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Do roteiro ao arquivo final, tudo em uma conversa só.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>Mensal</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual <span className="text-primary text-xs font-bold">-20%</span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {paidPlans.map((key, i) => {
            const plan = PLANS[key];
            const isCurrent = key === currentPlan;
            const isPro = key === 'pro';
            const Icon = planIcons[key];
            const price = isAnnual ? plan.priceAnnual : plan.price;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all ${
                  isPro
                    ? 'border-transparent bg-gradient-to-b from-primary/10 to-accent/5 shadow-lg ring-1 ring-primary/30'
                    : 'border-border bg-card shadow-[var(--shadow-card)]'
                } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                style={isPro ? {
                  backgroundImage: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.05))',
                } : undefined}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-md">
                    {plan.badge}
                  </span>
                )}

                {isCurrent && (
                  <span className="absolute -top-3 right-4 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Seu plano
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${isPro ? 'text-primary' : key === 'agency' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                </div>

                <div>
                  <span className="text-3xl font-extrabold text-foreground">{price}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                  {isAnnual && (
                    <p className="text-xs text-primary mt-1">Economize 20% no plano anual</p>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.featureList.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {f.included ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={f.included ? 'text-foreground' : 'text-muted-foreground/50'}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.priceId && !isCurrent && (
                  <GumroadCheckout
                    productUrl={plan.priceId}
                    buttonText={`Assinar ${plan.name}`}
                    className="w-full"
                  />
                )}

                {isCurrent && (
                  <p className="text-xs text-primary text-center font-medium">✓ Plano atual</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, text: '7 dias de garantia' },
            { icon: CreditCard, text: 'Pagamento 100% seguro' },
            { icon: RotateCcw, text: 'Cancele quando quiser' },
            { icon: Crown, text: 'Acesso imediato' },
          ].map((b, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border text-center">
              <b.icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <h3 className="text-xl font-bold text-foreground text-center mb-6">Comparação detalhada</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Recurso</th>
                {paidPlans.map(k => (
                  <th key={k} className="text-center py-3 px-4 text-foreground font-semibold">{PLANS[k].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Mensagens/dia', values: ['50', 'Ilimitado', 'Ilimitado'] },
                { label: 'Imagens/mês', values: ['20', '100', 'Ilimitado'] },
                { label: 'Arquivos/mês', values: ['5', '20', 'Ilimitado'] },
                { label: 'Áudio/mês', values: ['30min', '2h', 'Ilimitado'] },
                { label: 'Análise de imagem', values: ['10/mês', 'Ilimitado', 'Ilimitado'] },
                { label: 'Suporte', values: ['Email', 'Prioritário', 'WhatsApp'] },
                { label: 'Usuários', values: ['1', '1', '5'] },
                { label: 'API Access', values: ['—', '—', '✓'] },
              ].map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-3 px-4 text-muted-foreground">{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className="py-3 px-4 text-center text-foreground font-medium">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <h3 className="text-xl font-bold text-foreground text-center mb-6">Perguntas frequentes</h3>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden bg-card">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
