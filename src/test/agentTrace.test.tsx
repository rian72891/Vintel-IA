import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentTrace } from '@/components/chat/AgentTrace';

const runningStep = [{ id: 'request', status: 'running' as const, label: 'Pensando…' }];

describe('AgentTrace lifecycle', () => {
  it('stops presenting an active trace after the stream ends', () => {
    const { rerender } = render(<AgentTrace steps={runningStep} live durationMs={1200} />);

    expect(screen.getByText('Pensando…')).toBeInTheDocument();

    rerender(<AgentTrace steps={runningStep} live={false} durationMs={1200} />);

    expect(screen.getByText('Trabalhou por 1.2s')).toBeInTheDocument();
    expect(screen.queryByText('Trabalhando por 1.2s')).not.toBeInTheDocument();
  });
});
