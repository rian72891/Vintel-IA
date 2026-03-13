// Vintel IA - Plans configuration (Gumroad-based)

export const PLANS = {
  free: {
    name: 'Gratuito',
    price: 'R$ 0',
    priceMonthly: 0,
    priceYearly: 0,
    gumroadUrl: null,
    gumroadYearlyUrl: null,
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
      '3 imagens/mês',
      'Sem áudio',
      'Sem arquivos',
      'Sem análise de imagem',
    ],
  },
  starter: {
    name: 'Starter',
    price: 'R$ 29/mês',
    priceMonthly: 29,
    priceYearly: 278, // ~20% off
    gumroadUrl: 'https://gumroad.com/l/vintel-starter',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-starter-anual',
    productId: 'vintel-starter',
    limits: {
      messagesPerDay: 50,
      imagesPerMonth: 20,
      filesPerMonth: 5,
      audioMinutesPerMonth: 30,
      imageAnalysesPerMonth: 10,
    },
    features: [
      '50 mensagens/dia',
      '20 imagens/mês',
      '5 arquivos/mês',
      '30 min áudio/mês',
      '10 análises imagem/mês',
      'Suporte por email',
    ],
  },
  pro: {
    name: 'Pro',
    price: 'R$ 79/mês',
    priceMonthly: 79,
    priceYearly: 758, // ~20% off
    gumroadUrl: 'https://gumroad.com/l/vintel-pro',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-pro-anual',
    productId: 'vintel-pro',
    popular: true,
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: 100,
      filesPerMonth: 20,
      audioMinutesPerMonth: 120,
      imageAnalysesPerMonth: Infinity,
    },
    features: [
      'Mensagens ilimitadas',
      '100 imagens/mês',
      '20 arquivos/mês',
      '2h áudio/mês',
      'Análises ilimitadas',
      'Suporte prioritário',
      'Acesso antecipado a features',
    ],
  },
  agency: {
    name: 'Agency',
    price: 'R$ 199/mês',
    priceMonthly: 199,
    priceYearly: 1910, // ~20% off
    gumroadUrl: 'https://gumroad.com/l/vintel-agency',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-agency-anual',
    productId: 'vintel-agency',
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: Infinity,
      filesPerMonth: Infinity,
      audioMinutesPerMonth: Infinity,
      imageAnalysesPerMonth: Infinity,
    },
    features: [
      'Tudo ilimitado',
      '5 usuários',
      'API access',
      'White-label parcial',
      'Suporte via WhatsApp',
      'Relatórios mensais',
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
