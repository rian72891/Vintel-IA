import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

export const IMAGE_LIMITS: Record<string, number> = { free: 3, starter: 20, pro: 100, agency: Infinity };
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const PLAN_LIMIT_MESSAGE = "Você atingiu o limite de imagens do seu plano neste mês.";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image";

// Gerador gratuito, sem chave e sem cartão. Limite público: ~1 imagem nova por
// minuto (mesmas requisições repetidas vêm do cache e saem na hora).
const FREE_BASE = "https://image.pollinations.ai/prompt";
const FREE_MODEL = "flux";
const FREE_ATTEMPTS = 3;
const FREE_WAIT_MS = 18000;

type ImageResult = { imageUrl: string; description?: string; model: string; free?: boolean };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function bufToBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Baixa uma imagem (url http(s) ou data URL) e devolve base64 + mimeType. */
async function toInlineData(src: string): Promise<{ data: string; mimeType: string }> {
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error("Data URL inválida para edição de imagem");
    return { mimeType: match[1], data: match[2] };
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error("Não foi possível baixar a imagem para edição");
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  return { mimeType, data: bufToBase64(buf) };
}

/** POST no Gemini com retry exponencial (1s, 2s, 4s) em 503/UNAVAILABLE. */
async function geminiFetch(url: string, init: RequestInit) {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < 3 && res.status === 503; attempt++) {
    const delay = 1000 * Math.pow(2, attempt);
    console.warn(`Gemini 503 (UNAVAILABLE). Retry ${attempt + 1}/3 em ${delay}ms`);
    await sleep(delay);
    res = await fetch(url, init);
  }
  return res;
}

type GeminiOutcome =
  | { ok: true; result: ImageResult }
  | { ok: false; reason: "quota" | "overload" | "text" | "error"; message: string };

