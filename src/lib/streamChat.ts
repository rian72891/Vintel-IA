import { AgentType, Message } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';
import { reportChatRequestError } from '@/lib/sentry';

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
  status: 'running' | 'done' | 'error' | 'waiting';
  label: string;
  detail?: string;
  /** Resultado retornado pela ferramenta, quando o evento o disponibiliza. */
  result?: unknown;
  /** Metadados opcionais para traces persistidos ou futuros eventos enriquecidos. */
  durationMs?: number;
  startedAt?: number;
};

export type ConfirmRequest = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  label: string;
};

export type ApprovalMap = Record<string, 'approved' | 'cancelled'>;

export type ConnectionState = 'connecting' | 'reconnecting' | 'offline' | 'connected';

const NETWORK_RETRY_DELAYS = [1000, 2000];

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function waitForOnline() {
  if (navigator.onLine) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      resolve();
    };
    window.addEventListener('online', handleOnline, { once: true });
  });
}

export async function streamChat({
  messages,
  agent,
  conversationId,
  plan,
  temperature,
  approvals,
  onDelta,
  onStep,
  onConfirm,
  onConnectionState,
  onDone,
  onError,
}: {
  messages: Message[];
  agent?: AgentType;
  conversationId?: string | null;
  plan?: string;
  temperature?: number;
  approvals?: ApprovalMap;
  onDelta: (text: string) => void;
  onStep?: (step: TraceStep) => void;
  onConfirm?: (req: ConfirmRequest) => void;
  onConnectionState?: (state: ConnectionState) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {


  // Prefer the user's session JWT so the edge function can identify them
  // and load their oauth_tokens for tool calling. Falls back to the
  // publishable key for anonymous chats.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, agent, plan, temperature, approvals, conversationId }),
  };

  let resp: Response;
  for (let attempt = 0; ; attempt += 1) {
    if (!navigator.onLine) {
      onConnectionState?.('offline');
      await waitForOnline();
    }

    try {
      onConnectionState?.(attempt > 0 ? 'reconnecting' : 'connecting');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        resp = await fetch(CHAT_URL, { ...request, signal: controller.signal });
      } finally {
        window.clearTimeout(timeout);
      }
      onConnectionState?.('connected');
      break;
    } catch (error) {
      if (!isNetworkError(error) || attempt >= NETWORK_RETRY_DELAYS.length) {
        onConnectionState?.(navigator.onLine ? 'reconnecting' : 'offline');
        if (isNetworkError(error)) {
          onError('Não foi possível estabelecer conexão com a IA. Sua mensagem foi preservada; tente novamente quando a internet estabilizar.');
          onDone();
          return;
        }
        throw error;
      }
      onConnectionState?.(navigator.onLine ? 'reconnecting' : 'offline');
      if (!navigator.onLine) await waitForOnline();
      else await wait(NETWORK_RETRY_DELAYS[attempt]);
    }
  }

  const activeSteps = new Map<string, TraceStep>();
  const emitHttpError = (label: string, detail: string) => {
    const inProgress = [...activeSteps.values()].filter((step) => step.status === 'running' || step.status === 'waiting');
    if (inProgress.length) {
      for (const step of inProgress) onStep?.({ ...step, status: 'error', label, detail });
    } else {
      onStep?.({ id: 'chat-request', status: 'error', label, detail });
    }
  };

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const friendly = mapErrorMessage(resp.status, data?.error);
    reportChatRequestError(resp.status, 'http_error');
    emitHttpError('Falha ao gerar resposta', friendly);
    try {
      onError(friendly);
    } finally {
      onDone();
    }
    return;
  }

  if (!resp.body) {
    const error = 'No response body';
    reportChatRequestError(resp.status, 'empty_response');
    emitHttpError('Resposta vazia do serviço', error);
    try {
      onError(error);
    } finally {
      onDone();
    }
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
        if (parsed?.type === 'step') {
          const step = parsed as TraceStep;
          activeSteps.set(step.id, step);
          onStep?.(step);
          continue;
        }
        if (parsed?.type === 'confirm') { onConfirm?.(parsed as ConfirmRequest); continue; }
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
        if (parsed?.type === 'step') {
          const step = parsed as TraceStep;
          activeSteps.set(step.id, step);
          onStep?.(step);
          continue;
        }
        if (parsed?.type === 'confirm') { onConfirm?.(parsed as ConfirmRequest); continue; }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);

      } catch { /* ignore */ }
    }
  }

  onDone();
}
