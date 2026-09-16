import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';

describe('MarkdownMessage', () => {
  it('renders external links as secure clickable links', () => {
    render(<MarkdownMessage content="Veja [a documentação](https://example.com/docs)." />);

    const link = screen.getByRole('link', { name: /a documentação/i });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.querySelector('svg')).toBeInTheDocument();
  });

  it('renders GitHub-flavored markdown tables as HTML tables', () => {
    render(
      <MarkdownMessage
        content={'| Posição | Modelo |\n| --- | --- |\n| 1 | Alpha |\n| 2 | Beta |'}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Posição' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByText('| Posição | Modelo |')).not.toBeInTheDocument();
  });
});
