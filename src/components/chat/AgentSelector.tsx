import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { agents } from '@/data/agents';
import type { AgentType } from '@/types/agent';
import {
  Lightbulb, PenLine, Code2, BookOpen, Sparkles,
  ArrowRight, Brain, MessageCircle, ImageIcon, FileText,
  Search, BarChart3, Megaphone, PenTool, TrendingUp, Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';

const suggestions = [
  { icon: Lightbulb, label: 'Explique computação quântica', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { icon: PenLine, label: 'Escreva um poema criativo', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { icon: Code2, label: 'Ajude com código Python', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { icon: BookOpen, label: 'Resuma um artigo para mim', color: 'text-primary', bg: 'bg-primary/10' },
];

const capabilities = [
  { icon: MessageCircle, title: 'Conversas inteligentes', desc: 'Respostas contextuais e precisas' },
  { icon: Code2, title: 'Programação', desc: 'Código em qualquer linguagem' },
  { icon: ImageIcon, title: 'Geração de imagens', desc: 'Crie e edite imagens com IA' },
  { icon: FileText, title: 'Documentos', desc: 'PDF, HTML, TXT e ZIP' },
];

const agentIconMap: Record<string, React.ComponentType<any>> = {
  'search': Search,
  'code-2': Code2,
  'bar-chart-3': BarChart3,
  'megaphone': Megaphone,
  'pen-tool': PenTool,
  'trending-up': TrendingUp,
  'cpu': Cpu,
};

const agentColorMap: Record<string, { bg: string; text: string; border: string }> = {
  'research': { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'hover:border-sky-500/30' },
  'coder': { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'hover:border-emerald-500/30' },
  'business': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'hover:border-amber-500/30' },
  'marketing': { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'hover:border-rose-500/30' },
  'content': { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'hover:border-violet-500/30' },
  'analyst': { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'hover:border-cyan-500/30' },
  'automation': { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'hover:border-indigo-500/30' },
};

export function AgentSelector() {
  const { createConversation, setSelectedAgent } = useChatStore();

  const handleSuggestion = async (text: string) => {
    await createConversation();
  };

  const handleSelectAgent = async (agentId: AgentType) => {
    setSelectedAgent(agentId);
    await createConversation(agentId);
  };

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-thin">
      {/* Hero Section */}
      <div className="w-full max-w-4xl mx-auto px-6 pt-12 pb-8 md:pt-20 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Assistente de IA Multimodal</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight mb-4">
            Vintel IA — seu agente de{' '}
            <span className="gradient-text">inteligência artificial</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Vintel IA é um agente de IA capaz de responder perguntas, gerar textos, criar imagens, analisar documentos e auxiliar em diversas tarefas do dia a dia.
          </p>
        </motion.div>
      </div>

      {/* Capabilities */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="w-full max-w-4xl mx-auto px-6 pb-8"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {capabilities.map((cap, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] text-center"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <cap.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{cap.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Start Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="w-full max-w-4xl mx-auto px-6 pb-8"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comece agora</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s.label)}
              className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200 text-left"
            >
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
              </div>
              <span className="text-sm text-foreground font-medium flex-1">{s.label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Agents - Professional redesign */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="w-full max-w-4xl mx-auto px-6 pb-12"
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agentes Especializados</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => {
            const IconComp = agentIconMap[agent.icon] || Brain;
            const colors = agentColorMap[agent.id] || { bg: 'bg-primary/10', text: 'text-primary', border: 'hover:border-primary/30' };
            
            return (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent.id)}
                className={cn(
                  'group flex items-start gap-3.5 p-4 rounded-2xl bg-card border border-border transition-all duration-200 text-left',
                  'hover:shadow-[var(--shadow-elevated)]',
                  colors.border
                )}
              >
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
                  <IconComp className={cn('h-5 w-5', colors.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-0.5">{agent.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {agent.capabilities.slice(0, 3).map((cap, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1 transition-opacity" />
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
