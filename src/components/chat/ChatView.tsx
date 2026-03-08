import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { streamChat } from '@/lib/streamChat';
import { generateImage, ImageQuality } from '@/lib/generateImage';
import { Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export function ChatView() {
  const { activeConversationId, getActiveConversation, addMessage } = useChatStore();
  const conversation = getActiveConversation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, streamingContent]);

  const agent = conversation?.agent ? agents.find((a) => a.id === conversation.agent) : null;

  const handleImageGeneration = async (prompt: string, quality: ImageQuality) => {
    if (!activeConversationId || !prompt) return;

    const qualityLabel = quality === 'hd' ? '(HD)' : '(rápido)';
    await addMessage(activeConversationId, { role: 'user', content: `🎨 Gerar imagem ${qualityLabel}: ${prompt}` });
    setIsStreaming(true);
    setLoadingLabel('Gerando imagem...');
    setStreamingContent('');

    try {
      const result = await generateImage(prompt, quality);
      const desc = result.description || `Imagem gerada: ${prompt}`;
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: desc,
        attachments: [{ type: 'image', name: prompt, url: result.imageUrl }],
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar imagem.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Não foi possível gerar a imagem. ${e.message || 'Tente novamente.'}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setLoadingLabel('');
    }
  };

  const handleSend = async (content: string, attachments?: File[]) => {
    if (!activeConversationId) return;

    // /imagine command — fast quality
    if (content.startsWith('/imagine ')) {
      const prompt = content.replace('/imagine ', '').trim();
      await handleImageGeneration(prompt, 'fast');
      return;
    }

    // /imaginehd command — HD quality
    if (content.startsWith('/imaginehd ')) {
      const prompt = content.replace('/imaginehd ', '').trim();
      await handleImageGeneration(prompt, 'hd');
      return;
    }

    await addMessage(activeConversationId, { role: 'user', content });
    setIsStreaming(true);
    setStreamingContent('');
    setLoadingLabel('');

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
        onDone: async () => {
          if (fullContent) {
            await addMessage(activeConversationId, {
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
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <p className="text-muted-foreground text-sm">Envie uma mensagem para começar</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              <button
                onClick={() => handleSend('Olá! O que você pode fazer?')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                💬 O que você pode fazer?
              </button>
              <button
                onClick={() => handleImageGeneration('um gato astronauta flutuando no espaço com a Terra ao fundo', 'fast')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                🎨 Gerar uma imagem
              </button>
              <button
                onClick={() => handleSend('Me ajude a criar um plano de negócios')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                📊 Plano de negócios
              </button>
              <button
                onClick={() => handleSend('Escreva um código Python para ordenar uma lista')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                💻 Escrever código
              </button>
            </div>
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
              {loadingLabel ? (
                <ImageIcon className="h-4 w-4 text-primary animate-pulse" />
              ) : (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              {loadingLabel ? (
                <span className="text-xs text-muted-foreground">{loadingLabel}</span>
              ) : (
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                </div>
              )}
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
