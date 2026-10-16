import { describe, expect, it } from 'vitest';
import { exceedsMessageBurst, messageWindowStart, MESSAGE_BURST_LIMIT, MESSAGE_WINDOW_MS } from '../../supabase/functions/chat/messageRateLimit';

describe('chat burst quota', () => {
  it('allows the first ten saved messages and blocks the eleventh', () => {
    expect(MESSAGE_BURST_LIMIT).toBe(10);
    expect(exceedsMessageBurst(10)).toBe(false);
    expect(exceedsMessageBurst(11)).toBe(true);
  });
  it('uses exactly the last sixty seconds', () => {
    expect(MESSAGE_WINDOW_MS).toBe(60_000);
    expect(messageWindowStart(Date.parse('2026-10-16T20:00:00Z'))).toBe('2026-10-16T19:59:00.000Z');
  });
});