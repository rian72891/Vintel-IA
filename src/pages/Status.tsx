import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { useI18n, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Check = { id: string; labelKey: TKey; run: () => Promise<boolean> };
type Result = { status: 'checking' | 'up' | 'down'; latency?: number };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function ping(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const CHECKS: Check[] = [
  { id: 'app', labelKey: 'status.app', run: async () => ping(`${window.location.origin}/manifest.json`, { cache: 'no-store' }) },
  {
    id: 'api',
    labelKey: 'status.api',
    run: async () => ping(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_KEY } }),
  },
  { id: 'auth', labelKey: 'status.auth', run: async () => ping(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } }) },
  {
    id: 'ai',
    labelKey: 'status.ai',
    run: async () => ping(`${SUPABASE_URL}/functions/v1/chat`, { method: 'OPTIONS' }),
  },
];

export default function Status() {
  const { t } = useI18n();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(Object.fromEntries(CHECKS.map((c) => [c.id, { status: 'checking' as const }])));
    await Promise.all(
      CHECKS.map(async (c) => {
        const started = performance.now();
        const ok = await c.run();
        const latency = Math.round(performance.now() - started);
        setResults((prev) => ({ ...prev, [c.id]: { status: ok ? 'up' : 'down', latency } }));
      }),
    );
    setCheckedAt(new Date());
    setRunning(false);
  }, []);

  useEffect(() => {
    runAll();
    const id = setInterval(runAll, 60_000);
    return () => clearInterval(id);
  }, [runAll]);

  const values = Object.values(results);
  const allUp = values.length > 0 && values.every((r) => r.status === 'up');
  const anyDown = values.some((r) => r.status === 'down');

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Vintel IA
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('status.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('status.subtitle')}</p>

        <div
          className={cn(
            'mt-6 flex items-center gap-3 rounded-2xl border px-4 py-4',
            anyDown
              ? 'border-destructive/30 bg-destructive/10'
              : allUp
                ? 'border-[hsl(142_72%_55%/0.35)] bg-[hsl(142_72%_55%/0.08)]'
                : 'border-border bg-muted/30',
          )}
        >
          {running && !anyDown ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : anyDown ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-[hsl(142_72%_55%)]" />
          )}
          <p className="text-sm font-medium">
            {running && !anyDown ? t('status.checking') : anyDown ? t('status.degraded') : t('status.operational')}
          </p>
        </div>

        <ul className="mt-4 rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {CHECKS.map((c) => {
            const r = results[c.id];
            return (
              <li key={c.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm">{t(c.labelKey)}</span>
                <span className="flex items-center gap-2 text-xs">
                  {r?.latency != null && r.status !== 'checking' && (
                    <span className="text-muted-foreground tabular-nums">{r.latency}ms</span>
                  )}
                  {r?.status === 'checking' || !r ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : r.status === 'up' ? (
                    <span className="inline-flex items-center gap-1.5 text-[hsl(142_72%_55%)]">
                      <span className="h-2 w-2 rounded-full bg-[hsl(142_72%_55%)]" />
                      {t('status.up')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-destructive">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      {t('status.down')}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('status.lastCheck')}: {checkedAt ? checkedAt.toLocaleTimeString() : '—'}
          </p>
          <button
            onClick={runAll}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', running && 'animate-spin')} />
            {t('status.recheck')}
          </button>
        </div>
      </div>
    </main>
  );
}
