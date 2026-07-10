import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Plug, Zap, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'vintel:onboarding:v1';

interface Props {
  userId?: string;
}

export function WelcomeModal({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const key = `${STORAGE_KEY}:${userId}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId]);

  const dismiss = () => {
    if (userId) localStorage.setItem(`${STORAGE_KEY}:${userId}`, '1');
    setOpen(false);
  };

  const steps = [
    {
      icon: Sparkles,
      title: 'Bem-vindo ao Vintel IA',
      desc: 'Seu assistente para criar, programar e automatizar. Vamos ver rapidinho o que dá pra fazer.',
    },
    {
      icon: MessageSquare,
      title: 'Converse com naturalidade',
      desc: 'Peça código, análises, textos ou imagens. Use /imagine para gerar arte e anexe arquivos direto no chat.',
    },
    {
      icon: Plug,
      title: 'Conecte suas ferramentas',
      desc: 'GitHub, Google, Notion, Slack, Linear e Asana. A IA usa seus dados para agir por você — commits, PRs, planilhas.',
      cta: { label: 'Ver conectores', to: '/conectores' },
    },
    {
      icon: Zap,
      title: 'Pronto pra começar',
      desc: 'Você tem créditos grátis diários. Explore, e quando quiser mais poder, é só fazer upgrade.',
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismiss}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{current.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.desc}</p>
              </div>
              {current.cta && (
                <Link
                  to={current.cta.to}
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  {current.cta.label} →
                </Link>
              )}
            </motion.div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {!isLast && (
                  <button
                    onClick={dismiss}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Pular
                  </button>
                )}
                <button
                  onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
                >
                  {isLast ? 'Começar' : 'Próximo'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
