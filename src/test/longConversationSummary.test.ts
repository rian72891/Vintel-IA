import { describe, expect, it } from 'vitest';
import { buildConversationSummary, LONG_CONVERSATION_THRESHOLD } from '@/lib/longConversationSummary';
import type { Conversation } from '@/types/agent';

function conversation(messages: Conversation['messages']): Conversation {
  return {
    id: 'conversation-1',
    title: 'Plano de lançamento',
    messages,
    messageCount: messages.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('long conversation summary', () => {
  it('uses the recent visible messages and keeps the threshold explicit', () => {
    expect(LONG_CONVERSATION_THRESHOLD).toBe(30);
    const summary = buildConversationSummary(conversation([
      { id: 'u1', role: 'user', content: 'Defina o público-alvo.', timestamp: new Date() },
      { id: 'a1', role: 'assistant', content: 'O público principal são equipes de growth.', timestamp: new Date() },
    ]));

    expect(summary).toContain('Plano de lançamento');
    expect(summary).toContain('Usuário: Defina o público-alvo.');
    expect(summary).toContain('Vintel IA: O público principal');
  });
});
