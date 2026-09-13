import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { TraceStep } from '@/lib/streamChat';

interface AgentTraceProps {
  steps: TraceStep[];
  durationMs?: number;
  /** Quando true, indica que a execução ainda está em andamento. */
  live?: boolean;
}

type StepTiming = {
  status: TraceStep['status'];
  startedAt?: number;
  durationMs?: number;
};

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, durationMs) / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

function formatResult(result: unknown) {
  if (typeof result === 'string') return result;
  if (result == null) return '';

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function getStepResult(step: TraceStep) {
  const extendedStep = step as TraceStep & { result?: unknown };
  return formatResult(extendedStep.result ?? (step.status !== 'running' ? step.detail : undefined));
}

function statusLabel(status: TraceStep['status']) {
  if (status === 'running') return 'Em andamento';
  if (status === 'waiting') return 'Aguardando';
  if (status === 'error') return 'Falhou';
  return 'Concluído';
}

export function AgentTrace({ steps, durationMs = 0, live = false }: AgentTraceProps) {
  const [open, setOpen] = useState(false);
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(durationMs);
  const [now, setNow] = useState(() => performance.now());
  const [timings, setTimings] = useState<Record<string, StepTiming>>({});

  const running = steps.some((step) => step.status === 'running');
  const waiting = steps.some((step) => step.status === 'waiting');
  const errored = steps.some((step) => step.status === 'error');
  const finished = !running && !waiting;
  const currentStep = [...steps].reverse().find((step) => step.status === 'running' || step.status === 'waiting');
  const currentLabel = currentStep?.label;

  useEffect(() => {
    setTimings((previous) => {
      const next = { ...previous };
      let changed = false;

      for (const step of steps) {
        const existing = next[step.id];
        const metadata = step as TraceStep & {
          durationMs?: number;
          startedAt?: number;
        };

        if (!existing || (step.status === 'running' && existing.status !== 'running')) {
          next[step.id] = {
            status: step.status,
            startedAt: step.status === 'running' ? performance.now() : metadata.startedAt,
            durationMs: metadata.durationMs,
          };
          changed = true;
          continue;
        }

        if (existing.status !== step.status) {
          next[step.id] = {
            ...existing,
            status: step.status,
            durationMs:
              metadata.durationMs ??
              (existing.startedAt != null ? Math.max(0, performance.now() - existing.startedAt) : existing.durationMs),
          };
          changed = true;
        } else if (metadata.durationMs != null && existing.durationMs !== metadata.durationMs) {
          next[step.id] = { ...existing, durationMs: metadata.durationMs };
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [steps]);

  useEffect(() => {
    if (!live) {
      setElapsed(durationMs);
      return;
    }

    const started = performance.now() - durationMs;
    const tick = () => {
      const timestamp = performance.now();
      setNow(timestamp);
      setElapsed(Math.max(0, timestamp - started));
    };

    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [durationMs, live]);

  const stepDurations = useMemo(() => {
    return steps.reduce<Record<string, number | undefined>>((result, step) => {
      const timing = timings[step.id];
      const metadata = step as TraceStep & { durationMs?: number };
      result[step.id] =
        metadata.durationMs ??
        timing?.durationMs ??
        (timing?.status === 'running' && timing.startedAt != null ? Math.max(0, now - timing.startedAt) : undefined);
      return result;
    }, {});
  }, [now, steps, timings]);

  if (!steps.length) return null;

  const summary = currentLabel
    ? currentLabel
    : finished
      ? `Trabalhou por ${formatDuration(elapsed)}`
      : `Trabalhando por ${formatDuration(elapsed)}`;

  const toggleStep = (id: string) => {
    setOpenSteps((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  return (
    <section
      aria-label="Progresso do agente"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/75 text-[12px] shadow-sm backdrop-blur-sm"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            running
              ? 'border-primary/25 bg-primary/10 text-primary'
              : errored
                ? 'border-destructive/20 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/60 text-muted-foreground'
          }`}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : errored ? (
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground/90">{summary}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {steps.length} {steps.length === 1 ? 'etapa' : 'etapas'}
            {finished && ` · ${formatDuration(elapsed)}`}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border/60 bg-muted/[0.08] px-3.5 pb-3 pt-2">
          <ol className="relative space-y-1" aria-label="Etapas da execução">
            {steps.map((step, index) => {
              const result = getStepResult(step);
              const isOpen = openSteps[step.id] ?? false;
              const stepDuration = stepDurations[step.id];
              const hasDetails = Boolean(step.detail || result);
              const isLast = index === steps.length - 1;

              return (
                <li key={`${step.id}-${index}`} className="relative pl-8">
                  {!isLast && <span className="absolute bottom-[-7px] left-[11px] top-7 w-px bg-border/70" aria-hidden="true" />}
                  <span
                    className={`absolute left-1 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                      step.status === 'running'
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : step.status === 'error'
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : step.status === 'waiting'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'border-primary/25 bg-primary/10 text-primary'
                    }`}
                  >
                    {step.status === 'running' ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                    ) : step.status === 'error' ? (
                      <X className="h-2.5 w-2.5" aria-hidden="true" />
                    ) : step.status === 'waiting' ? (
                      <Clock3 className="h-2.5 w-2.5" aria-hidden="true" />
                    ) : (
                      <Check className="h-2.5 w-2.5 animate-in zoom-in-75 duration-200" aria-hidden="true" />
                    )}
                  </span>

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleStep(step.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block leading-5 ${
                          step.status === 'error'
                            ? 'text-destructive'
                            : step.status === 'running'
                              ? 'font-medium text-foreground'
                              : step.status === 'waiting'
                                ? 'text-primary'
                                : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/75">
                        {statusLabel(step.status)} {stepDuration != null && `· ${formatDuration(stepDuration)}`}
                      </span>
                    </span>
                    <ChevronDown
                      className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && hasDetails && (
                    <div className="mx-2.5 mb-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <Brain className="h-3 w-3" aria-hidden="true" />
                        Resultado
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/75">
                        {result || step.detail}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
