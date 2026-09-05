// Tests an active connector by hitting a lightweight provider endpoint
// and updates user_connectors with last_synced_at / last_error / account_label.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogle(refresh_token: string) {
  const id = Deno.env.get("GOOGLE_CLIENT_ID");
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) return null;
  const body = new URLSearchParams({
    client_id: id, client_secret: secret, refresh_token, grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) return null;
  return {
    access_token: d.access_token as string,
    expires_at: new Date(Date.now() + (d.expires_in ?? 3600) * 1000).toISOString(),
  };
}

async function probe(provider: string, token: string): Promise<{ ok: boolean; label?: string; error?: string }> {
  try {
    if (provider === "github") {
      const r = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!r.ok) return { ok: false, error: `GitHub ${r.status}` };
      const d = await r.json();
      return { ok: true, label: d.login ? `@${d.login}` : d.name };
    }
    if (provider === "google") {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return { ok: false, error: `Google ${r.status}` };
      const d = await r.json();
      return { ok: true, label: d.email };
    }
    if (provider === "lovable") {
      const r = await fetch("https://api.lovable.dev/api/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return { ok: false, error: `Lovable ${r.status}` };
      const d = await r.json();
      return { ok: true, label: d?.email || d?.name };
    }

    return { ok: false, error: `provider ${provider} não suportado` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "probe error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = await req.json().catch(() => ({}));
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tok } = await admin.from("oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId).eq("provider", provider).maybeSingle();

    if (!tok?.access_token) {
      await admin.from("user_connectors").upsert({
        user_id: userId, provider, status: "error",
        last_error: "Token não encontrado. Reconecte.",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });
      return new Response(JSON.stringify({ ok: false, error: "Token não encontrado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let token = tok.access_token;
    if (provider === "google" && tok.expires_at && new Date(tok.expires_at).getTime() < Date.now() + 60_000) {
      if (tok.refresh_token) {
        const refreshed = await refreshGoogle(tok.refresh_token);
        if (refreshed) {
          token = refreshed.access_token;
          await admin.from("oauth_tokens").update({
            access_token: refreshed.access_token,
            expires_at: refreshed.expires_at,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId).eq("provider", provider);
        }
      }
    }

    const result = await probe(provider, token);

    await admin.from("user_connectors").upsert({
      user_id: userId,
      provider,
      status: result.ok ? "connected" : "error",
      account_label: result.ok ? (result.label ?? null) : undefined,
      last_synced_at: result.ok ? new Date().toISOString() : undefined,
      last_error: result.ok ? null : (result.error ?? "Falha desconhecida"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
