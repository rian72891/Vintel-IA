import { motion } from 'framer-motion';
import { Message } from '@/types/agent';
import { cn } from '@/lib/utils';
import { Download, Copy, Check, Volume2, Pause, FileText, Code, FileArchive, File, Mic, FileCode, Share2, Loader2, CheckCircle2, Pencil, Eye, EyeOff, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useCallback, useRef, useMemo, memo } from 'react';
import JSZip from 'jszip';
import { MarkdownMessage } from './MarkdownMessage';
import { ImageLightbox } from './ImageLightbox';
import { getFeedback, setFeedback as saveFeedback, type Feedback } from '@/lib/messageFeedback';
import { getSelectedVoiceId, textToSpeech } from '@/lib/api/elevenlabs';
import { useVoiceAvailable } from '@/lib/voiceAvailability';
import { AgentAvatar } from './AgentAvatar';

const actionBtn = 'p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors';

interface ChatMessageProps {
  message: Message;
  audioUrl?: string | null;
  isStreaming?: boolean;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
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

function ChatMessageBase({ message, audioUrl, isStreaming, onEdit, onRegenerate }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isVoiceMessage = isUser && message.content.startsWith('🎤 ');
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedArtifact, setCopiedArtifact] = useState<number | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<number | null>(null);
  const [downloadedAll, setDownloadedAll] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<Feedback | null>(() => getFeedback(message.id));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAvailable = useVoiceAvailable();
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string; filename?: string } | null>(null);


  const speakResponse = useCallback(async () => {
    if (ttsAudioRef.current && ttsPlaying) {
      ttsAudioRef.current.pause();
      setTtsPlaying(false);
      return;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.play();
      setTtsPlaying(true);
      return;
    }
    try {
      setTtsLoading(true);
      const text = message.content.replace(/```[\s\S]*?```/g, ' (bloco de código) ').slice(0, 4000);
      const dataUrl = await textToSpeech(text, getSelectedVoiceId());
      const audio = new Audio(dataUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => setTtsPlaying(false);
      audio.onpause = () => setTtsPlaying(false);
      await audio.play();
      setTtsPlaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o áudio.');
    } finally {
      setTtsLoading(false);
    }
  }, [message.content, ttsPlaying]);


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
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        toast.error('Faça login para compartilhar artefatos.');
        return;
      }
      const { data, error } = await supabase
        .from('shared_artifacts')
        .insert([{ title: `Arquivos Compartilhados (${artifacts.length})`, artifacts: artifacts as any, user_id: uid }])
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

  const copyResponse = useCallback(async () => {
    await navigator.clipboard.writeText(cleanContent);
    setCopiedResponse(true);
    toast.success('Resposta copiada!');
    setTimeout(() => setCopiedResponse(false), 2000);
  }, [cleanContent]);

  const shareResponse = useCallback(async () => {
    const formatted = `💡 Resposta do Vintel IA\n\n${cleanContent}\n\n— gerado em ${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Resposta do Vintel IA', text: formatted });
        return;
      } catch { /* usuário cancelou → cai no clipboard */ }
    }
    await navigator.clipboard.writeText(formatted);
    toast.success('Texto formatado copiado para compartilhar!');
  }, [cleanContent]);


  const startEdit = () => {
    setEditText(message.content);
    setIsEditing(true);
  };

  const confirmEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});
  const togglePreview = (key: string) => setPreviewOpen((p) => ({ ...p, [key]: !p[key] }));

  const isHTMLContent = (code: string, lang?: string) => {
    if (lang && ['html', 'htm'].includes(lang.toLowerCase())) return true;
    const c = code.trim().toLowerCase();
    return c.startsWith('<!doctype html') || c.startsWith('<html') || (c.includes('<body') && c.includes('</body>'));
  };

  const buildPreviewSrcDoc = (code: string) => {
    const c = code.trim();
    if (c.toLowerCase().startsWith('<!doctype') || c.toLowerCase().startsWith('<html')) return c;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${code}</body></html>`;
  };

  let codeBlockIdx = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('group flex gap-3 px-4 py-3 max-w-4xl mx-auto w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <AgentAvatar isStreaming={isStreaming} className="mt-1 h-7 w-7" />
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl relative',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm px-4 py-2.5'
            : 'text-foreground'
        )}
      >
        {/* Edit button for user messages */}
        {isUser && onEdit && !isEditing && (
          <button
            onClick={startEdit}
            aria-label="Editar mensagem"
            className="absolute -left-9 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 transition-all"
            title="Editar mensagem"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {isVoiceMessage && (
          <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <Mic className="h-3 w-3" />
            <span className="text-[10px] font-medium tracking-wide">Mensagem de voz</span>
          </div>
        )}

        {message.attachments?.map((att, i) => (
          <div key={i} className="mb-2.5">
            {att.type === 'image' ? (
              <div className="group/img relative inline-block">
                <button
                  type="button"
                  className="block cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label={`Ampliar imagem ${att.name || ''}`.trim()}
                  onClick={() => setLightboxImage({ src: att.url, alt: att.name || 'Imagem anexada', filename: att.name })}
                >
                  <img src={att.url} alt={att.name || 'Imagem anexada'} className="block max-h-72 rounded-xl object-contain transition-opacity hover:opacity-95" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); downloadImage(att.url, att.name || undefined); }} className="absolute bottom-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg opacity-0 group-hover/img:opacity-100 transition-all hover:bg-background flex items-center gap-1.5" title="Baixar imagem">
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
            {artifacts.map((artifact, idx) => {
              const isHTML = isHTMLContent(artifact.content, artifact.filename.split('.').pop());
              const previewKey = `art-${idx}`;
              const open = previewOpen[previewKey];
              return (
              <div key={idx} className="group/art bg-muted/30 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between p-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(artifact.filename)}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">{artifact.title}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="truncate">{artifact.filename}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{formatFileSize(artifact.content)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isHTML && (
                      <button onClick={() => togglePreview(previewKey)} className="flex items-center gap-1 px-2 py-1 bg-background/50 border border-border/50 rounded-md text-[11px] font-medium hover:bg-muted transition-colors shrink-0" title={open ? 'Ocultar preview' : 'Ver preview'}>
                        {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {open ? 'Ocultar' : 'Preview'}
                      </button>
                    )}
                    <button aria-label={`Copiar ${artifact.filename}`} onClick={() => copyArtifact(artifact.content, idx)} className="flex items-center gap-1 px-2 py-1 bg-background/50 border border-border/50 rounded-md text-[11px] font-medium hover:bg-muted transition-colors shrink-0" title="Copiar">
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
                {isHTML && open && (
                  <div className="border-t border-border/40 bg-white">
                    <iframe
                      srcDoc={buildPreviewSrcDoc(artifact.content)}
                      title={`Preview ${artifact.filename}`}
                      sandbox="allow-scripts"
                      className="w-full h-[420px] border-0"
                    />
                  </div>
                )}
              </div>
            );})}
          </div>
        )}

        {isUser ? (
          isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                aria-label="Editar mensagem"
                className="w-full bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg px-3 py-2 text-[15px] text-primary-foreground placeholder:text-primary-foreground/70 resize-none focus:outline-none min-h-[60px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <div className="flex items-center gap-2 justify-end">
                <button onClick={cancelEdit} className="px-3 py-1 text-xs text-primary-foreground/70 hover:text-primary-foreground rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmEdit} className="px-3 py-1 text-xs bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground rounded-lg transition-colors font-medium">
                  Enviar
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{isVoiceMessage ? message.content.replace('🎤 ', '') : message.content}</p>
          )
        ) : cleanContent ? (
          <>
            <MarkdownMessage content={cleanContent} isStreaming={isStreaming} />
            {!isStreaming && (
              <div className="mt-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={copyResponse} aria-label="Copiar resposta" title="Copiar resposta" className={actionBtn}>
                  {copiedResponse ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {onRegenerate && (
                  <button onClick={onRegenerate} aria-label="Regenerar resposta" title="Regenerar resposta" className={actionBtn}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setFeedbackValue(saveFeedback(message.id, 'up'))}
                  aria-label="Marcar resposta como boa"
                  title="Boa resposta"
                  className={cn(actionBtn, feedbackValue === 'up' && 'text-primary bg-primary/10')}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setFeedbackValue(saveFeedback(message.id, 'down'))}
                  aria-label="Marcar resposta como ruim"
                  title="Resposta ruim"
                  className={cn(actionBtn, feedbackValue === 'down' && 'text-destructive bg-destructive/10')}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                {voiceAvailable && (
                  <button onClick={speakResponse} aria-label={ttsPlaying ? 'Pausar leitura' : 'Ouvir resposta'} title={ttsPlaying ? 'Pausar leitura' : 'Ouvir resposta'} className={actionBtn} disabled={ttsLoading}>
                    {ttsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ttsPlaying ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button onClick={shareResponse} aria-label="Compartilhar resposta" title="Compartilhar resposta" className={actionBtn}>
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          filename={lightboxImage.filename}
          onClose={() => setLightboxImage(null)}
          onDownload={downloadImage}
        />
      )}
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageBase, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.content === next.message.content &&
  prev.message.attachments === next.message.attachments &&
  prev.audioUrl === next.audioUrl &&
  prev.isStreaming === next.isStreaming &&
  prev.onEdit === next.onEdit &&
  prev.onRegenerate === next.onRegenerate
);
