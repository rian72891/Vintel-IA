import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type TokenResult = {
  access_token: string;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
};

async function exchangeToken(provider: string, code: string, redirect_uri: string): Promise<TokenResult> {
  const env = (k: string) => Deno.env.get(k);

  const expireFrom = (s?: number) =>
    s ? new Date(Date.now() + s * 1000).toISOString() : null;

  if (provider === 'github') {
    const id = env('GITHUB_CLIENT_ID'), secret = env('GITHUB_CLIENT_SECRET');
    if (!id || !secret) throw new Error('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET ausentes');
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: secret, code, redirect_uri }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error_description || d.error);
    return { access_token: d.access_token, refresh_token: d.refresh_token ?? null, scope: d.scope, token_type: d.token_type };
  }

  if (provider === 'google') {
    const id = env('GOOGLE_CLIENT_ID'), secret = env('GOOGLE_CLIENT_SECRET');
    if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes');
    const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri, grant_type: 'authorization_code' });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error_description || d.error || 'Token exchange failed');
    return { access_token: d.access_token, refresh_token: d.refresh_token ?? null, scope: d.scope, token_type: d.token_type, expires_at: expireFrom(d.expires_in) };
  }

  if (provider === 'lovable') {
    const id = env('LOVABLE_CLIENT_ID'), secret = env('LOVABLE_CLIENT_SECRET');
    if (!id || !secret) throw new Error('LOVABLE_CLIENT_ID / LOVABLE_CLIENT_SECRET ausentes');
    const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri, grant_type: 'authorization_code' });
    const res = await fetch('https://app.lovable.dev/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error_description || d.error || 'Lovable token exchange failed');
    return { access_token: d.access_token, token_type: 'bearer', scope: d.scope ?? null };
  }

  if (provider === 'slack') {
    const id = env('SLACK_CLIENT_ID'), secret = env('SLACK_CLIENT_SECRET');
    if (!id || !secret) throw new Error('SLACK_CLIENT_ID / SLACK_CLIENT_SECRET ausentes');
    const params = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri });
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Slack token exchange failed');
    const access = d.access_token || d.authed_user?.access_token;
    if (!access) throw new Error('Nenhum access_token retornado pelo Slack');
    return { access_token: access, scope: d.scope, token_type: 'bearer' };
  }

  if (provider === 'linear') {
    const id = env('LINEAR_CLIENT_ID'), secret = env('LINEAR_CLIENT_SECRET');
    if (!id || !secret) throw new Error('LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET ausentes');
    const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri, grant_type: 'authorization_code' });
    const res = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error_description || d.error || 'Linear token exchange failed');
    return { access_token: d.access_token, scope: d.scope, token_type: d.token_type, expires_at: expireFrom(d.expires_in) };
  }

  if (provider === 'asana') {
    const id = env('ASANA_CLIENT_ID'), secret = env('ASANA_CLIENT_SECRET');
    if (!id || !secret) throw new Error('ASANA_CLIENT_ID / ASANA_CLIENT_SECRET ausentes');
    const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri, grant_type: 'authorization_code' });
    const res = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error_description || d.error || 'Asana token exchange failed');
    return { access_token: d.access_token, refresh_token: d.refresh_token ?? null, token_type: d.token_type, expires_at: expireFrom(d.expires_in) };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const { code, provider, redirect_uri } = await req.json().catch(() => ({}));
    if (!code || !provider || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code, provider or redirect_uri' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: TokenResult;
    try {
      result = await exchangeToken(provider, code, redirect_uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Token exchange failed';
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: upsertErr } = await admin
      .from('oauth_tokens')
      .upsert(
        {
          user_id: userId, provider,
          access_token: result.access_token,
          refresh_token: result.refresh_token ?? null,
          scope: result.scope ?? null,
          token_type: result.token_type ?? null,
          expires_at: result.expires_at ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch a lightweight identity for account_label (best effort, ignore errors)
    let accountLabel: string | null = null;
    try {
      if (provider === 'github') {
        const r = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${result.access_token}`, Accept: 'application/vnd.github+json' },
        });
        if (r.ok) { const d = await r.json(); accountLabel = d.login ? `@${d.login}` : d.name ?? null; }
      } else if (provider === 'google') {
        const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        if (r.ok) { const d = await r.json(); accountLabel = d.email ?? null; }
      } else if (provider === 'lovable') {
        const r = await fetch('https://api.lovable.dev/api/v1/me', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        if (r.ok) { const d = await r.json(); accountLabel = d?.email ?? d?.name ?? null; }
      } else if (provider === 'slack') {
        const r = await fetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        const d = await r.json(); if (d.ok) accountLabel = d.team ?? d.user ?? null;
      } else if (provider === 'linear') {
        const r = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${result.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ viewer { name email } }' }),
        });
        const d = await r.json(); accountLabel = d?.data?.viewer?.email ?? d?.data?.viewer?.name ?? null;
      } else if (provider === 'asana') {
        const r = await fetch('https://app.asana.com/api/1.0/users/me', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        if (r.ok) { const d = await r.json(); accountLabel = d?.data?.email ?? d?.data?.name ?? null; }
      }
    } catch { /* ignore identity errors */ }

    await admin.from('user_connectors').upsert(
      {
        user_id: userId,
        provider,
        status: 'connected',
        account_label: accountLabel,
        scopes: result.scope ?? null,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
