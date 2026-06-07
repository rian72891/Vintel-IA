import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LS_KEY = 'vintel:connected_providers';

export type ConnectorRecord = {
  provider: string;
  status: 'connected' | 'error' | string;
  account_label: string | null;
  scopes: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function writeCache(list: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function useConnectors() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<Set<string>>(() => new Set(readCache()));
  const [records, setRecords] = useState<Record<string, ConnectorRecord>>({});
  const [loading, setLoading] = useState(true);

  const apply = useCallback((rows: ConnectorRecord[]) => {
    const map: Record<string, ConnectorRecord> = {};
    for (const r of rows) map[r.provider] = r;
    setRecords(map);
    const next = rows.filter((d) => d.status === 'connected').map((d) => d.provider);
    setConnected(new Set(next));
    writeCache(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) { setConnected(new Set()); setRecords({}); writeCache([]); setLoading(false); return; }
    const { data } = await supabase
      .from('user_connectors')
      .select('provider, status, account_label, scopes, last_synced_at, last_error')
      .eq('user_id', user.id);
    apply((data ?? []) as ConnectorRecord[]);
    setLoading(false);
  }, [user, apply]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refresh on any change to this user's connectors
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`user_connectors:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_connectors', filter: `user_id=eq.${user.id}` },
        () => { refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setConnected(new Set(readCache()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { connected, records, loading, refresh };
}
