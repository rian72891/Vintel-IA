import type { BackgroundTask } from '@/hooks/useBackgroundTasks';

export function getBackgroundTaskTitle(task: BackgroundTask): string {
  const input = task.input as { title?: unknown; prompt?: unknown } | null;
  if (typeof input?.title === 'string' && input.title.trim()) return input.title.trim();
  if (typeof input?.prompt === 'string' && input.prompt.trim()) return input.prompt.trim();
  return 'Tarefa em segundo plano';
}

export function getBackgroundTaskSummary(task: BackgroundTask): string {
  const result = task.result as { content?: unknown; error?: unknown; summary?: unknown } | null;
  if (typeof result?.summary === 'string' && result.summary.trim()) return result.summary.trim();
  if (typeof result?.content === 'string' && result.content.trim()) return result.content.trim().slice(0, 180);
  if (typeof result?.error === 'string' && result.error.trim()) return result.error.trim();
  if (task.status === 'waiting_confirmation') return 'A tarefa está pausada até você confirmar a ação solicitada.';
  return task.status === 'running' ? 'Processando em segundo plano…' : 'Sem resumo disponível.';
}

export async function requestBackgroundNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export function notifyBackgroundTask(task: BackgroundTask): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  const completed = task.status === 'completed';
  const title = completed ? 'Tarefa concluída' : 'Tarefa com falha';
  const options: NotificationOptions = {
    body: `${getBackgroundTaskTitle(task)}\n${getBackgroundTaskSummary(task)}`,
    tag: `background-task-${task.id}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { taskId: task.id, conversationId: task.conversation_id },
  };

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => new Notification(title, options));
    return;
  }

  const notification = new Notification(title, options);

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
