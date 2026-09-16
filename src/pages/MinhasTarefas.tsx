import { useState } from 'react';
import { Bell, CheckCircle2, CircleAlert, Clock3, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { getBackgroundTaskSummary, getBackgroundTaskTitle, requestBackgroundNotificationPermission } from '@/lib/backgroundNotifications';
import { cn } from '@/lib/utils';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

const statusCopy = {
  running: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  waiting_confirmation: 'Aguardando sua confirmação',
};

export default function MinhasTarefas() {
  const { tasks, connectionState, refresh } = useBackgroundTasks();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const enableNotifications = async () => {
    setPermission(await requestBackgroundNotificationPermission());
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Voltar para o Vintel IA</Link>
        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Minhas tarefas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe tarefas que continuam sendo processadas em segundo plano.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {connectionState === 'offline' ? <WifiOff className="h-4 w-4 text-destructive" /> : <Wifi className="h-4 w-4 text-emerald-500" />}
            {connectionState === 'connected' ? 'Sincronizado' : connectionState === 'polling' ? 'Sincronizando por polling' : connectionState === 'offline' ? 'Sem conexão' : 'Conectando…'}
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Notificações de conclusão</p>
              <p className="text-xs text-muted-foreground">Receba um aviso enquanto o app estiver aberto ou minimizado.</p>
            </div>
          </div>
          {permission === 'granted' ? (
            <span className="text-xs text-emerald-600">Ativadas</span>
          ) : permission === 'unsupported' ? (
            <span className="text-xs text-muted-foreground">Indisponíveis neste navegador</span>
          ) : (
            <button onClick={enableNotifications} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
              Ativar notificações
            </button>
          )}
        </section>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{tasks.length} tarefa(s) recentes</p>
          <button onClick={() => void refresh()} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>

        <section className="mt-2 space-y-2">
          {tasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhuma tarefa em segundo plano encontrada.</div>
          )}
          {tasks.map((task) => {
            const isRunning = task.status === 'running';
            const isCompleted = task.status === 'completed';
            const isWaitingConfirmation = task.status === 'waiting_confirmation';
            return (
              <article key={task.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 rounded-full p-1.5', isRunning ? 'bg-primary/10 text-primary' : isCompleted ? 'bg-emerald-500/10 text-emerald-600' : isWaitingConfirmation ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive')}>
                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isWaitingConfirmation ? <Clock3 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-medium">{getBackgroundTaskTitle(task)}</h2>
                      <span className="text-[11px] text-muted-foreground">{statusCopy[task.status as keyof typeof statusCopy] ?? task.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground break-words">{getBackgroundTaskSummary(task)}</p>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" /> Atualizada em {formatDate(task.updated_at)}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
