import { AgentType, Message } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

function mapErrorMessage(status: number, raw?: string): string {
  if (status === 401 || status === 403) return 'Sua sessão expirou. Faça login novamente para continuar.';
  if (status === 402) return 'Seus créditos de IA acabaram. Faça upgrade do plano para continuar conversando.';
  if (status === 429) return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.';
  if (status === 503) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.';
  if (status >= 500) return 'Tivemos um problema no servidor. Já estamos verificando — tente novamente.';
  return raw || 'Não foi possível processar sua mensagem. Tente novamente.';
}

export type TraceStep = {
  id: string;
  status: 'running' | 'done' | 'error';
  label: string;
  detail?: string;
};

export async function streamChat({
  messages,
  agent,
  plan,
  temperature,
  onDelta,
  onStep,
  onDone,
  onError,
}: {
  messages: Message[];
  agent?: AgentType;
  plan?: string;
  temperature?: number;
  onDelta: (text: string) => void;
  onStep?: (step: TraceStep) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {

  // Prefer the user's session JWT so the edge function can identify them
  // and load their oauth_tokens for tool calling. Falls back to the
  // publishable key for anonymous chats.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, agent, plan, temperature }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const friendly = mapErrorMessage(resp.status, data?.error);
    onError(friendly);
    return;
  }

  if (!resp.body) {
    onError('No response body');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed?.type === 'step') { onStep?.(parsed as TraceStep); continue; }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);

      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}
