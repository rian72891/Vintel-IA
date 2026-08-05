import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, Download, Eye, EyeOff } from 'lucide-react';

function isHTMLContent(code: string, lang?: string) {
  if (lang && ['html', 'htm'].includes(lang.toLowerCase())) return true;
  const c = code.trim().toLowerCase();
  return c.startsWith('<!doctype html') || c.startsWith('<html') || (c.includes('<body') && c.includes('</body>'));
}

function buildPreviewSrcDoc(code: string) {
  const c = code.trim();
  if (c.toLowerCase().startsWith('<!doctype') || c.toLowerCase().startsWith('<html')) return c;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${code}</body></html>`;
}

function downloadImage(src: string, name?: string) {
  const a = document.createElement('a');
  a.href = src;
  a.download = name || 'vintel-image.png';
  a.target = '_blank';
  a.click();
}

/**
 * Bloco de código isolado: mantém o próprio estado (copiar/preview) para que
 * re-renders do streaming não remontem nem pisquem o bloco inteiro.
 */
const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const showPreview = isHTMLContent(code, lang);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group/code my-4 rounded-xl overflow-hidden border border-border/50 bg-muted/25 [contain:content]">
      <div className="flex items-center justify-between bg-muted/70 px-4 py-2 text-[11px] text-muted-foreground border-b border-border/40">
        <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">{lang || 'code'}</span>
        <div className="flex items-center gap-3">
          {showPreview && (
            <button onClick={() => setPreview((p) => !p)} className="flex items-center gap-1.5 text-[11px] hover:text-foreground transition-colors">
              {preview ? <><EyeOff className="h-3 w-3" /> Código</> : <><Eye className="h-3 w-3" /> Preview</>}
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1.5 text-[11px] hover:text-foreground transition-colors">
            {copied ? <><Check className="h-3 w-3 text-green-500" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
          </button>
        </div>
      </div>
      {showPreview && preview ? (
        <iframe
          srcDoc={buildPreviewSrcDoc(code)}
          title="HTML preview"
          sandbox="allow-scripts"
          className="w-full h-[420px] border-0 bg-white"
        />
      ) : (
        <pre className="p-4 overflow-x-auto text-[13px] leading-[1.65] font-mono text-foreground/90">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
});

const PROSE = `prose prose-sm dark:prose-invert max-w-none
  prose-p:text-[15.5px] prose-p:leading-[1.75] prose-p:my-3 prose-p:text-foreground
  prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
  prose-h1:text-[20px] prose-h1:mt-6 prose-h1:mb-3
  prose-h2:text-[17px] prose-h2:mt-5 prose-h2:mb-2.5
  prose-h3:text-[15.5px] prose-h3:mt-4 prose-h3:mb-2
  prose-ul:my-3 prose-ol:my-3 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-1 prose-li:text-[15.5px] prose-li:leading-[1.75]
  prose-li:marker:text-muted-foreground
  prose-strong:text-foreground prose-strong:font-semibold
  prose-em:text-foreground/90
  prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:underline-offset-2 prose-a:decoration-primary/30 hover:prose-a:decoration-primary
  prose-blockquote:border-l-[3px] prose-blockquote:border-primary/40 prose-blockquote:bg-muted/30
  prose-blockquote:rounded-r-lg prose-blockquote:py-1.5 prose-blockquote:pl-4 prose-blockquote:pr-3 prose-blockquote:my-4
  prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:font-normal
  prose-hr:border-border/60 prose-hr:my-6
  prose-table:text-[14px] prose-th:text-foreground prose-th:font-semibold prose-th:border-border/60
  prose-td:border-border/50 prose-td:py-1.5
  prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-pre:my-0
  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`;

const MARKDOWN_COMPONENTS = {
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const raw = String(children ?? '');
    const isBlock = Boolean(match) || raw.includes('\n');
    if (isBlock) {
      return <CodeBlock code={raw.replace(/\n$/, '')} lang={match?.[1]} />;
    }
    return (
      <code className="px-1.5 py-0.5 bg-muted/70 border border-border/40 rounded-md text-[13px] text-foreground font-mono" {...props}>
        {children}
      </code>
    );
  },
  img({ src, alt }: any) {
    return (
      <span className="my-3 group/img relative inline-block">
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          className="rounded-xl max-h-96 object-contain cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => src && window.open(src, '_blank')}
        />
        <button
          onClick={(e) => { e.stopPropagation(); if (src) downloadImage(src, alt || undefined); }}
          className="absolute bottom-2 right-2 p-1.5 bg-background/80 border border-border/50 rounded-lg opacity-0 group-hover/img:opacity-100 transition-all hover:bg-background"
          title="Baixar imagem"
        >
          <Download className="h-3.5 w-3.5 text-foreground" />
        </button>
      </span>
    );
  },
};

/**
 * Markdown com "debounce" durante o streaming: reparsear a árvore inteira a
 * cada chunk causa tremedeira; aqui só reprocessamos a cada ~90ms (e sempre
 * na última atualização), mantendo a altura estável.
 */
export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const [rendered, setRendered] = useState(content);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setRendered(content);
      return;
    }
    const now = performance.now();
    const elapsed = now - lastRef.current;
    const flush = () => {
      lastRef.current = performance.now();
      timerRef.current = null;
      setRendered(content);
    };
    if (elapsed >= 90) {
      flush();
    } else if (timerRef.current == null) {
      timerRef.current = window.setTimeout(flush, 90 - elapsed);
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, isStreaming]);

  return (
    <div className={PROSE} style={{ contain: 'layout style' }}>
      <ReactMarkdown components={MARKDOWN_COMPONENTS}>{rendered}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[1em] bg-primary animate-blink align-text-bottom ml-0.5" />
      )}
    </div>
  );
});
