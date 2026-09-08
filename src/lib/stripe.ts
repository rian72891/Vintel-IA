// Vintel IA - Plans configuration (Stripe-based)

export const PLANS = {
  free: {
    name: 'Gratuito',
    price: 'R$ 0',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceId: null as string | null,
    stripePriceIdYearly: null as string | null,
    productId: null,
    model: 'google/gemini-2.5-flash-lite',
    maxTokens: 2000,
    limits: {
      messagesPerDay: 10,
      imagesPerMonth: 3,
      filesPerMonth: 0,
      audioMinutesPerMonth: 0,
      imageAnalysesPerMonth: 0,
    },
    features: [
      '10 mensagens/dia',
      'Modelo Gemini Flash Lite',
      'Até 3 imagens/mês',
    ],
  },
  starter: {
    name: 'Starter',
    badge: 'Econômico',
    price: 'R$ 19,90/mês',
    priceMonthly: 19.90,
    priceYearly: 191,
    stripePriceId: null as string | null,
    stripePriceIdYearly: null as string | null,
    productId: 'vintel-starter',
    model: 'google/gemini-2.5-flash',
    maxTokens: 4000,
    limits: {
      messagesPerDay: 50,
      imagesPerMonth: 20,
      filesPerMonth: 5,
      audioMinutesPerMonth: 30,
      imageAnalysesPerMonth: 10,
    },
    features: [
      '50 mensagens/dia',
      'Modelo Gemini Flash',
      'Até 20 imagens/mês',
      'Geração de arquivos (PDF/HTML/TXT/ZIP) com limite mensal',
      'Até 30 minutos de áudio por mês',
    ],
  },
  pro: {
    name: 'Pro',
    badge: 'MELHOR CUSTO-BENEFÍCIO',
    price: 'R$ 39,90/mês',
    priceMonthly: 39.90,
    priceYearly: 383,
    stripePriceId: null as string | null,
    stripePriceIdYearly: null as string | null,
    productId: 'vintel-pro',
    popular: true,
    model: 'google/gemini-2.5-pro',
    maxTokens: 8000,
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: 100,
      filesPerMonth: 20,
      audioMinutesPerMonth: 120,
      imageAnalysesPerMonth: Infinity,
    },
    features: [
      'Mensagens ilimitadas',
      'Modelo Gemini Pro como principal',
      'Até 100 imagens/mês',
      'Geração de arquivos com limite ampliado',
      'Até 120 minutos de áudio por mês',
    ],
  },
  agency: {
    name: 'Agency',
    badge: 'Premium',
    price: 'R$ 97/mês',
    priceMonthly: 97,
    priceYearly: 931,
    stripePriceId: null as string | null,
    stripePriceIdYearly: null as string | null,
    productId: 'vintel-agency',
    model: 'google/gemini-2.5-pro',
    maxTokens: 16000,
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: Infinity,
      filesPerMonth: Infinity,
      audioMinutesPerMonth: Infinity,
      imageAnalysesPerMonth: Infinity,
    },
    features: [
      'Mensagens ilimitadas',
      'Modelo Gemini Pro como principal',
      'Imagens ilimitadas',
      'Geração de arquivos ilimitada',
      'Áudio ilimitado',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string | null): PlanKey {
  if (!productId) return 'free';
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.productId === productId) return key as PlanKey;
  }
  return 'free';
}

export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan].limits;
}

export function getPlanModel(plan: PlanKey) {
  return PLANS[plan].model;
}

export function getPlanMaxTokens(plan: PlanKey) {
  return PLANS[plan].maxTokens;
}
