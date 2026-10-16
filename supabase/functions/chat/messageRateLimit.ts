export const MESSAGE_BURST_LIMIT = 10;
export const MESSAGE_WINDOW_MS = 60_000;
export const MESSAGE_BURST_ERROR = 'Você está enviando mensagens rápido demais. Aguarde alguns segundos e tente de novo.';

// The current user message is saved before ChatView sends the chat request.
export function exceedsMessageBurst(count: number): boolean {
  return count > MESSAGE_BURST_LIMIT;
}

export function messageWindowStart(now = Date.now()): string {
  return new Date(now - MESSAGE_WINDOW_MS).toISOString();
}