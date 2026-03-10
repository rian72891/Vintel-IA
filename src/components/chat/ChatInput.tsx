import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Image, Sparkles, Wand2, Volume2, Globe, Search, Mic, Square, FileText, Code, FileArchive, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { speechToText } from '@/lib/api/elevenlabs-stt';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  const handleSubmit = () => {
    if ((!input.trim() && files.length === 0) || disabled) return;
    onSend(input.trim(), files.length > 0 ? files : undefined);
    setInput('');
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const insertCommand = (cmd: string) => {
    setInput(cmd);
    setShowToolsMenu(false);
    textareaRef.current?.focus();
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) { toast.error('Nenhum áudio gravado'); return; }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) { toast.error('Gravação muito curta.'); return; }

        setIsTranscribing(true);
        try {
          const text = await speechToText(audioBlob);
          if (text.trim()) onSend(`🎤 ${text.trim()}`);
          else toast.error('Não foi possível entender o áudio.');
        } catch (e: any) {
          toast.error(e.message || 'Erro ao transcrever áudio');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (e: any) {
      if (e.name === 'NotAllowedError') toast.error('Permissão de microfone negada.');
      else toast.error('Erro ao acessar o microfone');
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toolSections = [
    {
      title: 'Geração de Imagem',
      items: [
        { icon: Sparkles, color: 'text-primary', cmd: '/imagine ', name: 'Rápido', desc: 'Geração veloz' },
        { icon: Wand2, color: 'text-accent', cmd: '/imaginehd ', name: 'Alta qualidade', desc: 'Detalhado e preciso' },
      ]
    },
    {
      title: 'Voz IA',
      items: [
        { icon: Volume2, color: 'text-emerald-500', cmd: '/voz ', name: 'Gerar áudio', desc: 'Texto → Voz' },
      ]
    },
    {
      title: 'Web',
      items: [
        { icon: Search, color: 'text-primary', cmd: '/search ', name: 'Buscar na web', desc: 'Pesquisa inteligente' },
        { icon: Globe, color: 'text-accent', cmd: '/scrape ', name: 'Extrair site', desc: 'Web Scraping' },
      ]
    },
    {
      title: 'Gerar Arquivos',
      items: [
        { icon: FileText, color: 'text-destructive', cmd: '/pdf ', name: 'PDF', desc: 'Documento formatado' },
        { icon: Code, color: 'text-primary', cmd: '/html ', name: 'HTML', desc: 'Página web' },
        { icon: File, color: 'text-muted-foreground', cmd: '/txt ', name: 'TXT', desc: 'Texto simples' },
        { icon: FileArchive, color: 'text-accent', cmd: '/zip ', name: 'ZIP', desc: 'Projeto completo' },
      ]
    },
  ];

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 mb-2 flex-wrap"
            >
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg text-xs text-foreground border border-border">
                  {f.type.startsWith('image/') && (
                    <img src={URL.createObjectURL(f)} alt="" className="h-6 w-6 rounded object-cover" />
                  )}
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-1 font-bold">×</button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording / Transcribing indicators */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 mb-2 px-4 py-2.5 bg-destructive/10 border border-destructive/20 rounded-xl"
            >
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs text-destructive font-medium">Gravando... {formatTime(recordingTime)}</span>
            </motion.div>
          )}
          {isTranscribing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 mb-2 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl"
            >
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-medium">Transcrevendo áudio...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input container */}
        <div className="relative bg-card border border-border rounded-2xl shadow-[var(--shadow-elevated)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/10 transition-all duration-200">
          <div className="flex items-end gap-1 px-3 py-3">
            {/* Action buttons */}
            <div className="flex items-center gap-0.5 shrink-0 mb-0.5">
              <ActionButton icon={Paperclip} title="Anexar arquivo" disabled={disabled || isRecording} onClick={() => fileInputRef.current?.click()} />
              <ActionButton icon={Image} title="Enviar imagem" disabled={disabled || isRecording} onClick={() => imageInputRef.current?.click()} />
              
              {isRecording ? (
                <motion.button
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  onClick={stopRecording}
                  className="p-2 text-destructive hover:text-destructive/80 transition-colors rounded-lg hover:bg-destructive/10"
                  title="Parar gravação"
                >
                  <Square className="h-4 w-4 fill-current" />
                </motion.button>
              ) : (
                <ActionButton icon={Mic} title="Mensagem de voz" disabled={disabled || isTranscribing} onClick={startRecording} />
              )}

              <div className="relative" ref={menuRef}>
                <ActionButton icon={Sparkles} title="Ferramentas IA" disabled={disabled || isRecording} onClick={() => setShowToolsMenu(!showToolsMenu)} />
                <AnimatePresence>
                  {showToolsMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 mb-2 w-60 bg-popover border border-border rounded-xl shadow-[var(--shadow-elevated)] p-1.5 z-50 max-h-[70vh] overflow-y-auto scrollbar-thin"
                    >
                      {toolSections.map((section, si) => (
                        <div key={si}>
                          {si > 0 && <div className="my-1 border-t border-border" />}
                          <p className="text-[10px] text-muted-foreground px-3 py-1.5 font-semibold uppercase tracking-wider">{section.title}</p>
                          {section.items.map((item, ii) => (
                            <button
                              key={ii}
                              onClick={() => insertCommand(item.cmd)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors"
                            >
                              <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                              <div>
                                <p className="font-medium text-foreground text-xs">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
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
              placeholder={isRecording ? 'Gravando áudio...' : 'Pergunte qualquer coisa ao Nexusia...'}
              rows={1}
              disabled={isRecording || isTranscribing}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-40 scrollbar-thin disabled:opacity-50 py-1.5"
            />

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSubmit}
              disabled={(!input.trim() && files.length === 0) || disabled || isRecording || isTranscribing}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0 mb-0.5 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2.5 opacity-70">
          Nexusia pode cometer erros. Verifique informações importantes.
        </p>

        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.json,.xml,.xlsx" />
        <input ref={imageInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, title, disabled, onClick }: { icon: any; title: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted disabled:opacity-40"
      title={title}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
