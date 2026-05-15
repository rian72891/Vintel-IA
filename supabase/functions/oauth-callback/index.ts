import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    const body = await req.json().catch(() => ({}));
    const { code, provider, redirect_uri } = body as {
      code?: string; provider?: string; redirect_uri?: string;
    };

    if (!code || !provider || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code, provider or redirect_uri' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let access_token = '';
    let refresh_token: string | null = null;
    let scope: string | null = null;
    let token_type: string | null = null;
    let expires_at: string | null = null;

    if (provider === 'github') {
      const clientId = Deno.env.get('GITHUB_CLIENT_ID');
      const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'GitHub credentials not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error_description || 'Token exchange failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      access_token = tokenData.access_token;
      refresh_token = tokenData.refresh_token ?? null;
      scope = tokenData.scope ?? null;
      token_type = tokenData.token_type ?? null;
    } else if (provider === 'google_drive' || provider === 'gmail') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Google credentials not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
      });
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: tokenData.error_description || 'Token exchange failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      access_token = tokenData.access_token;
      refresh_token = tokenData.refresh_token ?? null;
      scope = tokenData.scope ?? null;
      token_type = tokenData.token_type ?? null;
      if (tokenData.expires_in) {
        expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save tokens with service role to bypass RLS for INSERT/UPDATE.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: upsertErr } = await admin
      .from('oauth_tokens')
      .upsert(
        { user_id: userId, provider, access_token, refresh_token, scope, token_type, expires_at, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,provider' },
      );
    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh user_connectors row (no unique constraint, so delete + insert).
    await admin.from('user_connectors').delete().eq('user_id', userId).eq('provider', provider);
    await admin.from('user_connectors').insert({ user_id: userId, provider, status: 'connected' });

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
