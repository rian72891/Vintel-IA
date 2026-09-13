import type { AgentType, Conversation } from '@/types/agent';

/**
 * Returns an agent only when its conversation count leads the runner-up by at least two.
 * Ties are resolved by the most recent conversation among the tied agents.
 */
export function getMostUsedAgent(conversations: Conversation[]): AgentType | undefined {
  const stats = new Map<AgentType, { count: number; latestCreatedAt: number }>();

  for (const conversation of conversations) {
    if (!conversation.agent) continue;
    const current = stats.get(conversation.agent);
    const createdAt = conversation.createdAt.getTime();
    stats.set(conversation.agent, {
      count: (current?.count ?? 0) + 1,
      latestCreatedAt: Math.max(current?.latestCreatedAt ?? 0, createdAt),
    });
  }

  const ranked = [...stats.entries()].sort(([, a], [, b]) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.latestCreatedAt - a.latestCreatedAt;
  });

  const leader = ranked[0];
  if (!leader) return undefined;

  const runnerUpCount = ranked[1]?.[1].count ?? 0;
  return leader[1].count >= runnerUpCount + 2 ? leader[0] : undefined;
}
