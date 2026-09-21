import type { Conversation, Message } from '@/types/agent';

export const LONG_CONVERSATION_THRESHOLD = 30;

function compact(content: string, max = 420) {
  return content.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildConversationSummary(conversation: Conversation): string {
  const visible = conversation.messages
    .filter((message): message is Message => message.role === 'user' || message.role === 'assistant')
    .slice(-8);

  if (!visible.length) {
    return `Resumo da conversa anterior "${conversation.title}": não há mensagens carregadas para resumir.`;
  }

  const lines = visible.map((message) => {
    const speaker = message.role === 'user' ? 'Usuário' : 'Vintel IA';
    return `- ${speaker}: ${compact(message.content)}`;
  });

  return [
    `Resumo da conversa anterior "${conversation.title}":`,
    'Use este contexto apenas quando for relevante para continuar o trabalho:',
    ...lines,
  ].join('\n');
}
