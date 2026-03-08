import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { Lightbulb, PenLine, Code2, BookOpen, Sparkles } from 'lucide-react';

const suggestions = [
  { icon: Lightbulb, label: 'Explique computação quântica', color: 'text-yellow-500' },
  { icon: PenLine, label: 'Escreva um poema criativo', color: 'text-pink-500' },
  { icon: Code2, label: 'Ajude com código Python', color: 'text-emerald-500' },
  { icon: BookOpen, label: 'Resuma um artigo para mim', color: 'text-blue-500' },
];

export function AgentSelector() {
  const { createConversation } = useChatStore();

  const handleSuggestion = async (text: string) => {
    const id = await createConversation();
    if (id) {
      // The ChatView will pick up the conversation; user can type from there
      // We'll set the input via a small trick — just create the conversation
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="h-20 w-20 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-accent" />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-center mb-2"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Olá! Como posso ajudar?
        </h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-muted-foreground text-sm text-center mb-8 max-w-sm"
      >
        Sou seu assistente de IA. Posso ajudar com perguntas, análises, escrita criativa, código e muito mais.
      </motion.p>

      {/* Suggestion cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-2 gap-3 w-full"
      >
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSuggestion(s.label)}
            className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border text-left hover:bg-muted/60 transition-colors"
          >
            <s.icon className={`h-5 w-5 shrink-0 mt-0.5 ${s.color}`} />
            <span className="text-sm text-muted-foreground leading-snug">{s.label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
}
