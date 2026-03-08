import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { Loader2 } from 'lucide-react';

export function ChatView() {
  const { activeConversationId, getActiveConversation, addMessage } = useChatStore();
  const conversation = getActiveConversation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, isTyping]);

  const agent = conversation?.agent ? agents.find((a) => a.id === conversation.agent) : null;

  const handleSend = (content: string) => {
    if (!activeConversationId) return;
    addMessage(activeConversationId, { role: 'user', content });

    // Simulate AI response
    setIsTyping(true);
    setTimeout(() => {
      const responses = [
        `Entendi seu pedido! Como ${agent?.name || 'assistente'}, vou analisar isso com cuidado.\n\nAqui estão os próximos passos que vou seguir:\n\n1. **Análise do contexto** — compreender os requisitos\n2. **Planejamento** — dividir em subtarefas\n3. **Execução** — implementar a solução\n\nVou começar a trabalhar nisso agora.`,
        `Ótima pergunta! Deixe-me pesquisar e estruturar uma resposta completa para você.\n\nBaseado na minha análise inicial, posso identificar alguns pontos-chave que precisamos abordar. Vou detalhar cada um deles.`,
        `Perfeito, já estou processando sua solicitação.\n\nUtilizando minhas capacidades de ${agent?.capabilities?.join(', ') || 'análise e raciocínio'}, vou fornecer uma resposta estruturada e acionável.`,
      ];
      addMessage(activeConversationId, {
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        agent: conversation?.agent,
      });
      setIsTyping(false);
    }, 1500 + Math.random() * 1500);
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {agent && <span className="text-lg">{agent.icon}</span>}
        <span className="text-sm font-medium text-foreground">
          {agent?.name || 'Assistente Geral'}
        </span>
        {agent && (
          <span className="text-xs text-muted-foreground ml-1">
            • {agent.description}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-4">
        {conversation?.messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Envie uma mensagem para começar
          </div>
        )}
        {conversation?.messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && (
          <div className="flex gap-3 px-4 py-3">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
