import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { streamChat } from '@/lib/streamChat';
import { generateImage, ImageQuality } from '@/lib/generateImage';
import { textToSpeech } from '@/lib/api/elevenlabs';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export function ChatView() {
  const { activeConversationId, getActiveConversation, addMessage } = useChatStore();
  const conversation = getActiveConversation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

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

  const handleTTS = async (text: string) => {
    if (!activeConversationId || !text) return;

    await addMessage(activeConversationId, { role: 'user', content: `🔊 Gerar áudio: ${text}` });
    setIsStreaming(true);
    setLoadingLabel('Gerando áudio...');
    setStreamingContent('');

    try {
      const dataUrl = await textToSpeech(text);
      setAudioUrl(dataUrl);
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `🔊 Áudio gerado com sucesso!\n\nTexto: "${text.length > 100 ? text.substring(0, 100) + '...' : text}"`,
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar áudio.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Não foi possível gerar o áudio. ${e.message || 'Tente novamente.'}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setLoadingLabel('');
    }
  };

  const handleScrape = async (url: string) => {
    if (!activeConversationId || !url) return;

    await addMessage(activeConversationId, { role: 'user', content: `🌐 Extrair conteúdo: ${url}` });
    setIsStreaming(true);
    setLoadingLabel('Extraindo conteúdo do site...');
    setStreamingContent('');

    try {
      const result = await firecrawlApi.scrape(url);
      const markdown = result.data?.markdown || (result as any).markdown || '';
      const metadata = result.data?.metadata || (result as any).metadata || {};
      const title = metadata?.title || url;

      if (!markdown) {
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `⚠️ Não foi possível extrair conteúdo de **${url}**. O site pode estar bloqueado.`,
        });
      } else {
        const truncated = markdown.length > 3000 ? markdown.substring(0, 3000) + '\n\n... *(conteúdo truncado)*' : markdown;
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `## 🌐 ${title}\n\n${truncated}`,
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair conteúdo.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Erro ao extrair conteúdo. ${e.message || 'Tente novamente.'}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setLoadingLabel('');
    }
  };

  const handleWebSearch = async (query: string) => {
    if (!activeConversationId || !query) return;

    await addMessage(activeConversationId, { role: 'user', content: `🔍 Buscar na web: ${query}` });
    setIsStreaming(true);
    setLoadingLabel('Buscando na web...');
    setStreamingContent('');

    try {
      const result = await firecrawlApi.search(query);
      const results = result.data || [];

      if (!results.length) {
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `⚠️ Nenhum resultado encontrado para **"${query}"**.`,
        });
      } else {
        const formatted = results.slice(0, 5).map((r: any, i: number) => {
          const title = r.title || r.url;
          const desc = r.description || r.markdown?.substring(0, 200) || '';
          return `### ${i + 1}. [${title}](${r.url})\n${desc}`;
        }).join('\n\n');

        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `## 🔍 Resultados para "${query}"\n\n${formatted}`,
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro na busca.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Erro na busca web. ${e.message || 'Tente novamente.'}`,
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

    // /voz command — TTS
    if (content.startsWith('/voz ')) {
      const text = content.replace('/voz ', '').trim();
      await handleTTS(text);
      return;
    }

    // /scrape command — web scraping
    if (content.startsWith('/scrape ')) {
      const url = content.replace('/scrape ', '').trim();
      await handleScrape(url);
      return;
    }

    // /search command — web search
    if (content.startsWith('/search ')) {
      const query = content.replace('/search ', '').trim();
      await handleWebSearch(query);
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
                onClick={() => handleSend('/search últimas notícias de tecnologia')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                🔍 Buscar na web
              </button>
              <button
                onClick={() => handleSend('/voz Olá! Eu sou a NexusIA, sua assistente de inteligência artificial.')}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                🔊 Gerar áudio
              </button>
            </div>
          </div>
        )}
        {conversation?.messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} audioUrl={msg.content.startsWith('🔊 Áudio gerado') ? audioUrl : undefined} />
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
