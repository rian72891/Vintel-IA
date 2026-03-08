import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { streamChat } from '@/lib/streamChat';
import { generateImage } from '@/lib/generateImage';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ChatView() {
  const { activeConversationId, getActiveConversation, addMessage } = useChatStore();
  const conversation = getActiveConversation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, streamingContent]);

  const agent = conversation?.agent ? agents.find((a) => a.id === conversation.agent) : null;

  const handleSend = async (content: string, attachments?: File[]) => {
    if (!activeConversationId) return;

    // Handle image generation command
    if (content.startsWith('/imagine ')) {
      const prompt = content.replace('/imagine ', '').trim();
      if (!prompt) return;
      addMessage(activeConversationId, { role: 'user', content });
      setIsStreaming(true);
      setStreamingContent('🎨 Gerando imagem...');

      try {
        const imageUrl = await generateImage(prompt);
        addMessage(activeConversationId, {
          role: 'assistant',
          content: `Aqui está a imagem gerada:\n\n![${prompt}](${imageUrl})`,
        });
      } catch (e) {
        toast.error('Erro ao gerar imagem. Tente novamente.');
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
      }
      return;
    }

    addMessage(activeConversationId, { role: 'user', content });

    setIsStreaming(true);
    setStreamingContent('');

    const currentConv = getActiveConversation();
    const history = (currentConv?.messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    history.push({ role: 'user', content });

    let fullContent = '';

    try {
      await streamChat({
        messages: history,
        agent: conversation?.agent,
        onDelta: (delta) => {
          fullContent += delta;
          setStreamingContent(fullContent);
        },
        onDone: () => {
          if (fullContent) {
            addMessage(activeConversationId, {
              role: 'assistant',
              content: fullContent,
              agent: conversation?.agent,
            });
          }
          setIsStreaming(false);
          setStreamingContent('');
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          setStreamingContent('');
        },
      });
    } catch (e) {
      toast.error('Erro ao conectar com a IA. Tente novamente.');
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {agent && <span className="text-lg">{agent.icon}</span>}
        <span className="text-sm font-medium text-foreground">
          {agent?.name || 'NexusIA'}
        </span>
        {agent && (
          <span className="text-xs text-muted-foreground ml-1">
            • {agent.description}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-4">
        {conversation?.messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Envie uma mensagem para começar
          </div>
        )}
        {conversation?.messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isStreaming && streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date(),
            }}
          />
        )}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 px-4 py-3 max-w-4xl mx-auto">
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
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
