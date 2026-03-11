import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => { body[key] = value; });
    } else {
      body = await req.json();
    }

    const email = body.email;
    const event = body.resource_name || body.event || "sale";
    const gumroadSubId = body.subscription_id || body.sale_id || "";
    const productPermalink = body.product_permalink || body.short_product_id || "";

    console.log(`[GUMROAD-WEBHOOK] Event: ${event}, Email: ${email}, Product: ${productPermalink}`);

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Determine plan from product permalink
    let plan = "starter";
    if (productPermalink.includes("pro")) plan = "pro";
    else if (productPermalink.includes("agency")) plan = "agency";

    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find((u: any) => u.email === email);

    if (!user) {
      console.log(`[GUMROAD-WEBHOOK] User not found for email: ${email}`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const now = new Date().toISOString();

    if (event === "sale" || event === "subscription_reactivated") {
      // Upsert subscription as active
      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          email,
          plan,
          status: "active",
          gumroad_subscription_id: gumroadSubId,
          updated_at: now,
        }, { onConflict: "user_id" });

      if (error) console.error("[GUMROAD-WEBHOOK] Upsert error:", error);

      // Update profile plan
      await supabase.from("profiles").update({ plan }).eq("id", user.id);

      // Update usage limits plan
      await supabase.from("usage_limits").update({ plan }).eq("user_id", user.id);

      console.log(`[GUMROAD-WEBHOOK] Subscription activated: ${plan} for ${email}`);
    } else if (event === "subscription_ended" || event === "subscription_cancelled" || event === "refund") {
      // Deactivate subscription
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: now })
        .eq("user_id", user.id);

      await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      await supabase.from("usage_limits").update({ plan: "free" }).eq("user_id", user.id);

      console.log(`[GUMROAD-WEBHOOK] Subscription cancelled for ${email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GUMROAD-WEBHOOK] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
