import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 focus-within:glow-primary transition-all">
          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Envie uma mensagem..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-40 scrollbar-thin"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          NexusAI pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
