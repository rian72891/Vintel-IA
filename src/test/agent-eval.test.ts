import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { streamChat, type TraceStep } from '@/lib/streamChat';

function sseResponse(events: string[], status = 200) {
  const body = events.map((event) => `data: ${event}\n`).join('') + 'data: [DONE]\n';
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function runAgentCase(input: string, response: Response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const deltas: string[] = [];
  const steps: TraceStep[] = [];
  const errors: string[] = [];
  const onDone = vi.fn();

  await streamChat({
    messages: [{ id: 'eval-user', role: 'user', content: input } as any],
    onDelta: (delta) => deltas.push(delta),
    onStep: (step) => steps.push(step),
    onError: (error) => errors.push(error),
    onDone,
  });

  return { text: deltas.join(''), steps, errors, onDone };
}

describe('agent behavior evaluation suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds to a simple greeting without exposing thinking tags', async () => {
    const result = await runAgentCase(
      'Olá, tudo bem?',
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'Olá! Tudo bem por aqui.' } }] })]),
    );

    expect(result.text).toContain('Olá!');
    expect(result.text).not.toMatch(/<thinking>/i);
    expect(result.errors).toEqual([]);
    expect(result.onDone).toHaveBeenCalledTimes(1);
  });

  it('answers a question that does not need tools', async () => {
    const result = await runAgentCase(
      'Explique em uma frase o que é uma API.',
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'Uma API é uma interface para sistemas trocarem dados e comandos.' } }] })]),
    );

    expect(result.text.length).toBeGreaterThan(20);
    expect(result.steps).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('preserves tool progress events and completes the response', async () => {
    const result = await runAgentCase(
      'Liste os meus repositórios no GitHub.',
      sseResponse([
        JSON.stringify({ type: 'step', id: 'github', status: 'running', label: 'Consultando GitHub' }),
        JSON.stringify({ type: 'step', id: 'github', status: 'done', label: 'Consultando GitHub', detail: '3 repositórios encontrados' }),
        JSON.stringify({ choices: [{ delta: { content: 'Encontrei 3 repositórios.' } }] }),
      ]),
    );

    expect(result.steps.map((step) => step.status)).toEqual(['running', 'done']);
    expect(result.text).toContain('3 repositórios');
    expect(result.errors).toEqual([]);
  });

  it('returns a friendly error for an empty or invalid request', async () => {
    const result = await runAgentCase(
      '',
      new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(result.errors).toEqual(['Bad request']);
    expect(result.text).toBe('');
    expect(result.steps).toEqual([
      expect.objectContaining({ status: 'error', label: 'Falha ao gerar resposta' }),
    ]);
    expect(result.onDone).toHaveBeenCalledTimes(1);
  });

  it('does not hang on malformed streaming data and still finalizes', async () => {
    const result = await runAgentCase(
      'Processe este pedido malformado.',
      sseResponse(['not-json']),
    );

    expect(result.errors).toEqual([]);
    expect(result.onDone).toHaveBeenCalledTimes(1);
  });
});
