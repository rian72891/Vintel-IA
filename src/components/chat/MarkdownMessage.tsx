import { Children, isValidElement, memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Check, Copy, Download, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

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

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <span className="my-3 group/img relative inline-block">
        <button
          type="button"
          className="block cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={`Ampliar imagem ${alt || ''}`.trim()}
          onClick={() => setLightboxOpen(true)}
        >
          <img src={src} alt={alt || ''} loading="lazy" className="block max-h-96 rounded-xl object-contain transition-opacity hover:opacity-95" />
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); downloadImage(src, alt || undefined); }}
          className="absolute bottom-2 right-2 rounded-lg border border-border/50 bg-background/80 p-1.5 opacity-0 backdrop-blur-sm transition-all hover:bg-background group-hover/img:opacity-100"
          title="Baixar imagem"
          aria-label="Baixar imagem"
        >
          <Download className="h-3.5 w-3.5 text-foreground" />
        </button>
      </span>
      {lightboxOpen && (
        <ImageLightbox
          src={src}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
          onDownload={downloadImage}
        />
      )}
    </>
  );
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
  prose-p:text-[15.5px] prose-p:leading-[1.85] prose-p:my-4 prose-p:text-foreground prose-p:whitespace-pre-line
  [&>p+p]:mt-6
  prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
  prose-h1:text-[20px] prose-h1:mt-8 prose-h1:mb-4
  prose-h2:text-[17px] prose-h2:mt-7 prose-h2:mb-3
  prose-h3:text-[15.5px] prose-h3:mt-6 prose-h3:mb-2.5
  prose-ul:my-5 prose-ol:my-5 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-2 prose-li:text-[15.5px] prose-li:leading-[1.8]
  prose-li:marker:text-muted-foreground
  prose-strong:text-foreground prose-strong:font-semibold
  prose-em:text-foreground/75
  prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:underline-offset-2 prose-a:decoration-primary/40 hover:prose-a:decoration-primary
  prose-blockquote:border-l-[3px] prose-blockquote:border-primary/40 prose-blockquote:bg-muted/30
  prose-blockquote:rounded-r-lg prose-blockquote:py-1.5 prose-blockquote:pl-4 prose-blockquote:pr-3 prose-blockquote:my-4
  prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:font-normal
  prose-hr:border-border/60 prose-hr:my-6
  prose-table:text-[14px]
  prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-pre:my-0
  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`;

function MarkdownParagraph({ children, ...props }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];
  const isSingleChild = Children.count(children) === 1 && isValidElement(child);
  const isSubtitle = isSingleChild && child.type === 'strong';
  const isNote = isSingleChild && child.type === 'em';
  const textChildren = Children.toArray(children).filter((item): item is string => typeof item === 'string');
  const plainText = textChildren.length === Children.count(children) ? textChildren.join('') : '';
  const lines = plainText.split('\n');
  const numberedLines = lines.filter((line) => /^\s*\d+[.)–-]\s+/.test(line));
  const isTextList = numberedLines.length >= 2;
  const renderedChildren = isTextList
    ? lines.map((line, index) => (
        <span key={`${line}-${index}`} className={/^\s*\d+[.)–-]\s+/.test(line) ? 'block mb-2 last:mb-0' : 'block'}>
          {line}
        </span>
      ))
    : children;

  return (
    <p
      {...props}
      className={[
        'my-4 text-[15.5px] leading-[1.85] text-foreground whitespace-pre-line',
        isSubtitle && 'mb-3 mt-8 text-[15.5px] leading-[1.6] [&>strong]:font-semibold',
        isNote && 'my-5 border-l-2 border-primary/20 pl-3 text-[14px] leading-[1.75] text-muted-foreground/85',
      ].filter(Boolean).join(' ')}
    >
      {renderedChildren}
    </p>
  );
}

const MARKDOWN_COMPONENTS = {
  p: MarkdownParagraph,
  a({ href, children, ...props }: any) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-baseline gap-1 break-words text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/80 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        {...props}
      >
        <span>{children}</span>
        <ExternalLink className="inline-block h-3 w-3 shrink-0 translate-y-[-1px]" aria-hidden="true" />
      </a>
    );
  },
  table({ children }: any) {
    return <div className="my-5 w-full overflow-x-auto rounded-xl border border-border/60 bg-muted/10"><table className="w-full min-w-[520px] border-collapse text-left text-[14px]">{children}</table></div>;
  },
  thead({ children }: any) {
    return <thead className="border-b border-border/70 bg-muted/45 text-foreground">{children}</thead>;
  },
  tbody({ children }: any) {
    return <tbody className="divide-y divide-border/45">{children}</tbody>;
  },
  tr({ children }: any) {
    return <tr className="transition-colors hover:bg-muted/25">{children}</tr>;
  },
  th({ children }: any) {
    return <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground">{children}</th>;
  },
  td({ children }: any) {
    return <td className="border-r border-border/30 px-3.5 py-2.5 align-top leading-relaxed text-foreground/85 last:border-r-0">{children}</td>;
  },
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
    return <MarkdownImage src={src} alt={alt} />;
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
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={MARKDOWN_COMPONENTS}
      >
        {rendered}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[1em] bg-primary animate-blink align-text-bottom ml-0.5" />
      )}
    </div>
  );
});
