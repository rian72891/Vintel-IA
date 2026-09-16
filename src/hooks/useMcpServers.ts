import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type McpToolSummary = { name: string; description?: string };
export type McpServer = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tools_cache: McpToolSummary[] | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type Action = 'list' | 'create' | 'test' | 'sync' | 'toggle' | 'delete';

async function invoke(action: Action, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('mcp-admin', { body: { action, ...body } });
  if (error) throw new Error(error.message || 'Não foi possível comunicar com o servidor MCP.');
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, any>;
}

export function useMcpServers(active = true) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) {
      setServers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await invoke('list');
      setServers((data.servers ?? []) as McpServer[]);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const run = useCallback(async (key: string, action: Action, body: Record<string, unknown> = {}) => {
    setBusy(key);
    try {
      const result = await invoke(action, body);
      await refresh();
      return result;
    } finally { setBusy(null); }
  }, [refresh]);

  return {
    servers,
    loading,
    busy,
    refresh,
    test: (url: string, authToken?: string) => run('test', 'test', { url, auth_token: authToken || undefined }),
    create: (name: string, url: string, authToken?: string) => run('create', 'create', { name, url, auth_token: authToken || undefined }),
    sync: (id: string) => run(id, 'sync', { id }),
    toggle: (id: string, enabled: boolean) => run(id, 'toggle', { id, enabled }),
    remove: (id: string) => run(id, 'delete', { id }),
  };
}
