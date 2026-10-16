import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { streamChat } from '@/lib/streamChat';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('streamChat HTTP errors', () => {
  it.each([
    ['message_rate_limited', 'Você está enviando mensagens rápido demais. Aguarde alguns segundos e tente de novo.'],
    ['limite_atingido', 'Você atingiu o limite de 10 mensagens diárias do plano free. Faça upgrade para continuar.'],
  ])('preserves the distinct %s denial without retrying or rejecting', async (error, message) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error, message }), { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    const onError = vi.fn();
    const onDone = vi.fn();
    await streamChat({ messages: [], onDelta: vi.fn(), onError, onDone });
    expect(onError).toHaveBeenCalledWith(message);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('emits a terminal error step and calls onDone for a 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    const steps: Array<{ id: string; status: string; label: string; detail?: string }> = [];
    const errors: string[] = [];
    const onDone = vi.fn();

    await streamChat({
      messages: [],
      onDelta: vi.fn(),
      onStep: (step) => steps.push(step),
      onError: (error) => errors.push(error),
      onDone,
    });

    expect(steps).toEqual([
      {
        id: 'chat-request',
        status: 'error',
        label: 'Falha ao gerar resposta',
        detail: 'Endpoint não encontrado',
      },
    ]);
    expect(errors).toEqual(['Endpoint não encontrado']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
