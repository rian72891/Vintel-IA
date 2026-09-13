import { describe, expect, it } from 'vitest';
import { agents } from '@/data/agents';
import { agentIconMap } from '@/lib/agentIcons';

describe('agent icon mapping', () => {
  it('resolves a real Lucide component for every specialized agent', () => {
    expect(agents).toHaveLength(7);
    for (const agent of agents) {
      expect(agentIconMap[agent.icon], `${agent.name} (${agent.icon})`).toBeDefined();
    }
  });
});
