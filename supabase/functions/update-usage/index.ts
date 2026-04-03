import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Create a client with the user's JWT to get user identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for actual DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { action, type, amount, plan } = await req.json();

    if (action === "increment") {
      // Validate type
      const validTypes = ["messages_used", "images_used", "files_used", "audio_minutes_used", "image_analyses_used"];
      if (!validTypes.includes(type)) {
        return new Response(JSON.stringify({ error: "Invalid usage type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const incrementAmount = Math.max(1, Math.floor(Number(amount) || 1));

      // Use RPC-style: read current value then update atomically
      const { data: current } = await supabase
        .from("usage_limits")
        .select(type)
        .eq("user_id", user.id)
        .single();

      if (!current) {
        return new Response(JSON.stringify({ error: "No usage record found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newVal = ((current as Record<string, number>)[type] || 0) + incrementAmount;
      await supabase
        .from("usage_limits")
        .update({ [type]: newVal })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, [type]: newVal }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_check") {
      // Handle daily/monthly resets server-side
      const { data } = await supabase
        .from("usage_limits")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) {
        // Create usage record
        const now = new Date().toISOString();
        const { data: newData } = await supabase
          .from("usage_limits")
          .insert({
            user_id: user.id,
            plan: plan || "free",
            messages_used: 0,
            images_used: 0,
            files_used: 0,
            audio_minutes_used: 0,
            image_analyses_used: 0,
            messages_reset_date: now,
            reset_date: now,
          })
          .select()
          .single();

        return new Response(JSON.stringify({ success: true, data: newData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const messagesResetDate = new Date(data.messages_reset_date);
      const needsMessageReset = now.toDateString() !== messagesResetDate.toDateString();
      const resetDate = new Date(data.reset_date);
      const needsMonthlyReset = now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000;

      if (needsMessageReset || needsMonthlyReset) {
        const updates: Record<string, unknown> = {};
        if (needsMessageReset) {
          updates.messages_used = 0;
          updates.messages_reset_date = now.toISOString();
        }
        if (needsMonthlyReset) {
          updates.images_used = 0;
          updates.files_used = 0;
          updates.audio_minutes_used = 0;
          updates.image_analyses_used = 0;
          updates.reset_date = now.toISOString();
        }

        await supabase
          .from("usage_limits")
          .update(updates)
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true, data: { ...data, ...updates } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[UPDATE-USAGE] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
