// Exercise the deployed handler's logic with mocked auth, database and providers.
// No private keys, real images or production counters are used by these tests.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('supabase/functions/generate-image/index.ts', 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export const IMAGE_LIMITS', 'const IMAGE_LIMITS');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function setup({ plan = 'free', used = 0, age = 0, authenticated = true, success = true } = {}) {
  let handler: (req: Request) => Promise<Response> = async () => new Response();
  const state = { id: 'usage', images_used: used, reset_date: new Date(Date.now() - age).toISOString() };
  const writes: Record<string, unknown>[] = [];
  const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify(success
    ? { candidates: [{ content: { parts: [{ inlineData: { data: 'aA==', mimeType: 'image/png' } }] } }] }
    : { candidates: [] }), { status: 200 }));
  const admin = { from(table: string) {
    let changes: Record<string, unknown> | undefined;
    const filters: Record<string, unknown> = {};
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      update(value: Record<string, unknown>) { changes = value; return query; },
      async maybeSingle() { return resolve(); },
      async single() { return resolve(); },
    };
    function resolve() {
      if (table === 'subscriptions') return { data: { status: 'active', plan }, error: null };
      if (changes) {
        if (filters.images_used !== undefined && filters.images_used !== state.images_used) return { data: null, error: null };
        writes.push(changes);
        Object.assign(state, changes);
      }
      return { data: { ...state }, error: null };
    }
    return query;
  } };
  const user = { auth: { getClaims: vi.fn().mockResolvedValue({ data: authenticated ? { claims: { sub: 'user-id' } } : null, error: null }) } };
  let clients = 0;
  const deno = { env: { get: () => 'configured' } };
  new Function('serve', 'createClient', 'corsHeaders', 'Deno', 'fetch', compiled)(
    (value: typeof handler) => { handler = value; }, () => clients++ === 0 ? user : admin, {}, deno, provider,
  );
  const request = (token = 'jwt') => handler(new Request('https://app.test/generate', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Editing avoids the free provider on failure and verifies identical protection.
    body: JSON.stringify({ prompt: 'cat', editImageUrl: 'data:image/png;base64,aA==' }),
  }));
  return { request, provider, state, writes };
}

describe('image server protection', () => {
  it('rejects missing JWT before contacting a provider', async () => {
    const s = setup();
    expect((await s.request('')).status).toBe(401);
    expect(s.provider).not.toHaveBeenCalled();
  });
  it('rejects invalid JWT before contacting a provider', async () => {
    const s = setup({ authenticated: false });
    expect((await s.request()).status).toBe(401);
    expect(s.provider).not.toHaveBeenCalled();
  });
  it.each([['free', 3], ['starter', 20], ['pro', 100]])('blocks %s at its exact monthly limit %i', async (plan, used) => {
    const s = setup({ plan, used });
    const response = await s.request();
    expect(response.status).toBe(429);
    expect(s.provider).not.toHaveBeenCalled();
    expect(s.state.images_used).toBe(used);
  });
  it('allows agency without a finite image limit', async () => {
    const s = setup({ plan: 'agency', used: 10000 });
    expect((await s.request()).status).toBe(200);
    expect(s.state.images_used).toBe(10001);
  });
  it('increments exactly once after a successful image', async () => {
    const s = setup({ used: 2 });
    expect((await s.request()).status).toBe(200);
    expect(s.state.images_used).toBe(3);
    expect(s.writes).toHaveLength(1);
  });
  it('does not increment a failed generation', async () => {
    const s = setup({ used: 2, success: false });
    const response = await s.request();
    expect((await response.json()).error).toBeTruthy();
    expect(s.state.images_used).toBe(2);
    expect(s.writes).toHaveLength(0);
  });
  it('renews the monthly window after 30 days before quota checking', async () => {
    const s = setup({ used: 3, age: 30 * 24 * 60 * 60 * 1000 + 1000 });
    expect((await s.request()).status).toBe(200);
    expect(s.state.images_used).toBe(1);
    expect(s.writes[0]).toMatchObject({ images_used: 0, files_used: 0, audio_minutes_used: 0, image_analyses_used: 0 });
  });
});