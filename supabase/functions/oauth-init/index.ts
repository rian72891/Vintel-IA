import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Cfg = { authUrl: string; scope: string; extra?: Record<string, string>; clientIdEnv: string };

const PROVIDERS: Record<string, Cfg> = {
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'repo workflow read:user delete_repo',
    clientIdEnv: 'GITHUB_CLIENT_ID',
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    extra: { response_type: 'code', access_type: 'offline', prompt: 'consent' },
    clientIdEnv: 'GOOGLE_CLIENT_ID',
  },
  lovable: {
    authUrl: 'https://app.lovable.dev/oauth/authorize',
    scope: 'projects:read projects:write',
    extra: { response_type: 'code' },
    clientIdEnv: 'LOVABLE_CLIENT_ID',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { provider, redirect_uri } = await req.json().catch(() => ({}));
    if (!provider || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing provider or redirect_uri' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfg = PROVIDERS[provider];
    if (!cfg) {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get(cfg.clientIdEnv);
    if (!clientId) {
      return new Response(JSON.stringify({
        error: `${provider} OAuth não configurado. Adicione ${cfg.clientIdEnv} e ${cfg.clientIdEnv.replace('CLIENT_ID', 'CLIENT_SECRET')} nas configurações de Backend.`,
      }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const u = new URL(cfg.authUrl);
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirect_uri);
    if (cfg.scope) u.searchParams.set('scope', cfg.scope);
    if (cfg.extra) for (const [k, v] of Object.entries(cfg.extra)) u.searchParams.set(k, v);

    return new Response(JSON.stringify({ url: u.toString() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
