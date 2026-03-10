import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[GUMROAD-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Webhook received");

    const formData = await req.formData();
    const email = formData.get("email")?.toString() || formData.get("purchaser_email")?.toString();
    const productName = formData.get("product_name")?.toString() || "";
    const subscriptionId = formData.get("subscription_id")?.toString() || formData.get("sale_id")?.toString() || "";
    const resourceName = formData.get("resource_name")?.toString() || "";

    log("Parsed data", { email, productName, resourceName, subscriptionId });

    if (!email) {
      throw new Error("No email in webhook payload");
    }

    // Determine plan from product name
    let plan = "starter";
    const nameLower = productName.toLowerCase();
    if (nameLower.includes("agency")) plan = "agency";
    else if (nameLower.includes("pro")) plan = "pro";
    else if (nameLower.includes("starter")) plan = "starter";

    // Determine status from resource_name (event type)
    let status = "active";
    if (resourceName === "subscription_ended" || resourceName === "subscription_cancelled") {
      status = "cancelled";
    } else if (resourceName === "refunded" || resourceName === "chargebacked") {
      status = "expired";
    }

    log("Resolved", { plan, status });

    // Find user by email
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === email);

    if (!user) {
      log("No user found for email, storing for later activation", { email });
      // Upsert subscription even without user - they'll match when they sign up
      await supabase.from("subscriptions").upsert({
        id: undefined,
        user_id: "00000000-0000-0000-0000-000000000000", // placeholder
        email,
        plan,
        status,
        gumroad_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "email" });

      return new Response(JSON.stringify({ ok: true, note: "User not found, stored by email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert subscription
    const { error } = await supabase.from("subscriptions").upsert({
      user_id: user.id,
      email,
      plan,
      status,
      gumroad_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id" });

    if (error) {
      log("Upsert error", { error: error.message });
      throw error;
    }

    // Update usage_limits plan
    if (status === "active") {
      await supabase.from("usage_limits").upsert({
        user_id: user.id,
        plan,
      } as any, { onConflict: "user_id" });
    }

    // Update profile plan field
    await supabase.from("profiles").update({ plan } as any).eq("id", user.id);

    log("Subscription updated", { userId: user.id, plan, status });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
