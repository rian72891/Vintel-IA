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
    priceYearly: 278,
    gumroadUrl: 'https://gumroad.com/l/vintel-starter',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-starter-anual',
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
      '50 mensagens/dia (GPT-4o mini)',
      '20 imagens/mês',
      '5 arquivos/mês (PDF)',
      '30 min áudio/mês',
      '10 análises imagem/mês',
      'Suporte por email',
    ],
  },
  pro: {
    name: 'Pro',
    price: 'R$ 79/mês',
    priceMonthly: 79,
    priceYearly: 758,
    gumroadUrl: 'https://gumroad.com/l/vintel-pro',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-pro-anual',
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
      'Mensagens ilimitadas (GPT-4o)',
      '100 imagens/mês (HD)',
      '20 arquivos/mês (PDF, ZIP, HTML)',
      '2h áudio/mês (transcrição + voz)',
      'Análises ilimitadas de imagem',
      'Geração de código completo',
      'Suporte prioritário',
      'Acesso antecipado',
    ],
  },
  agency: {
    name: 'Agency',
    price: 'R$ 199/mês',
    priceMonthly: 199,
    priceYearly: 1910,
    gumroadUrl: 'https://gumroad.com/l/vintel-agency',
    gumroadYearlyUrl: 'https://gumroad.com/l/vintel-agency-anual',
    productId: 'vintel-agency',
    model: 'openai/gpt-5',
    maxTokens: 16000,
    limits: {
      messagesPerDay: Infinity,
      imagesPerMonth: Infinity,
      filesPerMonth: Infinity,
      audioMinutesPerMonth: Infinity,
      imageAnalysesPerMonth: Infinity,
    },
    features: [
      'Tudo ilimitado (GPT-5 + Gemini Pro)',
      'Imagens ilimitadas (HD)',
      'Arquivos ilimitados (todos formatos)',
      'Áudio ilimitado (10h voz)',
      '5 usuários simultâneos',
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

export function getPlanModel(plan: PlanKey) {
  return PLANS[plan].model;
}

export function getPlanMaxTokens(plan: PlanKey) {
  return PLANS[plan].maxTokens;
}
