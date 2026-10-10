import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';
import { agents } from '@/data/agents';
import type { AgentType } from '@/types/agent';
import {
  Send, Paperclip, Image, Sparkles, Wand2, Volume2, Globe, Search,
  Mic, Square, MessageSquare, ChevronRight, FileText, Code, FileArchive, File,
  Brain, Code2,
  ImageIcon, ScanText, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { agentIconMap } from '@/lib/agentIcons';
import { getMostUsedAgent } from '@/lib/agentUsage';
import { speechToText } from '@/lib/api/elevenlabs-stt';
import { useVoiceAvailable } from '@/lib/voiceAvailability';
import { isChatCommand } from '@/lib/imageIntent';
import { toast } from 'sonner';

interface AgentSelectorProps {
  onRequireAuth: () => void;
}

const placeholders = [
  'Gere um código em Python...',
  'Crie uma imagem de...',
  'Resuma este link...',
  'Analise este documento...',
  'Escreva um e-mail profissional...',
];

const featureCards = [
  {
    icon: Code2,
    title: 'Geração de Código',
    description: 'Escreva, analise e otimize código em qualquer linguagem.',
  },
  {
    icon: Zap,
    title: 'IA Multimodal',
    description: 'Texto, imagem, áudio e documentos em uma só conversa.',
  },
  {
    icon: ScanText,
    title: 'Análise de Documentos',
    description: 'PDFs, planilhas e textos — resumos e insights instantâneos.',
  },
  {
    icon: ImageIcon,
    title: 'Criação de Imagens',
    description: 'Gere imagens incríveis em segundos com modelos de ponta.',
  },
];

export function AgentSelector({ onRequireAuth }: AgentSelectorProps) {
  const { conversations, createConversation, setSelectedAgent, setActiveConversation, loadMessages, addMessage, setPendingCommand } = useChatStore();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const voiceAvailable = useVoiceAvailable();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const latestConversation = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0],
    [conversations],
  );

  const mostUsedAgent = useMemo(() => getMostUsedAgent(conversations), [conversations]);

  // Rotating placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowTools(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadedConversationId(null);

    if (!latestConversation) return () => { cancelled = true; };
    if (latestConversation.messages.length > 0) {
      setLoadedConversationId(latestConversation.id);
      return () => { cancelled = true; };
    }

    void loadMessages(latestConversation.id).then(() => {
      if (!cancelled) setLoadedConversationId(latestConversation.id);
    });
    return () => { cancelled = true; };
  }, [latestConversation, loadMessages]);

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!user) { onRequireAuth(); return; }
    const convId = await createConversation();
    if (!convId) return;

    // /imagine, /search, /pdf... são executados pelo ChatView, que sabe o que fazer.
    if (isChatCommand(input.trim())) {
      setPendingCommand({ conversationId: convId, text: input.trim(), files: [...files] });
      setInput(''); setFiles([]);
      return;
    }

    const attachments = files.length > 0 ? await Promise.all(files.map(async (f) => ({
      type: f.type.startsWith('image/') ? 'image' as const : 'file' as const,
      name: f.name, url: URL.createObjectURL(f), mimeType: f.type,
    }))) : undefined;
    await addMessage(convId, { role: 'user', content: input.trim(), attachments });
    setInput(''); setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSelectAgent = async (agentId: AgentType) => {
    if (!user) { onRequireAuth(); return; }
    setSelectedAgent(agentId);
    await createConversation(agentId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) { onRequireAuth(); return; }
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = '';
  };

  const insertCommand = (cmd: string) => {
    setInput(cmd); setShowTools(false); textareaRef.current?.focus();
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!voiceAvailable || isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        if (audioBlob.size < 1000) {
          toast.error('Gravação muito curta.');
          return;
        }
        setIsTranscribing(true);
        try {
          const text = await speechToText(audioBlob);
          if (text.trim()) {
            setInput((current) => current.trim() ? `${current.trim()} ${text.trim()}` : `🎤 ${text.trim()}`);
            requestAnimationFrame(() => textareaRef.current?.focus());
          } else {
            toast.error('Não foi possível entender o áudio.');
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Erro ao transcrever áudio.');
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start(100);
      setIsRecording(true);
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') toast.error('Permissão de microfone negada.');
      else toast.error('Erro ao acessar o microfone.');
    }
  }, [isRecording, isTranscribing, voiceAvailable]);

  const toolItems = [
    { icon: Sparkles, color: 'text-primary', cmd: '/imagine ', name: 'Imagem rápida' },
    { icon: Wand2, color: 'text-accent', cmd: '/imaginehd ', name: 'Imagem HD' },
    { icon: Volume2, color: 'text-primary', cmd: '/voz ', name: 'Gerar áudio' },
    { icon: Search, color: 'text-primary', cmd: '/search ', name: 'Buscar na web' },
    { icon: Globe, color: 'text-accent', cmd: '/scrape ', name: 'Extrair site' },
    { icon: FileText, color: 'text-destructive', cmd: '/pdf ', name: 'Gerar PDF' },
    { icon: Code, color: 'text-primary', cmd: '/html ', name: 'Gerar HTML' },
    { icon: FileArchive, color: 'text-accent', cmd: '/zip ', name: 'Gerar ZIP' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-thin">
      {/* Subtle radial glow — no blur, perf safe */}
      <div className="fixed inset-0 pointer-events-none gpu-layer">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.04]" />
        <div className="absolute bottom-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-accent/[0.03]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-4 pt-16 pb-8 md:pt-24">
        {/* ─── Hero ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-4 will-change-transform">
            <span className="animated-gradient-text">Vintel IA</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            A nova era da produtividade. Crie, codifique e automatize <span className="text-foreground font-medium">10x mais rápido</span>.
          </p>
        </motion.div>

        {latestConversation && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mb-10"
          >
            <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Continuar de onde parou</p>
            <button
              type="button"
              onClick={() => setActiveConversation(latestConversation.id)}
              className="group w-full max-w-2xl mx-auto flex items-center gap-4 rounded-2xl border border-border/50 bg-card/65 px-5 py-4 text-left shadow-[0_10px_30px_-22px_hsl(222_80%_52%/0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card/85 hover:shadow-[0_16px_36px_-24px_hsl(222_80%_52%/0.65)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary/[0.13]">
                <MessageSquare className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-foreground">{latestConversation.title || 'Nova conversa'}</span>
                {loadedConversationId !== latestConversation.id ? (
                  <span className="mt-2 block h-3 w-4/5 animate-pulse rounded-full bg-muted/60" aria-label="Carregando última mensagem" />
                ) : (
                  <span className="mt-1 block truncate text-[13px] leading-5 text-muted-foreground">
                    {latestConversation.messages.at(-1)?.content
                      ? `${latestConversation.messages.at(-1)!.content.slice(0, 60)}${latestConversation.messages.at(-1)!.content.length > 60 ? '…' : ''}`
                      : 'Nova conversa'}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          </motion.section>
        )}

        {/* ─── Floating Input ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="w-full max-w-2xl mx-auto mb-14"
        >
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-2 mb-2 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/40 rounded-lg text-xs text-foreground border border-border/30">
                    {f.type.startsWith('image/') && <img src={URL.createObjectURL(f)} alt="" className="h-6 w-6 rounded object-cover" />}
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground ml-1">×</button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative bg-card/90 border border-border/40 rounded-2xl shadow-[0_8px_40px_-12px_hsl(0_0%_0%/0.18)] focus-within:border-primary/50 focus-within:shadow-[0_8px_40px_-8px_hsl(222_80%_52%/0.14)] transition-all duration-300">
            <div className="flex items-center gap-1 px-4 py-3.5">
              <div className="flex items-center gap-0.5 shrink-0">
                <PillBtn icon={Paperclip} title="Anexar" onClick={() => { if (!user) { onRequireAuth(); return; } fileInputRef.current?.click(); }} />
                <PillBtn icon={Image} title="Imagem" onClick={() => { if (!user) { onRequireAuth(); return; } imageInputRef.current?.click(); }} />
                {voiceAvailable && (
                  <PillBtn
                    icon={isRecording ? Square : Mic}
                    title={isRecording ? 'Parar gravação' : isTranscribing ? 'Transcrevendo áudio' : 'Mensagem de voz'}
                    onClick={() => {
                      if (!user) { onRequireAuth(); return; }
                      if (isRecording) stopRecording();
                      else startRecording();
                    }}
                    disabled={isTranscribing}
                    active={isRecording}
                  />
                )}
                <div className="relative" ref={menuRef}>
                  <PillBtn icon={Sparkles} title="Ferramentas" onClick={() => setShowTools(!showTools)} />
                  <AnimatePresence>
                    {showTools && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 mb-2 w-52 bg-popover border border-border/40 rounded-xl shadow-lg p-1 z-50"
                      >
                        {toolItems.map((item, i) => (
                          <button key={i} onClick={() => insertCommand(item.cmd)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors">
                            <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                            <span className="text-sm text-foreground">{item.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholders[placeholderIdx]}
                rows={1}
                className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none max-h-[120px] scrollbar-thin py-0.5 leading-relaxed transition-[placeholder] duration-300"
              />

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                disabled={!input.trim() && files.length === 0}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.json,.xml,.xlsx" />
          <input ref={imageInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
        </motion.div>

        {/* ─── Bento Grid ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-14"
        >
          {featureCards.map((card, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.015, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="group relative p-5 md:p-6 rounded-2xl bg-card/50 border border-border/30 hover:border-primary/40 transition-all duration-300 overflow-hidden cursor-default will-change-transform"
            >
              {/* Glow on hover — opacity only, no blur */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-primary/20 pointer-events-none" />
              <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] pointer-events-none" />

              <div className="relative z-10">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Agent Grid ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-10"
        >
          <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-semibold text-center mb-4">Agentes Especializados</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {agents.map((agent) => {
              const IconComp = agentIconMap[agent.icon] || Brain;
              const isMostUsed = agent.id === mostUsedAgent;
              return (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent.id)}
                  className={cn(
                    'group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-card/40 border hover:bg-card/60 transition-colors text-center touch-feedback',
                    isMostUsed ? 'border-primary/60 bg-primary/[0.06]' : 'border-border/20 hover:border-primary/30',
                  )}
                >
                  {isMostUsed && <span className="absolute right-2 top-2 rounded-full border border-primary/15 bg-primary/[0.08] px-1.5 py-0.5 text-[8px] font-medium tracking-wide text-primary/80">Mais usado</span>}
                  <IconComp className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-foreground/80">{agent.name}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Authority Footer ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center pb-6 space-y-2"
        >
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/40">
            <Link to="/precos" className="hover:text-primary transition-colors">Planos</Link>
            <span className="opacity-40">·</span>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos</Link>
            <span className="opacity-40">·</span>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PillBtn({ icon: Icon, title, onClick, disabled = false, active = false }: { icon: any; title: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={cn(
        'p-2 text-muted-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-muted/40 disabled:opacity-40',
        active && 'text-destructive hover:text-destructive bg-destructive/10',
      )}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
