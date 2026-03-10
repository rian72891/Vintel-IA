import { useState } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useUsage } from '@/hooks/useUsage';
import { PLANS } from '@/lib/plans';
import { agents } from '@/data/agents';
import type { AgentType } from '@/types/agent';
import {
  Lightbulb, PenLine, Code2, BookOpen, Sparkles, Crown, Zap, Check, Building2,
  ArrowRight, Brain, MessageCircle, ImageIcon, FileText
} from 'lucide-react';
import { GumroadCheckout } from '@/components/subscription/GumroadCheckout';
import { PlanBadge } from '@/components/subscription/PlanBadge';
import { UsageBar } from '@/components/subscription/UsageBar';

const suggestions = [
  { icon: Lightbulb, label: 'Explique computação quântica', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { icon: PenLine, label: 'Escreva um poema criativo', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { icon: Code2, label: 'Ajude com código Python', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { icon: BookOpen, label: 'Resuma um artigo para mim', color: 'text-primary', bg: 'bg-primary/10' },
];

const capabilities = [
  { icon: MessageCircle, title: 'Conversas inteligentes', desc: 'Respostas contextuais e precisas' },
  { icon: Code2, title: 'Programação', desc: 'Código em qualquer linguagem' },
  { icon: ImageIcon, title: 'Geração de imagens', desc: 'Crie imagens com IA' },
  { icon: FileText, title: 'Documentos', desc: 'PDF, HTML, TXT e ZIP' },
];

const planIcons = { free: Zap, starter: Zap, pro: Crown, agency: Building2 };

export function AgentSelector() {
  const { createConversation, setSelectedAgent } = useChatStore();
  const { plan: currentPlan, checkUsage } = useUsage();

  const messagesCheck = checkUsage('messages');
  const imagesCheck = checkUsage('images');

  const handleSuggestion = async () => {
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
            <span className="text-xs font-medium text-primary">Inteligência Artificial Avançada</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight mb-4">
            Ventel IA — seu agente de{' '}
            <span className="gradient-text">inteligência artificial</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Ventel IA é um agente de IA capaz de responder perguntas, gerar textos, criar imagens, produzir áudio e gerar arquivos — tudo em uma conversa só.
          </p>
        </motion.div>
      </div>

      {/* Usage Overview */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-4xl mx-auto px-6 pb-8"
      >
        <div className="bg-card border border-border rounded-2xl p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu uso</span>
            <PlanBadge plan={currentPlan} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UsageBar label="Mensagens hoje" used={messagesCheck.used} limit={messagesCheck.limit} />
            <UsageBar label="Imagens este mês" used={imagesCheck.used} limit={imagesCheck.limit} />
          </div>
        </div>
      </motion.div>

      {/* Capabilities */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="w-full max-w-4xl mx-auto px-6 pb-8"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {capabilities.map((cap, i) => (
            <div key={i} className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] text-center">
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
              onClick={handleSuggestion}
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

      {/* Agents */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="w-full max-w-4xl mx-auto px-6 pb-8"
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agentes Especializados</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent.id)}
              className="group flex flex-col gap-2 p-4 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200 text-left"
            >
              <span className="text-xl">{agent.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{agent.description}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Plans Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="w-full max-w-4xl mx-auto px-6 pb-12"
      >
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Planos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {(['starter', 'pro', 'agency'] as const).map((key) => {
            const plan = PLANS[key];
            const isCurrent = key === currentPlan;
            const isPro = key === 'pro';
            const Icon = planIcons[key];

            return (
              <div
                key={key}
                className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
                  isPro
                    ? 'border-transparent shadow-lg ring-1 ring-primary/30'
                    : 'border-border bg-card shadow-[var(--shadow-card)]'
                } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                style={isPro ? {
                  backgroundImage: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.05))',
                } : undefined}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isPro ? 'text-primary' : key === 'agency' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                </div>

                <p className="text-xl font-extrabold text-foreground">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.priceId && !isCurrent && (
                  <GumroadCheckout
                    productUrl={plan.priceId}
                    buttonText={`Assinar ${plan.name}`}
                    className="w-full text-xs"
                  />
                )}

                {isCurrent && <p className="text-xs text-primary text-center font-medium">✓ Plano atual</p>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
