import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentTrace } from '@/components/chat/AgentTrace';

const runningStep = [{ id: 'request', status: 'running' as const, label: 'Pensando…' }];

function getTraceHeader() {
  return within(screen.getByLabelText('Progresso do agente')).getAllByRole('button')[0];
}

describe('AgentTrace lifecycle', () => {
  it('opens automatically while live and running, then collapses when the stream ends', () => {
    const { rerender } = render(<AgentTrace steps={runningStep} live durationMs={1200} />);
    const header = getTraceHeader();

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list', { name: 'Etapas da execução' })).toBeInTheDocument();

    rerender(<AgentTrace steps={runningStep} live={false} durationMs={1200} />);

    expect(screen.getByText('Trabalhou por 1.2s')).toBeInTheDocument();
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Etapas da execução' })).not.toBeInTheDocument();
  });

  it('keeps the manual choice instead of reopening automatically', () => {
    const { rerender } = render(<AgentTrace steps={runningStep} live durationMs={1200} />);
    const header = getTraceHeader();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');

    rerender(<AgentTrace steps={runningStep} live={false} durationMs={1200} />);
    rerender(<AgentTrace steps={runningStep} live durationMs={1200} />);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Etapas da execução' })).not.toBeInTheDocument();
  });
});