async function tryGemini(
  prompt: string,
  quality: string,
  editImageUrl: string | undefined,
  apiKey: string
): Promise<GeminiOutcome> {
  const parts: any[] = [];

  if (editImageUrl) {
    parts.push({ text: prompt || "Improve this image" });
    const inline = await toInlineData(editImageUrl);
    parts.push({ inlineData: inline });
  } else {
    parts.push({
      text:
        quality === "hd"
          ? `Create a high quality, detailed image: ${prompt}. Professional composition and lighting.`
          : prompt,
    });
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      // "hd" pede mais esmero ao modelo; "fast" mantém o padrão rápido
      temperature: quality === "hd" ? 0.9 : 0.7,
    },
  };

  const response = await geminiFetch(`${GEMINI_BASE}/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    return {
      ok: false,
      reason: "quota",
      message: "A cota de geração de imagens do Gemini está esgotada no momento.",
    };
  }
  if (response.status === 503) {
    return {
      ok: false,
      reason: "overload",
      message: "O serviço de imagens do Gemini está sobrecarregado.",
    };
  }
  if (!response.ok) {
    const t = await response.text();
    console.error("Gemini image error:", response.status, t.slice(0, 400));
    return { ok: false, reason: "error", message: "Erro ao gerar imagem no Gemini." };
  }

  const data = await response.json();
  const respParts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = respParts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  const textResponse = respParts
    .map((p: any) => p.text)
    .filter(Boolean)
    .join("\n");

  if (!inlineData?.data) {
    console.warn("Model returned text instead of image:", textResponse?.slice(0, 300));
    return {
      ok: false,
      reason: "text",
      message:
        "O modelo respondeu com texto em vez de gerar uma imagem. Reformule o prompt de forma mais visual e descritiva (ex.: \"foto realista de...\", \"ilustração de...\", \"pôster com...\").",
    };
  }

  const mime = inlineData.mimeType || inlineData.mime_type || "image/png";
  return {
    ok: true,
    result: {
      imageUrl: `data:${mime};base64,${inlineData.data}`,
      description: textResponse,
      model: IMAGE_MODEL,
    },
  };
}

/**
 * Gerador gratuito (sem chave, sem cartão). Quando a cota do Gemini acaba, a
 * imagem sai daqui em vez de virar erro. O limite público é apertado: se der
 * "pagamento exigido", espera e tenta de novo algumas vezes.
 */
async function tryFreeGenerator(
  prompt: string,
  quality: string
): Promise<{ ok: true; result: ImageResult } | { ok: false; message: string }> {
  const size = quality === "hd" ? 1024 : 768;
  // 12% a mais de altura: a faixa extra embaixo carrega a marca d'água e é
  // cortada no app (src/lib/generateImage.ts) antes de mostrar a imagem.
  const reqH = Math.round(size * 1.12);
  const text =
    quality === "hd"
      ? `high quality, highly detailed, professional composition and lighting: ${prompt}`
      : prompt;
  const base = `${FREE_BASE}/${encodeURIComponent(text)}`;

  for (let attempt = 0; attempt < FREE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(FREE_WAIT_MS);

    const url =
      `${base}?width=${size}&height=${reqH}` +
      `&model=${FREE_MODEL}&nologo=true&seed=${Math.floor(Math.random() * 1_000_000)}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(50_000) });
    } catch (e) {
      console.warn(`Gerador gratuito falhou (tentativa ${attempt + 1}):`, e);
      continue;
    }

    const ctype = res.headers.get("content-type") || "";
    if (res.ok && ctype.startsWith("image/")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return {
        ok: true,
        result: {
          imageUrl: `data:${ctype};base64,${bufToBase64(buf)}`,
          description: "",
          model: `${FREE_MODEL} (gerador gratuito)`,
          free: true,
        },
      };
    }
    console.warn(`Gerador gratuito indisponível: HTTP ${res.status} ${ctype}`);
  }

  return {
    ok: false,
    message:
      "O gerador gratuito está congestionado agora (ele libera cerca de 1 imagem por minuto). Tente de novo em um instante, ou ative o faturamento no Google AI Studio para gerar sem esse limite.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Faça login para gerar imagens." }, 401);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: claims, error: authError } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub;
    if (authError || typeof userId !== "string" || !userId) return json({ error: "Faça login para gerar imagens." }, 401);

    const { prompt, quality, editImageUrl } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim()) {
      return json({ error: "Descreva a imagem que você quer gerar." }, 400);
    }
    if (editImageUrl !== undefined && typeof editImageUrl !== "string") return json({ error: "Imagem para edição inválida." }, 400);
    const q = quality === "hd" ? "hd" : "fast";

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: sub, error: subError } = await admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle();
    if (subError) throw new Error("Não foi possível verificar seu plano.");
    let plan = "free";
    if (sub?.status === "active" && sub.plan) plan = sub.plan;
    else {
      const { data: profile, error } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
      if (error) throw new Error("Não foi possível verificar seu plano.");
      if (profile?.plan) plan = profile.plan;
    }
    const limit = IMAGE_LIMITS[plan] ?? IMAGE_LIMITS.free;
    const now = new Date().toISOString();
    let { data: usage, error: usageError } = await admin.from("usage_limits").select("id, images_used, reset_date").eq("user_id", userId).maybeSingle();
    if (usageError) throw new Error("Não foi possível verificar seu uso de imagens.");
    if (!usage) {
      const { error } = await admin.from("usage_limits").upsert({ user_id: userId, plan, reset_date: now, messages_reset_date: now }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error("Não foi possível iniciar seu uso de imagens.");
      const loaded = await admin.from("usage_limits").select("id, images_used, reset_date").eq("user_id", userId).single();
      if (loaded.error || !loaded.data) throw new Error("Não foi possível verificar seu uso de imagens.");
      usage = loaded.data;
    }
    if (Date.now() - new Date(usage.reset_date).getTime() > MONTH_MS) {
      const reset = await admin.from("usage_limits").update({ images_used: 0, files_used: 0, audio_minutes_used: 0, image_analyses_used: 0, reset_date: now })
        .eq("id", usage.id).eq("reset_date", usage.reset_date).select("id, images_used, reset_date").maybeSingle();
      if (reset.error) throw new Error("Não foi possível renovar seu uso de imagens.");
      const fresh = await admin.from("usage_limits").select("id, images_used, reset_date").eq("user_id", userId).single();
      if (fresh.error || !fresh.data) throw new Error("Não foi possível verificar seu uso de imagens.");
      usage = fresh.data;
    }
    if (usage.images_used >= limit) return json({ error: PLAN_LIMIT_MESSAGE, code: "image_plan_limit" }, 429);

    // Compare-and-swap prevents concurrent successful requests from losing increments.
    const recordSuccess = async (result: ImageResult) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const current = await admin.from("usage_limits").select("id, images_used, reset_date").eq("user_id", userId).single();
        if (current.error || !current.data) throw new Error("Não foi possível registrar seu uso de imagens.");
        const updated = await admin.from("usage_limits").update({ images_used: current.data.images_used + 1 })
          .eq("id", current.data.id).eq("images_used", current.data.images_used).eq("reset_date", current.data.reset_date)
          .select("id").maybeSingle();
        if (updated.error) throw new Error("Não foi possível registrar seu uso de imagens.");
        if (updated.data) return json(result);
      }
      throw new Error("Não foi possível registrar seu uso de imagens. Tente novamente.");
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const gemini = GEMINI_API_KEY
      ? await tryGemini(prompt, q, editImageUrl, GEMINI_API_KEY)
      : { ok: false as const, reason: "error" as const, message: "Sem chave do Gemini." };

    if (gemini.ok) return await recordSuccess(gemini.result);

    // Edição de imagem precisa do Gemini (o gerador gratuito não edita).
    if (editImageUrl) return json({ error: gemini.message });

    const free = await tryFreeGenerator(prompt, q);
    if (!free.ok) return json({ error: free.message });
    return await recordSuccess(free.result);
  } catch (e) {
    console.error("generate-image error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Erro desconhecido" },
      500
    );
  }
});
