import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourcesList } from '@/components/chat/SourcesList';

describe('SourcesList', () => {
  it('deduplicates sources and exposes safe external links', () => {
    render(<SourcesList sources={[
      { title: 'Fonte A', url: 'https://example.com/a' },
      { title: 'Fonte A repetida', url: 'https://example.com/a' },
      { title: 'Fonte B', url: 'https://example.org/b' },
    ]} />);

    expect(screen.getByText('Fontes')).toBeInTheDocument();
    expect(screen.getByText('Fonte A')).toBeInTheDocument();
    expect(screen.queryByText('Fonte A repetida')).not.toBeInTheDocument();
    expect(screen.getByText('Fonte B').closest('a')).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });
});
