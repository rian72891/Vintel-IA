import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  agent: string | null;
  hour_utc: number;
  frequency: 'daily' | 'weekly';
  weekday: number | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Converte hora local escolhida pelo usuário para hora UTC (e vice-versa). */
const offsetHours = () => -new Date().getTimezoneOffset() / 60;
const toUtcHour = (local: number) => ((Math.round(local - offsetHours()) % 24) + 24) % 24;
const toLocalHour = (utc: number) => ((Math.round(utc + offsetHours()) % 24) + 24) % 24;

export default function Tarefas() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hourLocal, setHourLocal] = useState(9);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [weekday, setWeekday] = useState(1);

  const load = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Não foi possível carregar suas tarefas.');
    setTasks((data as ScheduledTask[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!user) return toast.error('Entre na sua conta para criar tarefas.');
    if (!title.trim() || !prompt.trim()) return toast.error('Preencha título e instrução.');
    setSaving(true);
    const { error } = await supabase.from('scheduled_tasks').insert({
      user_id: user.id,
      title: title.trim(),
      prompt: prompt.trim(),
      hour_utc: toUtcHour(hourLocal),
      frequency,
      weekday: frequency === 'weekly' ? weekday : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setTitle('');
    setPrompt('');
    toast.success('Tarefa agendada!');
    load();
  };

  const toggle = async (task: ScheduledTask) => {
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, enabled: !t.enabled } : t)));
    const { error } = await supabase
      .from('scheduled_tasks')
      .update({ enabled: !task.enabled })
      .eq('id', task.id);
    if (error) {
      toast.error('Não foi possível atualizar.');
      load();
    }
  };

  const remove = async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    const { error } = await supabase.from('scheduled_tasks').delete().eq('id', id);
    if (error) {
      toast.error('Não foi possível apagar.');
      load();
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Vintel IA
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Tarefas agendadas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A Vintel IA executa a instrução no horário escolhido e salva o resultado como uma nova conversa.
        </p>

        <section className="mt-6 rounded-2xl border border-border p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ex: Resumo diário de mercado)"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Instrução que a IA deve executar..."
            className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="daily">Todo dia</option>
              <option value="weekly">Toda semana</option>
            </select>
            {frequency === 'weekly' && (
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            )}
            <select
              value={hourLocal}
              onChange={(e) => setHourLocal(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agendar
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            As execuções são verificadas de hora em hora, então pode haver alguns minutos de atraso em relação ao horário escolhido.
          </p>
        </section>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa agendada ainda.</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', !t.enabled && 'text-muted-foreground line-through')}>
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.prompt}</p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {t.frequency === 'weekly' ? WEEKDAYS[t.weekday ?? 1] : 'Todo dia'} às{' '}
                      {String(toLocalHour(t.hour_utc)).padStart(2, '0')}:00
                      {t.last_run_at && ` · última: ${new Date(t.last_run_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggle(t)}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-muted transition-colors"
                    >
                      {t.enabled ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Apagar tarefa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
