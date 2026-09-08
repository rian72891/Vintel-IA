import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Check, X, Brain, ShieldAlert } from 'lucide-react';
import type { TraceStep } from '@/lib/streamChat';

interface AgentTraceProps {
  steps: TraceStep[];
  durationMs?: number;
  /** Quando true, indica que a execução ainda está em andamento. */
  live?: boolean;
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, durationMs) / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

export function AgentTrace({ steps, durationMs = 0, live = false }: AgentTraceProps) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(durationMs);

  const running = steps.some((s) => s.status === 'running');
  const waiting = steps.some((s) => s.status === 'waiting');
  const errored = steps.some((s) => s.status === 'error');
  const finished = !running && !waiting;

  useEffect(() => {
    if (!live) {
      setElapsed(durationMs);
      return;
    }
    const started = performance.now() - durationMs;
    const tick = () => setElapsed(Math.max(0, performance.now() - started));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [durationMs, live]);

  if (!steps.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card/60 text-[12px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {waiting ? (
          <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
        ) : running ? (
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
        ) : errored ? (
          <X className="h-3.5 w-3.5 text-destructive shrink-0" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
        )}
        <span className="flex-1 min-w-0 truncate font-medium text-foreground/80">
          {finished ? `Pensou por ${formatDuration(elapsed)}` : `Pensando por ${formatDuration(elapsed)}`}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="px-3 pb-2.5 space-y-1.5">
          {steps.map((step) => (
            <li key={`${step.id}-${step.label}`} className="flex items-start gap-2">
              <span className="mt-[3px] shrink-0">
                {step.status === 'running' && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
                {step.status === 'done' && <Check className="h-3 w-3 text-primary" />}
                {step.status === 'error' && <X className="h-3 w-3 text-destructive" />}
                {step.status === 'waiting' && <ShieldAlert className="h-3 w-3 text-primary animate-pulse" />}
              </span>
              <span className="min-w-0">
                <span
                  className={
                    step.status === 'error'
                      ? 'text-destructive'
                      : step.status === 'waiting'
                      ? 'text-primary'
                      : step.status === 'running'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="block font-mono text-[10px] text-muted-foreground/70 truncate">
                    {step.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
