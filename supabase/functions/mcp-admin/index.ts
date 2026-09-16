import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isPrivateIpv4(ip: string) {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 0;
}

function isPrivateIp(ip: string) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (isPrivateIpv4(normalized)) return true;
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function validateMcpUrl(raw: string) {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("URL do servidor MCP inválida."); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("O servidor MCP deve usar uma URL HTTP(S) sem credenciais embutidas.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)) {
    throw new Error("Por segurança, servidores MCP em endereços locais ou privados não são permitidos.");
  }
  try {
    const records = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    if (records.flat().some(isPrivateIp)) throw new Error("O hostname do servidor MCP resolve para um endereço privado ou interno.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("endereço privado")) throw error;
    // Do not reject public hosts only because DNS is temporarily unavailable;
    // fetch will still enforce the network request timeout.
  }
  return parsed;
}

async function mcpRequest(url: string, method: string, params: unknown, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
      redirect: "error",
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Servidor MCP respondeu HTTP ${response.status}.`);
    let payload: any;
    try { payload = JSON.parse(text); } catch { throw new Error("Resposta inválida do servidor MCP."); }
    if (payload?.error) throw new Error(payload.error.message || "Erro JSON-RPC do servidor MCP.");
    return payload?.result ?? {};
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("O servidor MCP excedeu o tempo limite de 15 segundos.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function listTools(url: string, token?: string) {
  await mcpRequest(url, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vintel-ia", version: "1.0.0" },
  }, token).catch(() => undefined);
  const result = await mcpRequest(url, "tools/list", {}, token);
  return Array.isArray(result?.tools) ? result.tools.slice(0, 100) : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Faça login para gerenciar servidores MCP.");
    const verifier = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await verifier.auth.getClaims(auth.slice(7));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) throw new Error("Sessão inválida.");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await admin.from("mcp_servers").select("id, name, url, enabled, tools_cache, last_synced_at, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ servers: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "test") {
      const url = String(body?.url || "");
      const token = typeof body?.auth_token === "string" ? body.auth_token : undefined;
      await validateMcpUrl(url);
      const tools = await listTools(url, token);
      return new Response(JSON.stringify({ ok: true, tools_count: tools.length, tools: tools.map((tool: any) => ({ name: tool.name, description: tool.description })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const name = String(body?.name || "").trim();
      const url = String(body?.url || "").trim();
      const token = typeof body?.auth_token === "string" && body.auth_token.trim() ? body.auth_token.trim() : null;
      if (!name || !url) throw new Error("Nome e URL são obrigatórios.");
      await validateMcpUrl(url);
      const tools = await listTools(url, token ?? undefined);
      const { data, error } = await admin.from("mcp_servers").insert({ user_id: userId, name, url, auth_token: token, enabled: true, tools_cache: tools, last_synced_at: new Date().toISOString() }).select("id, name, url, enabled, tools_cache, last_synced_at, created_at, updated_at").single();
      if (error) throw error;
      return new Response(JSON.stringify({ server: data, tools_count: tools.length }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const id = String(body?.id || "");
    if (!id) throw new Error("Servidor MCP não informado.");
    const { data: server, error: findError } = await admin.from("mcp_servers").select("id, url, auth_token").eq("id", id).eq("user_id", userId).maybeSingle();
    if (findError || !server) throw new Error("Servidor MCP não encontrado.");

    if (action === "sync") {
      await validateMcpUrl(server.url);
      const tools = await listTools(server.url, server.auth_token ?? undefined);
      const { error } = await admin.from("mcp_servers").update({ tools_cache: tools, last_synced_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, tools_count: tools.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "toggle") {
      const { data, error } = await admin.from("mcp_servers").update({ enabled: Boolean(body?.enabled) }).eq("id", id).eq("user_id", userId).select("id, enabled").single();
      if (error) throw error;
      return new Response(JSON.stringify({ server: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "delete") {
      const { error } = await admin.from("mcp_servers").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    throw new Error("Ação MCP desconhecida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerenciar servidor MCP.";
    const status = /privad|local|inválida|obrigat|login|sessão/i.test(message) ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
