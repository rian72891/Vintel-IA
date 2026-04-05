import { motion } from 'framer-motion';
import { Message } from '@/types/agent';
import { cn } from '@/lib/utils';
import { Bot, User, Download, Copy, Check, Volume2, Pause, FileText, Code, FileArchive, File, Mic, FileCode, Share2, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useState, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';

interface ChatMessageProps {
  message: Message;
  audioUrl?: string | null;
  isStreaming?: boolean;
}

interface Artifact {
  filename: string;
  type: string;
  title: string;
  content: string;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FileText className="h-4 w-4 text-destructive shrink-0" />;
    case 'html': case 'htm': return <Code className="h-4 w-4 text-primary shrink-0" />;
    case 'zip': case 'rar': case 'tar': case 'gz': return <FileArchive className="h-4 w-4 text-yellow-600 shrink-0" />;
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'java': case 'cpp': case 'c': case 'go': case 'rs': case 'php': case 'rb':
      return <FileCode className="h-4 w-4 text-primary shrink-0" />;
    case 'json': case 'yaml': case 'yml': case 'xml': case 'toml': case 'ini': case 'env':
      return <FileText className="h-4 w-4 text-secondary-foreground shrink-0" />;
    case 'md': case 'txt': case 'doc': case 'docx':
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

export function ChatMessage({ message, audioUrl, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isVoiceMessage = isUser && message.content.startsWith('🎤 ');
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedArtifact, setCopiedArtifact] = useState<number | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<number | null>(null);
  const [downloadedAll, setDownloadedAll] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { cleanContent, artifacts } = useMemo(() => {
    if (isUser) return { cleanContent: message.content, artifacts: [] };
    const artifactRegex = /<artifact\s+filename="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g;
    const foundArtifacts: Artifact[] = [];
    let match;
    while ((match = artifactRegex.exec(message.content)) !== null) {
      foundArtifacts.push({ filename: match[1], type: match[2], title: match[3], content: match[4].trim() });
    }
    const cleaned = message.content.replace(artifactRegex, '').trim();
    return { cleanContent: cleaned, artifacts: foundArtifacts };
  }, [message.content, isUser]);

  const copyCode = useCallback((code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(idx);
    setTimeout(() => setCopiedBlock(null), 2000);
  }, []);

  const copyArtifact = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedArtifact(idx);
    setTimeout(() => setCopiedArtifact(null), 2000);
  }, []);

  const downloadImage = (src: string, name?: string) => {
    const a = document.createElement('a');
    a.href = src;
    a.download = name || 'vintel-image.png';
    a.target = '_blank';
    a.click();
  };

  const downloadFileContent = (content: string, filename: string, idx: number) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedFile(idx);
    setTimeout(() => setDownloadedFile(null), 2500);
  };

  const toggleAudio = () => {
    if (!audioUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current && audioRef.current.src === audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  const formatFileSize = (content: string) => {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadAllArtifacts = async () => {
    if (artifacts.length === 0) return;
    const zip = new JSZip();
    artifacts.forEach(artifact => zip.file(artifact.filename, artifact.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vintel-artifacts-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedAll(true);
    setTimeout(() => setDownloadedAll(false), 2500);
  };

  const shareArtifacts = async () => {
    if (artifacts.length === 0 || isSharing) return;
    setIsSharing(true);
    try {
      const { data, error } = await supabase
        .from('shared_artifacts')
        .insert([{ title: `Arquivos Compartilhados (${artifacts.length})`, artifacts: artifacts as any }])
        .select()
        .single();
      if (error || !data) throw error;
      const shareUrl = `${window.location.origin}/shared/${data.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado para a área de transferência!');
    } catch {
      toast.error('Erro ao compartilhar artefatos.');
    } finally {
      setIsSharing(false);
    }
  };

  let codeBlockIdx = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex gap-3 px-4 py-3 max-w-4xl mx-auto w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-1">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm px-4 py-2.5'
            : 'text-foreground'
        )}
      >
        {isVoiceMessage && (
          <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <Mic className="h-3 w-3" />
            <span className="text-[10px] font-medium tracking-wide">Mensagem de voz</span>
          </div>
        )}

        {message.attachments?.map((att, i) => (
          <div key={i} className="mb-2.5">
            {att.type === 'image' ? (
              <div className="group relative inline-block">
                <img src={att.url} alt={att.name} className="rounded-xl max-h-72 object-contain cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(att.url, '_blank')} />
                <button onClick={(e) => { e.stopPropagation(); downloadImage(att.url, att.name || undefined); }} className="absolute bottom-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-background flex items-center gap-1.5" title="Baixar imagem">
                  <Download className="h-3.5 w-3.5 text-foreground" />
                  <span className="text-[11px] text-foreground font-medium">Baixar</span>
                </button>
              </div>
            ) : (
              <button onClick={() => { const a = document.createElement('a'); a.href = att.url; a.download = att.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} className="flex items-center gap-2 px-3 py-2 bg-muted/60 border border-border/50 rounded-lg text-xs hover:bg-muted transition-colors w-full">
                {getFileIcon(att.name)}
                <span className="truncate text-foreground font-medium flex-1 text-left">{att.name}</span>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Download className="h-3.5 w-3.5" />
                </div>
              </button>
            )}
          </div>
        ))}

        {audioUrl && !isUser && message.content.startsWith('🔊 Áudio gerado') && (
          <div className="mb-2.5 flex items-center gap-2">
            <button onClick={toggleAudio} className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/15 rounded-lg text-xs text-primary hover:bg-primary/15 transition-colors">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isPlaying ? 'Pausar' : 'Ouvir áudio'}
            </button>
          </div>
        )}

        {artifacts.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">📦 Arquivos ({artifacts.length})</div>
              <div className="flex items-center gap-1.5">
                <button onClick={shareArtifacts} disabled={isSharing} className="flex items-center gap-1.5 px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-[10px] font-medium transition-colors disabled:opacity-50">
                  {isSharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  Compartilhar
                </button>
                {artifacts.length > 1 && (
                  <button onClick={downloadAllArtifacts} className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                    downloadedAll
                      ? "bg-green-500/15 text-green-500"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}>
                    {downloadedAll ? <CheckCircle2 className="h-3 w-3" /> : <FileArchive className="h-3 w-3" />}
                    {downloadedAll ? 'Baixado!' : 'Baixar tudo'}
                  </button>
                )}
              </div>
            </div>
            {artifacts.map((artifact, idx) => (
              <div key={idx} className="group bg-muted/30 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between p-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(artifact.filename)}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">{artifact.title}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="truncate">{artifact.filename}</span>
                        <span className="opacity-40">·</span>
                        <span>{formatFileSize(artifact.content)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => copyArtifact(artifact.content, idx)} className="flex items-center gap-1 px-2 py-1 bg-background/50 border border-border/50 rounded-md text-[11px] font-medium hover:bg-muted transition-colors shrink-0" title="Copiar">
                      {copiedArtifact === idx ? (<><Check className="h-3 w-3 text-green-500" /></>) : (<><Copy className="h-3 w-3" /></>)}
                    </button>
                    <button onClick={() => downloadFileContent(artifact.content, artifact.filename, idx)} className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0",
                      downloadedFile === idx
                        ? "bg-green-500/15 text-green-500"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}>
                      {downloadedFile === idx ? <CheckCircle2 className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                      {downloadedFile === idx ? 'Baixado!' : 'Baixar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{isVoiceMessage ? message.content.replace('🎤 ', '') : message.content}</p>
        ) : cleanContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-p:text-[15px] prose-p:leading-[1.7] prose-p:my-2 prose-p:text-foreground
            prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-headings:my-3
            prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px]
            prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-[15px] prose-li:leading-[1.7]
            prose-strong:text-foreground prose-strong:font-semibold
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-primary/25 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:pl-4
            prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
          ">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match || (typeof children === 'string' && children.includes('\n'));
                  if (isBlock) {
                    const currentIdx = codeBlockIdx++;
                    const codeStr = String(children).replace(/\n$/, '');
                    return (
                      <div className="relative group my-3 rounded-xl overflow-hidden border border-border/40 bg-[hsl(var(--background))]">
                        <div className="flex items-center justify-between bg-muted/60 px-4 py-1.5 text-[11px] text-muted-foreground border-b border-border/30">
                          <span className="font-medium uppercase tracking-wider text-[10px]">{match?.[1] || 'code'}</span>
                          <button onClick={() => copyCode(codeStr, currentIdx)} className="flex items-center gap-1.5 text-[11px] hover:text-foreground transition-colors">
                            {copiedBlock === currentIdx ? (<><Check className="h-3 w-3 text-green-500" /> Copiado</>) : (<><Copy className="h-3 w-3" /> Copiar</>)}
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-[13px] leading-[1.6] font-mono">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  }
                  return <code className="px-1 py-0.5 bg-muted/60 rounded text-[13px] text-foreground font-mono" {...props}>{children}</code>;
                },
                img({ src, alt }) {
                  return (
                    <div className="my-3 group relative inline-block">
                      <img src={src} alt={alt || ''} className="rounded-xl max-h-96 object-contain cursor-pointer hover:opacity-95 transition-opacity" onClick={() => src && window.open(src, '_blank')} />
                      <button onClick={(e) => { e.stopPropagation(); if (src) downloadImage(src, alt || undefined); }} className="absolute bottom-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-background" title="Baixar imagem">
                        <Download className="h-3.5 w-3.5 text-foreground" />
                      </button>
                    </div>
                  );
                },
              }}
            >
              {cleanContent}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </motion.div>
  );
}
