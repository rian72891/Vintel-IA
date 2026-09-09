import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { notifyBackgroundTask } from '@/lib/backgroundNotifications';

export type BackgroundTask = {
  id: string;
  user_id?: string;
  conversation_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | string;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const notifiedTaskIds = new Set<string>();
const TASK_LIMIT = 100;

/**
 * Sincroniza tarefas em background com Realtime e polling resiliente.
 * A Notification API funciona enquanto a página/app estiver vivo, inclusive
 * em outra aba ou minimizado. Push com navegador completamente fechado exige
 * push server-side/VAPID, que não pode ser implementado apenas no frontend.
 */
export function useBackgroundTasks(conversationId?: string | null, onCompleted?: (task: BackgroundTask) => void) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'offline' | 'polling'>('connecting');
  const seenStatuses = useRef<Map<string, string>>(new Map());
  const onCompletedRef = useRef(onCompleted);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  onCompletedRef.current = onCompleted;

  const handleTask = useCallback((task: BackgroundTask, notify = true) => {
    const previousStatus = seenStatuses.current.get(task.id);
    seenStatuses.current.set(task.id, task.status);
    setTasks((previous) => {
      const next = previous.filter((item) => item.id !== task.id);
      return [task, ...next].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    });

    const isTerminal = task.status === 'completed' || task.status === 'failed';
    const transitioned = previousStatus !== undefined && previousStatus !== task.status;
    if (notify && isTerminal && (transitioned || !notifiedTaskIds.has(task.id))) {
      notifiedTaskIds.add(task.id);
      notifyBackgroundTask(task);
      onCompletedRef.current?.(task);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([]);
      return;
    }
    const { data, error } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(TASK_LIMIT);

    if (error) {
      setConnectionState(navigator.onLine ? 'polling' : 'offline');
      return;
    }

    const incoming = ((data as unknown[]) ?? []) as BackgroundTask[];
    const initialSync = seenStatuses.current.size === 0;
    incoming.forEach((task) => handleTask(task, !initialSync));
    setTasks(incoming);
    setConnectionState('connected');
  }, [handleTask, user]);

  const subscribe = useCallback(() => {
    if (!user) return;
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    setConnectionState(navigator.onLine ? 'connecting' : 'offline');

    const channel = supabase
      .channel(`background_tasks_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'background_tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string };
            if (deleted.id) setTasks((previous) => previous.filter((task) => task.id !== deleted.id));
            return;
          }
          handleTask(payload.new as BackgroundTask);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionState('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionState(navigator.onLine ? 'polling' : 'offline');
          if (navigator.onLine && reconnectTimerRef.current === null) {
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              void refresh();
              subscribe();
            }, 3000);
          }
        }
      });
    channelRef.current = channel;
  }, [handleTask, refresh, user]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    void refresh();
    subscribe();
    const interval = window.setInterval(() => void refresh(), 15000);
    const handleOnline = () => {
      void refresh();
      subscribe();
    };
    const handleOffline = () => setConnectionState('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [refresh, subscribe, user]);

  const visibleTasks = conversationId
    ? tasks.filter((task) => task.conversation_id === conversationId)
    : tasks;
  const running = visibleTasks.filter((task) => task.status === 'running');

  return {
    tasks: visibleTasks,
    running,
    hasRunning: running.length > 0,
    connectionState,
    refresh,
  };
}
