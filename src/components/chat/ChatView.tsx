import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { streamChat } from '@/lib/streamChat';
import { generateImage, ImageQuality } from '@/lib/generateImage';
import { textToSpeech } from '@/lib/api/elevenlabs';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { generatePDF, generateHTML, generateTXT, generateZIP, downloadFile } from '@/lib/fileGeneration';
import { Loader2, ImageIcon, FileText, Mic, Sparkles } from 'lucide-react';
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

    // Validate URL format
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    try {
      new URL(formattedUrl);
    } catch {
      await addMessage(activeConversationId, { role: 'user', content: `🌐 Extrair conteúdo: ${url}` });
      await addMessage(activeConversationId, { role: 'assistant', content: `⚠️ **"${url}"** não é uma URL válida. Use o formato: \`/scrape https://exemplo.com\`` });
      return;
    }

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

  const handleFileGeneration = async (type: 'pdf' | 'html' | 'txt' | 'zip', prompt: string) => {
    if (!activeConversationId || !prompt) return;

    const icons: Record<string, string> = { pdf: '📄', html: '🌐', txt: '📝', zip: '📦' };
    const labels: Record<string, string> = { pdf: 'PDF', html: 'HTML', txt: 'TXT', zip: 'ZIP' };
    const loadingLabels: Record<string, string> = {
      pdf: 'Gerando documento PDF...',
      html: 'Gerando página HTML...',
      txt: 'Gerando arquivo de texto...',
      zip: 'Gerando projeto ZIP...',
    };

    await addMessage(activeConversationId, { role: 'user', content: `${icons[type]} Gerar ${labels[type]}: ${prompt}` });
    setIsStreaming(true);
    setLoadingLabel(loadingLabels[type]);
    setStreamingContent('');

    // Build special instruction for AI based on file type
    let instruction = '';
    switch (type) {
      case 'pdf':
        instruction = `[INSTRUÇÃO: Gere um documento bem estruturado em markdown com títulos (##), subtítulos (###), listas e parágrafos. Seja detalhado e profissional. O conteúdo será convertido em PDF.]\n\nTema: ${prompt}`;
        break;
      case 'html':
        instruction = `[INSTRUÇÃO: Gere uma página HTML5 completa, autocontida e funcional. Inclua CSS dentro de uma tag <style> e JavaScript dentro de uma tag <script> se necessário. NÃO inclua explicações - retorne APENAS o código HTML começando com <!DOCTYPE html>.]\n\nTema: ${prompt}`;
        break;
      case 'txt':
        instruction = `[INSTRUÇÃO: Escreva um texto limpo, bem estruturado e profissional. Não use formatação markdown - apenas texto puro com quebras de linha.]\n\nTema: ${prompt}`;
        break;
      case 'zip':
        instruction = `[INSTRUÇÃO: Crie os arquivos de um projeto de código. Responda APENAS com um JSON válido no formato abaixo. NÃO inclua explicações ou texto fora do JSON:
{"projectName": "nome-do-projeto", "files": [{"name": "arquivo1.ext", "content": "conteúdo"}, {"name": "arquivo2.ext", "content": "conteúdo"}]}]\n\nProjeto: ${prompt}`;
        break;
    }

    const currentConv = getActiveConversation();
    const history = [
      ...(currentConv?.messages || []),
      { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: instruction,
        timestamp: new Date()
      }
    ];

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
            try {
              let fileUrl: string;
              let fileName: string;
              let displayContent: string;

              switch (type) {
                case 'pdf':
                  fileUrl = await generatePDF(fullContent, prompt.slice(0, 50));
                  fileName = `ventel-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
                  displayContent = fullContent.length > 500 ? fullContent.slice(0, 500) + '\n\n... *(conteúdo completo no PDF)*' : fullContent;
                  break;
                case 'html':
                  fileUrl = generateHTML(fullContent, prompt.slice(0, 50));
                  fileName = `nexusia-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.html`;
                  displayContent = '✅ Página HTML gerada com sucesso!\n\nClique no botão abaixo para baixar o arquivo.';
                  break;
                case 'txt':
                  fileUrl = generateTXT(fullContent);
                  fileName = `nexusia-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
                  displayContent = fullContent.length > 500 ? fullContent.slice(0, 500) + '\n\n... *(conteúdo completo no arquivo)*' : fullContent;
                  break;
                case 'zip':
                  fileUrl = await generateZIP(fullContent, prompt.slice(0, 30));
                  fileName = `nexusia-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.zip`;
                  displayContent = '✅ Projeto ZIP gerado com sucesso!\n\nClique no botão abaixo para baixar o arquivo com todos os arquivos do projeto.';
                  break;
                default:
                  throw new Error('Tipo de arquivo não suportado');
              }

              await addMessage(activeConversationId, {
                role: 'assistant',
                content: `${icons[type]} **${labels[type]} Gerado: ${prompt}**\n\n${displayContent}`,
                attachments: [{ type: 'file', name: fileName, url: fileUrl, mimeType: `application/${type}` }],
              });

              // Auto-download the file
              downloadFile(fileUrl, fileName);
              toast.success(`${labels[type]} gerado e baixado com sucesso!`);

            } catch (fileError: any) {
              console.error('File generation error:', fileError);
              await addMessage(activeConversationId, {
                role: 'assistant',
                content: `❌ Erro ao criar o arquivo ${labels[type]}. ${fileError.message || 'Tente novamente.'}`,
              });
            }
          }
          setIsStreaming(false);
          setStreamingContent('');
          setLoadingLabel('');
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          setStreamingContent('');
          setLoadingLabel('');
        },
      });
    } catch (e) {
      toast.error('Erro ao conectar com a IA. Tente novamente.');
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

    // /pdf command — PDF generation
    if (content.startsWith('/pdf ')) {
      const prompt = content.replace('/pdf ', '').trim();
      await handleFileGeneration('pdf', prompt);
      return;
    }

    // /html command — HTML generation
    if (content.startsWith('/html ')) {
      const prompt = content.replace('/html ', '').trim();
      await handleFileGeneration('html', prompt);
      return;
    }

    // /txt command — TXT generation
    if (content.startsWith('/txt ')) {
      const prompt = content.replace('/txt ', '').trim();
      await handleFileGeneration('txt', prompt);
      return;
    }

    // /zip command — ZIP generation
    if (content.startsWith('/zip ')) {
      const prompt = content.replace('/zip ', '').trim();
      await handleFileGeneration('zip', prompt);
      return;
    }

    // Process attachments
    let processedAttachments: { type: 'image' | 'file'; url: string; name: string }[] = [];
    
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        processedAttachments.push({
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: dataUrl,
          name: file.name,
        });
      }
    }

    await addMessage(activeConversationId, { 
      role: 'user', 
      content,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined
    });
    setIsStreaming(true);
    setStreamingContent('');
    setLoadingLabel('');

    const currentConv = getActiveConversation();
    const history = currentConv?.messages || [];

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
      <div className="px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm flex items-center gap-3">
        {agent && (
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-sm">{agent.icon}</span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {agent?.name || 'Ventel IA'}
          </span>
          {agent && (
            <span className="text-[11px] text-muted-foreground leading-tight">
              {agent.description}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-6">
        {conversation?.messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground mb-1">Como posso ajudar?</p>
              <p className="text-sm text-muted-foreground">Envie uma mensagem para começar</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                { label: '💬 O que você pode fazer?', action: () => handleSend('Olá! O que você pode fazer?') },
                { label: '🎨 Gerar uma imagem', action: () => handleImageGeneration('um gato astronauta flutuando no espaço', 'fast') },
                { label: '🔍 Buscar na web', action: () => handleSend('/search últimas notícias de tecnologia') },
                { label: '🔊 Gerar áudio', action: () => handleSend('/voz Olá! Eu sou a Ventel IA.') },
                { label: '📄 Gerar PDF', action: () => handleFileGeneration('pdf', 'Guia sobre inteligência artificial') },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="px-4 py-2 bg-card border border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  {item.label}
                </button>
              ))}
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
              {loadingLabel.includes('imagem') ? (
                <ImageIcon className="h-4 w-4 text-primary animate-pulse" />
              ) : loadingLabel.includes('PDF') || loadingLabel.includes('HTML') || loadingLabel.includes('texto') || loadingLabel.includes('ZIP') ? (
                <FileText className="h-4 w-4 text-primary animate-pulse" />
              ) : loadingLabel.includes('áudio') ? (
                <Mic className="h-4 w-4 text-primary animate-pulse" />
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
