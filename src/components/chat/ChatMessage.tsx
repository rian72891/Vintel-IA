import { motion } from 'framer-motion';
import { Message } from '@/types/agent';
import { cn } from '@/lib/utils';
import { Bot, User, Download, Copy, Check, Volume2, Pause, FileText, Code, FileArchive, File, Mic, FileCode, Share2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useState, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';

interface ChatMessageProps {
  message: Message;
  audioUrl?: string | null;
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
      return <FileText className="h-4 w-4 text-secondary shrink-0" />;
    case 'md': case 'txt': case 'doc': case 'docx':
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

export function ChatMessage({ message, audioUrl }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isVoiceMessage = isUser && message.content.startsWith('🎤 ');
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedArtifact, setCopiedArtifact] = useState<number | null>(null);
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

  const downloadFileContent = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex gap-3 px-4 py-3 max-w-4xl mx-auto', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card border border-border text-foreground rounded-bl-md'
        )}
      >
        {isVoiceMessage && (
          <div className="flex items-center gap-1.5 mb-1 opacity-80">
            <Mic className="h-3 w-3" />
            <span className="text-[10px] font-medium">Mensagem de voz</span>
          </div>
        )}

        {message.attachments?.map((att, i) => (
          <div key={i} className="mb-2">
            {att.type === 'image' ? (
              <div className="group relative inline-block">
                <img src={att.url} alt={att.name} className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(att.url, '_blank')} />
                <button onClick={(e) => { e.stopPropagation(); downloadImage(att.url, att.name || undefined); }} className="absolute bottom-2 right-2 p-2 bg-background/80 backdrop-blur-sm border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background flex items-center gap-1.5" title="Baixar imagem">
                  <Download className="h-4 w-4 text-foreground" />
                  <span className="text-xs text-foreground font-medium">Baixar</span>
                </button>
              </div>
            ) : (
              <button onClick={() => { const a = document.createElement('a'); a.href = att.url; a.download = att.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-lg text-xs hover:bg-primary/20 transition-colors w-full">
                {getFileIcon(att.name)}
                <span className="truncate text-foreground font-medium flex-1 text-left">{att.name}</span>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar</span>
                </div>
              </button>
            )}
          </div>
        ))}

        {audioUrl && !isUser && message.content.startsWith('🔊 Áudio gerado') && (
          <div className="mb-2 flex items-center gap-2">
            <button onClick={toggleAudio} className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary hover:bg-primary/20 transition-colors">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isPlaying ? 'Pausar' : 'Ouvir áudio'}
            </button>
          </div>
        )}

        {artifacts.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">📦 Arquivos Gerados ({artifacts.length})</div>
              <div className="flex items-center gap-1.5">
                <button onClick={shareArtifacts} disabled={isSharing} className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-[10px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                  {isSharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  Compartilhar
                </button>
                {artifacts.length > 1 && (
                  <button onClick={downloadAllArtifacts} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-[10px] font-medium hover:bg-primary/90 transition-colors">
                    <FileArchive className="h-3 w-3" />
                    Baixar tudo (.zip)
                  </button>
                )}
              </div>
            </div>
            {artifacts.map((artifact, idx) => (
              <div key={idx} className="group bg-muted/50 border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(artifact.filename)}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{artifact.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">{artifact.filename}</span>
                        <span>•</span>
                        <span>{artifact.type}</span>
                        <span>•</span>
                        <span>{formatFileSize(artifact.content)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyArtifact(artifact.content, idx)} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-md text-xs font-medium hover:bg-muted/80 transition-colors shrink-0" title="Copiar conteúdo">
                      {copiedArtifact === idx ? (<><Check className="h-3.5 w-3.5 text-green-500" /> Copiado</>) : (<><Copy className="h-3.5 w-3.5" /> Copiar</>)}
                    </button>
                    <button onClick={() => downloadFileContent(artifact.content, artifact.filename)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors shrink-0">
                      <Download className="h-3.5 w-3.5" />
                      Baixar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap">{isVoiceMessage ? message.content.replace('🎤 ', '') : message.content}</p>
        ) : cleanContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match || (typeof children === 'string' && children.includes('\n'));
                  if (isBlock) {
                    const currentIdx = codeBlockIdx++;
                    const codeStr = String(children).replace(/\n$/, '');
                    return (
                      <div className="relative group my-2 rounded-lg overflow-hidden border border-border">
                        <div className="flex items-center justify-between bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                          <span>{match?.[1] || 'code'}</span>
                          <button onClick={() => copyCode(codeStr, currentIdx)} className="flex items-center gap-1 text-[10px] hover:text-foreground transition-colors">
                            {copiedBlock === currentIdx ? (<><Check className="h-3 w-3" /> Copiado</>) : (<><Copy className="h-3 w-3" /> Copiar</>)}
                          </button>
                        </div>
                        <pre className="p-3 overflow-x-auto bg-background text-xs leading-relaxed">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  }
                  return <code className="px-1.5 py-0.5 bg-muted rounded text-xs text-foreground" {...props}>{children}</code>;
                },
                img({ src, alt }) {
                  return (
                    <div className="my-2 group relative inline-block">
                      <img src={src} alt={alt || ''} className="rounded-lg max-h-96 object-contain cursor-pointer hover:opacity-95 transition-opacity" onClick={() => src && window.open(src, '_blank')} />
                      <button onClick={(e) => { e.stopPropagation(); if (src) downloadImage(src, alt || undefined); }} className="absolute bottom-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background" title="Baixar imagem">
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
        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
