import { describe, expect, it } from 'vitest';
import type { Conversation } from '@/types/agent';
import { getMostUsedAgent } from '@/lib/agentUsage';

const conversation = (agent: Conversation['agent'], createdAt: string): Conversation => ({
  id: `${agent}-${createdAt}`,
  title: 'Conversa',
  messages: [],
  agent,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
});

describe('most used agent', () => {
  it('does not highlight an agent when counts are tied', () => {
    const conversations = [
      conversation('research', '2026-09-01T10:00:00Z'),
      conversation('coder', '2026-09-02T10:00:00Z'),
      conversation('research', '2026-09-03T10:00:00Z'),
      conversation('coder', '2026-09-04T10:00:00Z'),
    ];

    expect(getMostUsedAgent(conversations)).toBeUndefined();
  });

  it('does not highlight an agent with only a one-conversation lead', () => {
    const conversations = [
      conversation('automation', '2026-09-01T10:00:00Z'),
      conversation('automation', '2026-09-02T10:00:00Z'),
      conversation('research', '2026-09-03T10:00:00Z'),
    ];

    expect(getMostUsedAgent(conversations)).toBeUndefined();
  });

  it('highlights a clear leader with a margin of at least two', () => {
    const conversations = [
      conversation('business', '2026-09-01T10:00:00Z'),
      conversation('business', '2026-09-02T10:00:00Z'),
      conversation('business', '2026-09-03T10:00:00Z'),
      conversation('business', '2026-09-04T10:00:00Z'),
      conversation('research', '2026-09-05T10:00:00Z'),
      conversation('research', '2026-09-06T10:00:00Z'),
    ];

    expect(getMostUsedAgent(conversations)).toBe('business');
  });

  it('uses the newest conversation to break an exact count tie before applying the margin', () => {
    const conversations = [
      conversation('research', '2026-09-01T10:00:00Z'),
      conversation('research', '2026-09-02T10:00:00Z'),
      conversation('coder', '2026-09-03T10:00:00Z'),
      conversation('coder', '2026-09-04T10:00:00Z'),
      conversation('business', '2026-09-05T10:00:00Z'),
    ];

    expect(getMostUsedAgent(conversations)).toBeUndefined();
  });
});
