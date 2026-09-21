import { ExternalLink, Globe2 } from 'lucide-react';
import { useMemo } from 'react';

export type SourceCitation = {
  title: string;
  url: string;
};

function getHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function SourcesList({ sources }: { sources: SourceCitation[] }) {
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return sources.filter((source) => {
      if (!source.url || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    }).slice(0, 8);
  }, [sources]);

  if (!uniqueSources.length) return null;

  return (
    <section className="mt-4 border-t border-border/50 pt-3" aria-label="Fontes consultadas">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Globe2 className="h-3 w-3" aria-hidden="true" />
        Fontes
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueSources.map((source) => {
          const hostname = getHostname(source.url);
          return (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${source.title} — ${hostname}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-foreground"
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`}
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-sm"
                loading="lazy"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
              <span className="truncate">{source.title || hostname}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
