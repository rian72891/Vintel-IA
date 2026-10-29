import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { generateImage } from '@/lib/generateImage';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'user-jwt' } }, error: null } as never);
});
afterEach(() => vi.unstubAllGlobals());

describe('authenticated image requests', () => {
  it('does not call generation without a user session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(generateImage('cat')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends the user JWT, not the publishable key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ imageUrl: 'data:image/png;base64,aA==' })));
    vi.stubGlobal('fetch', fetcher);
    await generateImage('cat');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer user-jwt');
  });
  it('preserves the distinct monthly plan-limit error', async () => {
    const message = 'Você atingiu o limite de imagens do seu plano neste mês.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: message, code: 'image_plan_limit' }), { status: 429 })));
    await expect(generateImage('cat')).rejects.toThrow(message);
  });
});