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

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
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
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const insertCommand = (cmd: string) => {
    setInput(cmd);
    setShowToolsMenu(false);
    textareaRef.current?.focus();
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different MIME types for better compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          toast.error('Nenhum áudio gravado');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (audioBlob.size < 1000) {
          toast.error('Gravação muito curta. Fale por mais tempo.');
          return;
        }

        setIsTranscribing(true);
        try {
          const text = await speechToText(audioBlob);
          if (text.trim()) {
            onSend(`🎤 ${text.trim()}`);
          } else {
            toast.error('Não foi possível entender o áudio. Tente novamente.');
          }
        } catch (e: any) {
          toast.error(e.message || 'Erro ao transcrever áudio');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (e: any) {
      console.error('Error starting recording:', e);
      if (e.name === 'NotAllowedError') {
        toast.error('Permissão de microfone negada. Ative nas configurações do navegador.');
      } else {
        toast.error('Erro ao acessar o microfone');
      }
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-xs text-foreground">
                {f.type.startsWith('image/') && (
                  <img src={URL.createObjectURL(f)} alt="" className="h-6 w-6 rounded object-cover" />
                )}
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-1">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-destructive font-medium">Gravando... {formatTime(recordingTime)}</span>
          </motion.div>
        )}

        {/* Transcribing indicator */}
        {isTranscribing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg"
          >
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Transcrevendo áudio...</span>
          </motion.div>
        )}

        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-ring/20 transition-all">
          {/* Action buttons */}
          <div className="flex items-center gap-0.5 shrink-0 mb-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Anexar arquivo"
              disabled={disabled || isRecording}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Enviar imagem"
              disabled={disabled || isRecording}
            >
              <Image className="h-4 w-4" />
            </button>
            
            {/* Microphone button */}
            {isRecording ? (
              <motion.button
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={stopRecording}
                className="p-1.5 text-destructive hover:text-destructive/80 transition-colors rounded-md hover:bg-destructive/10"
                title="Parar gravação"
              >
                <Square className="h-4 w-4 fill-current" />
              </motion.button>
            ) : (
              <button
                onClick={startRecording}
                disabled={disabled || isTranscribing}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted disabled:opacity-50"
                title="Enviar mensagem de voz"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                title="Ferramentas IA"
                disabled={disabled || isRecording}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showToolsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded-xl shadow-lg p-1.5 z-50 max-h-[70vh] overflow-y-auto scrollbar-thin"
                  >
                    <p className="text-[10px] text-muted-foreground px-3 py-1.5 font-medium uppercase tracking-wide">Geração de Imagem</p>
                    <button
                      onClick={() => insertCommand('/imagine ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Rápido</p>
                        <p className="text-[10px] text-muted-foreground">Geração veloz</p>
                      </div>
                    </button>
                    <button
                      onClick={() => insertCommand('/imaginehd ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Wand2 className="h-4 w-4 text-accent shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Alta qualidade</p>
                        <p className="text-[10px] text-muted-foreground">Detalhado e preciso</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-border" />
                    <p className="text-[10px] text-muted-foreground px-3 py-1.5 font-medium uppercase tracking-wide">Voz IA</p>
                    <button
                      onClick={() => insertCommand('/voz ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Volume2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Gerar áudio</p>
                        <p className="text-[10px] text-muted-foreground">ElevenLabs • Texto → Voz</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-border" />
                    <p className="text-[10px] text-muted-foreground px-3 py-1.5 font-medium uppercase tracking-wide">Web</p>
                    <button
                      onClick={() => insertCommand('/search ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Search className="h-4 w-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Buscar na web</p>
                        <p className="text-[10px] text-muted-foreground">Firecrawl • Pesquisa</p>
                      </div>
                    </button>
                    <button
                      onClick={() => insertCommand('/scrape ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Globe className="h-4 w-4 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Extrair site</p>
                        <p className="text-[10px] text-muted-foreground">Firecrawl • Web Scraping</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-border" />
                    <p className="text-[10px] text-muted-foreground px-3 py-1.5 font-medium uppercase tracking-wide">Gerar Arquivos</p>
                    <button
                      onClick={() => insertCommand('/pdf ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <FileText className="h-4 w-4 text-red-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Gerar PDF</p>
                        <p className="text-[10px] text-muted-foreground">Documento formatado</p>
                      </div>
                    </button>
                    <button
                      onClick={() => insertCommand('/html ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <Code className="h-4 w-4 text-cyan-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Gerar HTML</p>
                        <p className="text-[10px] text-muted-foreground">Página web completa</p>
                      </div>
                    </button>
                    <button
                      onClick={() => insertCommand('/txt ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <File className="h-4 w-4 text-gray-500 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Gerar TXT</p>
                        <p className="text-[10px] text-muted-foreground">Texto simples</p>
                      </div>
                    </button>
                    <button
                      onClick={() => insertCommand('/zip ')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    >
                      <FileArchive className="h-4 w-4 text-yellow-600 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-xs">Gerar ZIP</p>
                        <p className="text-[10px] text-muted-foreground">Projeto com múltiplos arquivos</p>
                      </div>
                    </button>
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
            placeholder={isRecording ? 'Gravando áudio...' : 'Pergunte qualquer coisa ao NexusIA...'}
            rows={1}
            disabled={isRecording || isTranscribing}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-40 scrollbar-thin disabled:opacity-50"
          />

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            disabled={(!input.trim() && files.length === 0) || disabled || isRecording || isTranscribing}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          NexusIA pode cometer erros. Verifique informações importantes.
        </p>

        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.json,.xml,.xlsx" />
        <input ref={imageInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
      </div>
    </div>
  );
}
