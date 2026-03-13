import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, email } = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "user_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if subscription already exists and is active
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, plan: existing.plan, status: "already_active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check profiles table for plan info
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user_id)
      .single();

    if (profile && profile.plan !== "free") {
      // Profile has a plan but subscription record is missing - sync it
      const now = new Date().toISOString();
      await supabase.from("subscriptions").upsert({
        user_id,
        email: email.toLowerCase(),
        plan: profile.plan,
        status: "active",
        updated_at: now,
      }, { onConflict: "user_id" });

      await supabase.from("usage_limits").upsert({
        user_id,
        plan: profile.plan,
      }, { onConflict: "user_id" });

      return new Response(
        JSON.stringify({ success: true, plan: profile.plan, status: "synced_from_profile" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, status: "no_active_subscription", message: "Nenhuma assinatura ativa encontrada. Se você acabou de pagar, aguarde alguns segundos e tente novamente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SYNC-SUB] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
