import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LS_KEY = 'vintel:connected_providers';

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeCache(list: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function useConnectors() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<Set<string>>(() => new Set(readCache()));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setConnected(new Set());
      writeCache([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_connectors')
      .select('provider, status')
      .eq('user_id', user.id);
    const next = (data ?? [])
      .filter((d) => d.status === 'connected')
      .map((d) => d.provider);
    setConnected(new Set(next));
    writeCache(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setConnected(new Set(readCache()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { connected, loading, refresh };
}
