export const PLANS = {
  free: {
    name: 'Free',
    price: 'R$ 0',
    priceId: null,
    productId: null,
    features: [
      'Mensagens ilimitadas',
      'Geração de imagens HD',
      'Áudio com ElevenLabs',
      'Busca web ilimitada',
      'Web scraping',
      'Todos os recursos liberados',
    ],
  },
  pro: {
    name: 'Pro',
    price: 'R$ 29/mês',
    priceId: 'price_1T8otlRk4yrqJlFFgMKgofXq',
    productId: 'prod_U72zYezt4uNjsV',
    features: [
      'Mensagens ilimitadas',
      'Geração de imagens HD',
      'Áudio com ElevenLabs',
      'Busca web ilimitada',
      'Web scraping',
      'Suporte prioritário',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string | null): PlanKey {
  if (productId === PLANS.pro.productId) return 'pro';
  return 'free';
}
