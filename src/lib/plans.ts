export type PlanKey = 'free' | 'starter' | 'pro' | 'agency';

export interface PlanConfig {
  name: string;
  price: string;
  priceAnnual: string;
  priceId: string | null; // Gumroad product URL
  badge?: string;
  features: string[];
  limits: {
    messagesPerDay: number;
    imagesPerMonth: number;
    filesPerMonth: number;
    audioMinutesPerMonth: number;
    imageAnalysesPerMonth: number;
  };
  featureList: { label: string; included: boolean }[];
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    name: 'Free',
    price: 'R$ 0',
    priceAnnual: 'R$ 0',
    priceId: null,
    features: ['5 mensagens/dia', '3 imagens/mês', 'Sem arquivos', 'Sem áudio'],
    limits: {
      messagesPerDay: 5,
      imagesPerMonth: 3,
      filesPerMonth: 0,
      audioMinutesPerMonth: 0,
      imageAnalysesPerMonth: 2,
    },
    featureList: [
      { label: '5 mensagens por dia', included: true },
      { label: '3 imagens por mês', included: true },
      { label: 'Geração de arquivos', included: false },
      { label: 'Áudio IA', included: false },
      { label: 'Análise de imagens', included: false },
      { label: 'Suporte prioritário', included: false },
    ],
  },
  starter: {
    name: 'Starter',
    price: 'R$ 29',
    priceAnnual: 'R$ 23',
    priceId: 'https://gumroad.com/l/vintel-starter',
    features: [
      '50 mensagens/dia',
      '20 imagens/mês',
      '5 arquivos/mês',
      '30min áudio/mês',
      '10 análises de imagem/mês',
      'Suporte por email',
    ],
    limits: {
      messagesPerDay: 50,
      imagesPerMonth: 20,
      filesPerMonth: 5,
      audioMinutesPerMonth: 30,
      imageAnalysesPerMonth: 10,
    },
    featureList: [
      { label: '50 mensagens por dia', included: true },
      { label: '20 imagens por mês', included: true },
      { label: '5 arquivos por mês', included: true },
      { label: '30min de áudio por mês', included: true },
      { label: '10 análises de imagem/mês', included: true },
      { label: 'Suporte por email', included: true },
    ],
  },
  pro: {
    name: 'Pro',
    price: 'R$ 79',
    priceAnnual: 'R$ 63',
    priceId: 'https://gumroad.com/l/vintel-pro',
    badge: 'MAIS POPULAR',
    features: [
      'Mensagens ilimitadas',
      '100 imagens/mês',
      '20 arquivos/mês',
      '2h áudio/mês',
      'Análises ilimitadas',
      'Suporte prioritário',
      'Acesso antecipado a features',
    ],
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: 100,
      filesPerMonth: 20,
      audioMinutesPerMonth: 120,
      imageAnalysesPerMonth: Infinity,
    },
    featureList: [
      { label: 'Mensagens ilimitadas', included: true },
      { label: '100 imagens por mês', included: true },
      { label: '20 arquivos por mês', included: true },
      { label: '2h de áudio por mês', included: true },
      { label: 'Análises ilimitadas', included: true },
      { label: 'Suporte prioritário', included: true },
      { label: 'Acesso antecipado', included: true },
    ],
  },
  agency: {
    name: 'Agency',
    price: 'R$ 199',
    priceAnnual: 'R$ 159',
    priceId: 'https://gumroad.com/l/vintel-agency',
    features: [
      'Tudo ilimitado',
      '5 usuários inclusos',
      'API access',
      'White-label parcial',
      'Suporte WhatsApp',
      'Relatórios mensais',
    ],
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: Infinity,
      filesPerMonth: Infinity,
      audioMinutesPerMonth: Infinity,
      imageAnalysesPerMonth: Infinity,
    },
    featureList: [
      { label: 'Tudo ilimitado', included: true },
      { label: '5 usuários inclusos', included: true },
      { label: 'API access', included: true },
      { label: 'White-label parcial', included: true },
      { label: 'Suporte WhatsApp', included: true },
      { label: 'Relatórios mensais', included: true },
    ],
  },
};

export function getPlanByName(planName: string | null): PlanKey {
  if (planName && planName in PLANS) return planName as PlanKey;
  return 'free';
}
