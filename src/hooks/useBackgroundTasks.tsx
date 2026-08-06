import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type BackgroundTask = {
  id: string;
  conversation_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  input: any;
  result: any;
  created_at: string;
  updated_at: string;
};

/**
 * Acompanha tarefas do agente que continuam rodando na edge function
 * mesmo depois que o app é fechado. Usa Realtime com fallback de polling.
 */
export function useBackgroundTasks(conversationId?: string | null, onCompleted?: (task: BackgroundTask) => void) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const seenCompleted = useRef<Set<string>>(new Set());
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const handleTask = useCallback((t: BackgroundTask) => {
    setTasks((prev) => {
      const others = prev.filter((p) => p.id !== t.id);
      return t.status === 'running' ? [...others, t] : others;
    });
    if (t.status !== 'running' && !seenCompleted.current.has(t.id)) {
      seenCompleted.current.add(t.id);
      onCompletedRef.current?.(t);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(20);
    setTasks(((data as any[]) ?? []) as BackgroundTask[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();

    const channel = supabase
      .channel(`background_tasks_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'background_tasks', filter: `user_id=eq.${user.id}` },
        (payload) => handleTask(payload.new as BackgroundTask),
      )
      .subscribe();

    // Fallback de polling (caso o Realtime não esteja disponível)
    const interval = window.setInterval(refresh, 15000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [user, refresh, handleTask]);

  const running = conversationId
    ? tasks.filter((t) => t.conversation_id === conversationId)
    : tasks;

  return { tasks, running, hasRunning: running.length > 0, refresh };
}
