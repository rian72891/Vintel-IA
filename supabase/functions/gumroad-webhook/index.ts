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
    // Always read body as text first to avoid "Unexpected end of JSON input"
    const rawBody = await req.text();
    console.log(`[GUMROAD-WEBHOOK] Raw body length: ${rawBody.length}`);
    console.log(`[GUMROAD-WEBHOOK] Content-Type: ${req.headers.get("content-type")}`);

    if (!rawBody || rawBody.trim().length === 0) {
      console.log("[GUMROAD-WEBHOOK] Empty body received");
      return new Response(JSON.stringify({ error: "Empty body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let body: Record<string, string> = {};

    // Try form-urlencoded first (Gumroad default), then JSON
    try {
      const params = new URLSearchParams(rawBody);
      // Check if it actually parsed as form data (has at least email or seller_id)
      if (params.get("email") || params.get("seller_id") || params.get("product_id")) {
        params.forEach((value, key) => { body[key] = value; });
        console.log("[GUMROAD-WEBHOOK] Parsed as form-urlencoded");
      } else {
        throw new Error("Not form data");
      }
    } catch {
      try {
        body = JSON.parse(rawBody);
        console.log("[GUMROAD-WEBHOOK] Parsed as JSON");
      } catch {
        console.error("[GUMROAD-WEBHOOK] Failed to parse body as form-data or JSON");
        return new Response(JSON.stringify({ error: "Invalid body format" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // NOTE: Gumroad webhook is intentionally unsigned by user choice.

    // Extract fields - Gumroad uses different field names depending on event
    const email = body.email || body.purchaser_email || "";
    const event = body.resource_name || body.event || "sale";
    const gumroadSubId = body.subscription_id || body.sale_id || "";
    const productPermalink = body.product_permalink || body.short_product_id || body.product_id || "";
    const productName = body.product_name || "";

    console.log(`[GUMROAD-WEBHOOK] Event: ${event}`);
    console.log(`[GUMROAD-WEBHOOK] Email: ${email}`);
    console.log(`[GUMROAD-WEBHOOK] Product: ${productPermalink}`);
    console.log(`[GUMROAD-WEBHOOK] Product Name: ${productName}`);
    console.log(`[GUMROAD-WEBHOOK] Subscription ID: ${gumroadSubId}`);

    if (!email) {
      console.error("[GUMROAD-WEBHOOK] No email found in payload");
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

    // Determine plan from product permalink or product name
    const combined = `${productPermalink} ${productName}`.toLowerCase();
    let plan = "starter";
    if (combined.includes("agency")) plan = "agency";
    else if (combined.includes("pro")) plan = "pro";
    else if (combined.includes("starter")) plan = "starter";

    console.log(`[GUMROAD-WEBHOOK] Determined plan: ${plan}`);

    // Find user by email using admin API
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("[GUMROAD-WEBHOOK] Error listing users:", listError);
      return new Response(JSON.stringify({ error: "Failed to list users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const user = usersData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.error(`[GUMROAD-WEBHOOK] User not found for email: ${email}`);
      // Still return 200 to prevent Gumroad retries
      return new Response(JSON.stringify({ error: "User not found", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[GUMROAD-WEBHOOK] Found user: ${user.id}`);
    const now = new Date().toISOString();

    if (event === "sale" || event === "subscription_reactivated" || event === "ping") {
      // Upsert subscription as active
      const { error: upsertError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          email: email.toLowerCase(),
          plan,
          status: "active",
          gumroad_subscription_id: gumroadSubId,
          updated_at: now,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("[GUMROAD-WEBHOOK] Upsert error:", upsertError);
      } else {
        console.log("[GUMROAD-WEBHOOK] Subscription upserted successfully");
      }

      // Update profile plan
      const { error: profileError } = await supabase.from("profiles").update({ plan }).eq("id", user.id);
      if (profileError) console.error("[GUMROAD-WEBHOOK] Profile update error:", profileError);

      // Update or create usage limits
      const { data: existingUsage } = await supabase
        .from("usage_limits")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingUsage) {
        await supabase.from("usage_limits").update({ plan }).eq("user_id", user.id);
      } else {
        await supabase.from("usage_limits").insert({
          user_id: user.id,
          plan,
          messages_used: 0,
          images_used: 0,
          files_used: 0,
          audio_minutes_used: 0,
          image_analyses_used: 0,
        });
      }

      console.log(`[GUMROAD-WEBHOOK] ✅ Subscription ACTIVATED: ${plan} for ${email}`);
    } else if (event === "subscription_ended" || event === "subscription_cancelled" || event === "refund" || event === "dispute" || event === "cancellation") {
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: now })
        .eq("user_id", user.id);

      await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      await supabase.from("usage_limits").update({ plan: "free" }).eq("user_id", user.id);

      console.log(`[GUMROAD-WEBHOOK] ❌ Subscription CANCELLED for ${email}`);
    }

    // Always return 200 to prevent Gumroad retries
    return new Response(JSON.stringify({ success: true, plan, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GUMROAD-WEBHOOK] CRITICAL Error:", msg);
    // Return 200 even on error to prevent infinite retries
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
