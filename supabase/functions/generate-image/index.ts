import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image";

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
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return { mimeType, data: btoa(binary) };
}

/** POST no Gemini com retry exponencial (1s, 2s, 4s) em 503/UNAVAILABLE. */
async function geminiFetch(url: string, init: RequestInit) {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < 3 && res.status === 503; attempt++) {
    const delay = 1000 * Math.pow(2, attempt);
    console.warn(`Gemini 503 (UNAVAILABLE). Retry ${attempt + 1}/3 em ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(url, init);
  }
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, quality, editImageUrl } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos e tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 503) {
      return new Response(
        JSON.stringify({ error: "O serviço de imagens está sobrecarregado. Tente novamente em instantes." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini image error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar imagem. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({
          error:
            "O modelo respondeu com texto em vez de gerar uma imagem. Reformule o prompt de forma mais visual e descritiva (ex.: \"foto realista de...\", \"ilustração de...\", \"pôster com...\").",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mime = inlineData.mimeType || inlineData.mime_type || "image/png";
    const imageUrl = `data:${mime};base64,${inlineData.data}`;

    return new Response(
      JSON.stringify({ imageUrl, description: textResponse, model: IMAGE_MODEL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
