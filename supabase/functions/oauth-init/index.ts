import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { provider, redirect_uri } = body as { provider?: string; redirect_uri?: string };

    if (!provider || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing provider or redirect_uri' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url: string;

    if (provider === 'github') {
      const clientId = Deno.env.get('GITHUB_CLIENT_ID');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'GitHub not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const u = new URL('https://github.com/login/oauth/authorize');
      u.searchParams.set('client_id', clientId);
      u.searchParams.set('redirect_uri', redirect_uri);
      u.searchParams.set('scope', 'repo read:user');
      url = u.toString();
    } else if (provider === 'google_drive' || provider === 'gmail') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'Google not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const scope = provider === 'gmail'
        ? 'https://www.googleapis.com/auth/gmail.readonly'
        : 'https://www.googleapis.com/auth/drive.readonly';
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('client_id', clientId);
      u.searchParams.set('redirect_uri', redirect_uri);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('scope', scope);
      u.searchParams.set('access_type', 'offline');
      u.searchParams.set('prompt', 'consent');
      url = u.toString();
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
