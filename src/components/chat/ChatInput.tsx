import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

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

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-xs text-foreground">
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-1">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-ring/20 transition-all">
          {/* Action buttons */}
          <div className="flex items-center gap-0.5 shrink-0 mb-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Enviar imagem"
            >
              <Image className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setInput(prev => prev + (prev ? '\n' : '') + '/imagine ');
                textareaRef.current?.focus();
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Gerar imagem"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte qualquer coisa ao NexusIA..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-40 scrollbar-thin"
          />

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            disabled={(!input.trim() && files.length === 0) || disabled}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          NexusIA pode cometer erros. Verifique informações importantes.
        </p>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.json,.xml,.xlsx" />
        <input ref={imageInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
      </div>
    </div>
  );
}
