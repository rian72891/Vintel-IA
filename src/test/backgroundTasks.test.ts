import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBackgroundTaskSummary, getBackgroundTaskTitle, notifyBackgroundTask } from '@/lib/backgroundNotifications';
import type { BackgroundTask } from '@/hooks/useBackgroundTasks';

const task: BackgroundTask = {
  id: 'task-1',
  conversation_id: 'conversation-1',
  status: 'completed',
  input: { title: 'Resumo diário' },
  result: { content: 'A tarefa terminou com sucesso.' },
  created_at: new Date(Date.now() - 3000).toISOString(),
  updated_at: new Date().toISOString(),
};

describe('background task notifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(vi.fn(), { permission: 'granted' }),
    });
  });

  it('summarizes a task that completes after a short simulated run', () => {
    expect(getBackgroundTaskTitle(task)).toBe('Resumo diário');
    expect(getBackgroundTaskSummary(task)).toBe('A tarefa terminou com sucesso.');
  });

  it('uses the registered service worker to display a completion notification', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });

    notifyBackgroundTask(task);
    await Promise.resolve();

    expect(showNotification).toHaveBeenCalledWith(
      'Tarefa concluída',
      expect.objectContaining({ tag: 'background-task-task-1' }),
    );
  });

  it('describes confirmation-pending tasks without treating them as completed', () => {
    const waitingTask: BackgroundTask = {
      ...task,
      id: 'task-waiting',
      status: 'waiting_confirmation',
      result: { steps: [], awaiting_confirmation: true },
    };

    expect(getBackgroundTaskSummary(waitingTask)).toBe('A tarefa está pausada até você confirmar a ação solicitada.');
    notifyBackgroundTask(waitingTask);
    expect(window.Notification).not.toHaveBeenCalled();
  });
});
