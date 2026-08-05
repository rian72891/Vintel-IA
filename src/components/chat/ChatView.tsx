import { useRef, useEffect, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { agents } from '@/data/agents';
import { streamChat, type TraceStep, type ConfirmRequest, type ApprovalMap } from '@/lib/streamChat';
import { AgentTrace } from './AgentTrace';
import { ConfirmActionCard } from './ConfirmActionCard';

import { generateImage, ImageQuality } from '@/lib/generateImage';
import { textToSpeech } from '@/lib/api/elevenlabs';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { generatePDF, generateHTML, generateTXT, generateZIP, downloadFile } from '@/lib/fileGeneration';
import { Loader2, ImageIcon, FileText, Mic, Sparkles, Search, Globe } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useUsage } from '@/hooks/useUsage';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';
import { useSmoothStream } from '@/hooks/useSmoothStream';

export function ChatView() {
  const { activeConversationId, getActiveConversation, addMessage, temperature, deleteConversation, editMessage, truncateFrom } = useChatStore();
  const conversation = getActiveConversation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const { displayed: streamingContent, push: pushStream, finish: finishStream, reset: resetStream } = useSmoothStream();
  const [loadingLabel, setLoadingLabel] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { checkUsage, incrementUsage } = useUsage();
  const { plan } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const autoTriggeredRef = useRef<string | null>(null);

  // Trace visual do raciocínio do agente
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [traces, setTraces] = useState<Record<string, TraceStep[]>>({});
  const stepsRef = useRef<TraceStep[]>([]);

  // Confirmação de ações irreversíveis
  const [pendingConfirms, setPendingConfirms] = useState<ConfirmRequest[]>([]);
  const pendingRef = useRef<ConfirmRequest[]>([]);
  const approvalsRef = useRef<ApprovalMap>({});

  const handleConfirmRequest = useCallback((req: ConfirmRequest) => {
    setPendingConfirms((prev) => {
      const next = prev.some((p) => p.id === req.id) ? prev : [...prev, req];
      pendingRef.current = next;
      return next;
    });
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = [];
    setPendingConfirms([]);
  }, []);

  const handleStep = useCallback((step: TraceStep) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === step.id);
      const next = idx === -1 ? [...prev, step] : prev.map((s, i) => (i === idx ? step : s));
      stepsRef.current = next;
      return next;
    });
  }, []);

  const resetSteps = useCallback(() => {
    stepsRef.current = [];
    setSteps([]);
  }, []);

  /** Anexa o trace concluído à última mensagem do assistente. */
  const persistTrace = useCallback(() => {
    const collected = stepsRef.current;
    if (!collected.length) return;
    if (pendingRef.current.length) return; // mantém a timeline viva enquanto aguarda confirmação
    const msgs = getActiveConversation()?.messages ?? [];
    const last = [...msgs].reverse().find((m) => m.role === 'assistant');
    if (last) setTraces((prev) => ({ ...prev, [last.id]: collected }));
    resetSteps();
  }, [getActiveConversation, resetSteps]);


  // Simulate real progress feedback when a heavy task is running
  useEffect(() => {
    if (!loadingLabel) {
      setProgress(0);
      return;
    }
    setProgress(8);
    const interval = setInterval(() => {
      setProgress((p) => {
        // Cap at 92% until task actually finishes
        if (p >= 92) return p;
        // Faster early, slower near the end (logarithmic feel)
        const increment = p < 40 ? 6 : p < 70 ? 3 : 1;
        return Math.min(92, p + increment);
      });
    }, 350);
    return () => clearInterval(interval);
  }, [loadingLabel]);

  // Auto-scroll que não briga com o streaming: só acompanha se o usuário
  // já estiver perto do fim; rolagem instantânea durante o stream evita
  // animações concorrentes (tremedeira).
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation?.messages.length, streamingContent]);


  // Auto-trigger AI response when landing page sends a message
  useEffect(() => {
    if (!conversation || !activeConversationId || isStreaming) return;
    const msgs = conversation.messages;
    if (
      msgs.length === 1 &&
      msgs[0].role === 'user' &&
      autoTriggeredRef.current !== activeConversationId
    ) {
      autoTriggeredRef.current = activeConversationId;
      triggerAIResponse(msgs[0].content, msgs);
    }
  }, [conversation?.messages.length, activeConversationId]);

  const agent = conversation?.agent ? agents.find((a) => a.id === conversation.agent) : null;

  const showUpgrade = (feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeOpen(true);
  };

  const triggerAIResponse = useCallback(async (userContent: string, history: typeof conversation.messages) => {
    if (!activeConversationId) return;

    // Handle slash commands from landing page
    if (userContent.startsWith('/search ')) {
      await handleWebSearchInternal(userContent.replace('/search ', '').trim(), true);
      return;
    }
    if (userContent.startsWith('/voz ')) {
      await handleTTSInternal(userContent.replace('/voz ', '').trim(), true);
      return;
    }

    setIsStreaming(true);
    resetStream();
    resetSteps();
    clearPending();
    approvalsRef.current = {};
    setLoadingLabel('');

    let fullContent = '';
    try {
      await streamChat({
        messages: history,
        agent: conversation?.agent,
        plan,
        temperature,
        approvals: approvalsRef.current,
        onStep: handleStep,
        onConfirm: handleConfirmRequest,
        onDelta: (delta) => {
          fullContent += delta;
          pushStream(delta);
        },
        onDone: async () => {
          await new Promise<void>((r) => finishStream(r));
          if (fullContent) {
            await addMessage(activeConversationId, {
              role: 'assistant',
              content: fullContent,
              agent: conversation?.agent,
            });
          }
          setIsStreaming(false);
          resetStream();
          persistTrace();
          await incrementUsage('messages');
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          resetStream();
          resetSteps();
        },
      });
    } catch {
      toast.error('Erro ao conectar com a IA. Tente novamente.');
      setIsStreaming(false);
      resetStream();
      resetSteps();
    }
  }, [activeConversationId, conversation?.agent, plan, temperature, addMessage, incrementUsage, handleStep, resetSteps, persistTrace]);


  /** Reexecuta o turno após decisão do usuário sobre ações irreversíveis. */
  const resumeAfterDecision = useCallback(async (req: ConfirmRequest, decision: 'approved' | 'cancelled') => {
    if (!activeConversationId) return;
    approvalsRef.current = { ...approvalsRef.current, [req.id]: decision };
    setPendingConfirms((prev) => {
      const next = prev.filter((p) => p.id !== req.id);
      pendingRef.current = next;
      return next;
    });
    if (pendingRef.current.length) return; // ainda há outras ações aguardando decisão

    const history = getActiveConversation()?.messages ?? [];
    setIsStreaming(true);
    resetStream();
    resetSteps();

    let fullContent = '';
    try {
      await streamChat({
        messages: history,
        agent: conversation?.agent,
        plan,
        temperature,
        approvals: approvalsRef.current,
        onStep: handleStep,
        onConfirm: handleConfirmRequest,
        onDelta: (delta) => {
          fullContent += delta;
          pushStream(delta);
        },
        onDone: async () => {
          await new Promise<void>((r) => finishStream(r));
          if (fullContent) {
            await addMessage(activeConversationId, {
              role: 'assistant',
              content: fullContent,
              agent: conversation?.agent,
            });
          }
          setIsStreaming(false);
          resetStream();
          persistTrace();
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          resetStream();
          resetSteps();
        },
      });
    } catch {
      toast.error('Erro ao continuar a ação. Tente novamente.');
      setIsStreaming(false);
      resetStream();
      resetSteps();
    }
  }, [activeConversationId, conversation?.agent, plan, temperature, addMessage, getActiveConversation, handleStep, handleConfirmRequest, persistTrace, resetSteps, resetStream, pushStream, finishStream]);

  // Internal handlers that skip adding user message (already exists)
  const handleTTSInternal = async (text: string, skipUserMsg: boolean) => {
    if (!activeConversationId || !text) return;
    if (!checkUsage('audio')) { showUpgrade('áudio'); return; }

    if (!skipUserMsg) await addMessage(activeConversationId, { role: 'user', content: `🔊 Gerar áudio: ${text}` });
    setIsStreaming(true);
    setLoadingLabel('Gerando áudio...');
    resetStream();

    try {
      const dataUrl = await textToSpeech(text);
      setAudioUrl(dataUrl);
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `🔊 Áudio gerado com sucesso!\n\nTexto: "${text.length > 100 ? text.substring(0, 100) + '...' : text}"`,
      });
      await incrementUsage('audio');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar áudio.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Não foi possível gerar o áudio. ${e.message || 'Tente novamente.'}`,
      });
    } finally {
      setIsStreaming(false);
      resetStream();
      setLoadingLabel('');
    }
  };

  const handleWebSearchInternal = async (query: string, skipUserMsg: boolean) => {
    if (!activeConversationId || !query) return;

    if (!skipUserMsg) await addMessage(activeConversationId, { role: 'user', content: `🔍 Buscar na web: ${query}` });
    setIsStreaming(true);
    setLoadingLabel('Buscando na web...');
    resetStream();

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
      resetStream();
      setLoadingLabel('');
    }
  };

  const handleImageGeneration = async (prompt: string, quality: ImageQuality) => {
    if (!activeConversationId || !prompt) return;
    if (!checkUsage('images')) { showUpgrade('imagens'); return; }

    const qualityLabel = quality === 'hd' ? '(HD)' : '(rápido)';
    await addMessage(activeConversationId, { role: 'user', content: `🎨 Gerar imagem ${qualityLabel}: ${prompt}` });
    setIsStreaming(true);
    setLoadingLabel('Gerando imagem...');
    resetStream();

    try {
      const result = await generateImage(prompt, quality);
      const desc = result.description || `Imagem gerada: ${prompt}`;
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: desc,
        attachments: [{ type: 'image', name: prompt, url: result.imageUrl }],
      });
      await incrementUsage('images');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar imagem.');
      await addMessage(activeConversationId, {
        role: 'assistant',
        content: `❌ Não foi possível gerar a imagem. ${e.message || 'Tente novamente.'}`,
      });
    } finally {
      setIsStreaming(false);
      resetStream();
      setLoadingLabel('');
    }
  };

  const handleTTS = async (text: string) => handleTTSInternal(text, false);

  const handleScrape = async (url: string) => {
    if (!activeConversationId || !url) return;

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    try {
      new URL(formattedUrl);
    } catch {
      await addMessage(activeConversationId, { role: 'user', content: `🌐 Extrair conteúdo: ${url}` });
      await addMessage(activeConversationId, { role: 'assistant', content: `⚠️ **"${url}"** não é uma URL válida.` });
      return;
    }

    await addMessage(activeConversationId, { role: 'user', content: `🌐 Extrair conteúdo: ${url}` });
    setIsStreaming(true);
    setLoadingLabel('Extraindo conteúdo do site...');
    resetStream();

    try {
      const result = await firecrawlApi.scrape(url);
      const markdown = result.data?.markdown || (result as any).markdown || '';
      const metadata = result.data?.metadata || (result as any).metadata || {};
      const title = metadata?.title || url;

      if (!markdown) {
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `⚠️ Não foi possível extrair conteúdo de **${url}**.`,
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
      resetStream();
      setLoadingLabel('');
    }
  };

  const handleWebSearch = async (query: string) => handleWebSearchInternal(query, false);

  const handleFileGeneration = async (type: 'pdf' | 'html' | 'txt' | 'zip', prompt: string) => {
    if (!activeConversationId || !prompt) return;
    if (!checkUsage('files')) { showUpgrade('arquivos'); return; }

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
    resetStream();

    let instruction = '';
    switch (type) {
      case 'pdf':
        instruction = `[INSTRUÇÃO: Gere um documento profissional e bem estruturado em markdown. Use títulos (## e ###), subtítulos, listas numeradas e com marcadores, parágrafos detalhados, tabelas quando apropriado, e citações (>). Aplique **negrito** para termos importantes e *itálico* para ênfase. Organize o conteúdo em seções lógicas com introdução, desenvolvimento e conclusão. Seja detalhado, técnico e profissional. O conteúdo será convertido em PDF formatado.]\n\nTema: ${prompt}`;
        break;
      case 'html':
        instruction = `[INSTRUÇÃO: Gere uma página HTML5 COMPLETA, moderna e profissional. OBRIGATÓRIO:
1. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
2. Crie uma estrutura completa com: Navbar fixa no topo, Hero section com gradiente, seção de Cards/Serviços em grid responsivo, seção de Depoimentos ou Features, Footer com links e copyright.
3. Use classes Tailwind modernas: bg-gradient-to-br, rounded-2xl, shadow-xl, hover:scale-105, transition-all, etc.
4. Adicione ícones SVG inline quando necessário.
5. Garanta responsividade com sm:, md:, lg: breakpoints.
6. Use cores profissionais e consistentes (ex: indigo-600, slate-900).
7. Adicione interatividade básica com JavaScript inline (menu mobile, scroll suave).
8. NÃO inclua explicações — retorne APENAS o código HTML começando com <!DOCTYPE html>.
9. O design deve parecer profissional e moderno, como um site real de startup/SaaS.]\n\nTema: ${prompt}`;
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
        plan,
        temperature,
        onDelta: (delta) => {
          fullContent += delta;
          pushStream(delta);
        },
        onDone: async () => {
          await new Promise<void>((r) => finishStream(r));
          if (fullContent) {
            try {
              let fileUrl: string;
              let fileName: string;
              let displayContent: string;

              switch (type) {
                case 'pdf':
                  fileUrl = await generatePDF(fullContent, prompt.slice(0, 50));
                  fileName = `vintel-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
                  displayContent = fullContent.length > 500 ? fullContent.slice(0, 500) + '\n\n... *(conteúdo completo no PDF)*' : fullContent;
                  break;
                case 'html':
                  fileUrl = generateHTML(fullContent, prompt.slice(0, 50));
                  fileName = `vintel-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.html`;
                  displayContent = '✅ Página HTML gerada com sucesso!\n\nClique no botão abaixo para baixar o arquivo.';
                  break;
                case 'txt':
                  fileUrl = generateTXT(fullContent);
                  fileName = `vintel-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
                  displayContent = fullContent.length > 500 ? fullContent.slice(0, 500) + '\n\n... *(conteúdo completo no arquivo)*' : fullContent;
                  break;
                case 'zip':
                  fileUrl = await generateZIP(fullContent, prompt.slice(0, 30));
                  fileName = `vintel-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.zip`;
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

              downloadFile(fileUrl, fileName);
              toast.success(`${labels[type]} gerado e baixado com sucesso!`);
              await incrementUsage('files');

            } catch (fileError: any) {
              console.error('File generation error:', fileError);
              await addMessage(activeConversationId, {
                role: 'assistant',
                content: `❌ Erro ao criar o arquivo ${labels[type]}. ${fileError.message || 'Tente novamente.'}`,
              });
            }
          }
          setIsStreaming(false);
          resetStream();
          setLoadingLabel('');
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          resetStream();
          setLoadingLabel('');
        },
      });
    } catch (e) {
      toast.error('Erro ao conectar com a IA. Tente novamente.');
      setIsStreaming(false);
      resetStream();
      setLoadingLabel('');
    }
  };

  // Handle message editing
  /** Edita a mensagem do usuário, descarta tudo depois dela e regenera a resposta. */
  const handleEditSubmit = useCallback(async (messageId: string, newContent: string) => {
    if (!activeConversationId || isStreaming) return;
    const history = await editMessage(activeConversationId, messageId, newContent);
    if (!history.length) return;
    await triggerAIResponse(newContent, history);
  }, [activeConversationId, isStreaming, editMessage]);

  /** Refaz a resposta do agente a partir da mesma pergunta. */
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (!activeConversationId || isStreaming) return;
    const history = await truncateFrom(activeConversationId, messageId, true);
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    await triggerAIResponse(lastUser.content, history);
  }, [activeConversationId, isStreaming, truncateFrom]);


  const handleSend = async (content: string, attachments?: File[]) => {
    if (!activeConversationId) return;

    // Process attachments first to check for image editing
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

    // Detect image editing
    const hasImageAttachment = processedAttachments.some(a => a.type === 'image');
    const imageEditKeywords = ['recri', 'edit', 'modifi', 'alter', 'transform', 'mude', 'muda', 'troque', 'troca', 'refaz', 'refaç', 'imagine', 'gere', 'gerar', 'crie', 'criar', 'tipo', 'estilo', 'igual', 'parecid', 'mesm'];
    const lowerContent = content.toLowerCase();
    const isImageEditRequest = hasImageAttachment && (
      content.startsWith('/imagine ') ||
      content.startsWith('/imaginehd ') ||
      imageEditKeywords.some(k => lowerContent.includes(k)) ||
      lowerContent.length < 100
    );

    if (isImageEditRequest && hasImageAttachment) {
      if (!checkUsage('images')) { showUpgrade('imagens'); return; }
      const imageAtt = processedAttachments.find(a => a.type === 'image')!;
      const prompt = content.replace(/^\/(imagine|imaginehd)\s*/, '').trim() || 'Recrie esta imagem com melhorias';
      const quality: ImageQuality = content.startsWith('/imaginehd ') ? 'hd' : 'fast';

      await addMessage(activeConversationId, {
        role: 'user',
        content: `🎨 Editar imagem: ${prompt}`,
        attachments: processedAttachments,
      });
      setIsStreaming(true);
      setLoadingLabel('Editando imagem com IA...');
      resetStream();

      try {
        const result = await generateImage(prompt, quality, imageAtt.url);
        const desc = result.description || `Imagem editada: ${prompt}`;
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: desc,
          attachments: [{ type: 'image', name: `edited-${prompt.slice(0, 30)}`, url: result.imageUrl }],
        });
        await incrementUsage('images');
      } catch (e: any) {
        toast.error(e.message || 'Erro ao editar imagem.');
        await addMessage(activeConversationId, {
          role: 'assistant',
          content: `❌ Não foi possível editar a imagem. ${e.message || 'Tente novamente.'}`,
        });
      } finally {
        setIsStreaming(false);
        resetStream();
        setLoadingLabel('');
      }
      return;
    }

    if (content.startsWith('/imagine ')) {
      const prompt = content.replace('/imagine ', '').trim();
      await handleImageGeneration(prompt, 'fast');
      return;
    }
    if (content.startsWith('/imaginehd ')) {
      const prompt = content.replace('/imaginehd ', '').trim();
      await handleImageGeneration(prompt, 'hd');
      return;
    }
    if (content.startsWith('/voz ')) {
      const text = content.replace('/voz ', '').trim();
      await handleTTS(text);
      return;
    }
    if (content.startsWith('/scrape ')) {
      const url = content.replace('/scrape ', '').trim();
      await handleScrape(url);
      return;
    }
    if (content.startsWith('/search ')) {
      const query = content.replace('/search ', '').trim();
      await handleWebSearch(query);
      return;
    }
    if (content.startsWith('/pdf ')) {
      const prompt = content.replace('/pdf ', '').trim();
      await handleFileGeneration('pdf', prompt);
      return;
    }
    if (content.startsWith('/html ')) {
      const prompt = content.replace('/html ', '').trim();
      await handleFileGeneration('html', prompt);
      return;
    }
    if (content.startsWith('/txt ')) {
      const prompt = content.replace('/txt ', '').trim();
      await handleFileGeneration('txt', prompt);
      return;
    }
    if (content.startsWith('/zip ')) {
      const prompt = content.replace('/zip ', '').trim();
      await handleFileGeneration('zip', prompt);
      return;
    }

    // Check message usage
    if (!checkUsage('messages')) { showUpgrade('mensagens'); return; }

    // Check if sending image for analysis
    if (hasImageAttachment) {
      if (!checkUsage('image_analyses')) { showUpgrade('análises de imagem'); return; }
    }

    await addMessage(activeConversationId, { 
      role: 'user', 
      content,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined
    });
    setIsStreaming(true);
    resetStream();
    resetSteps();
    clearPending();
    approvalsRef.current = {};
    setLoadingLabel('');

    const currentConv = getActiveConversation();
    const history = currentConv?.messages || [];

    let fullContent = '';

    try {
      await streamChat({
        messages: history,
        agent: conversation?.agent,
        plan,
        temperature,
        approvals: approvalsRef.current,
        onStep: handleStep,
        onConfirm: handleConfirmRequest,
        onDelta: (delta) => {
          fullContent += delta;
          pushStream(delta);
        },
        onDone: async () => {
          await new Promise<void>((r) => finishStream(r));
          if (fullContent) {
            await addMessage(activeConversationId, {
              role: 'assistant',
              content: fullContent,
              agent: conversation?.agent,
            });
          }
          setIsStreaming(false);
          resetStream();
          persistTrace();
          await incrementUsage('messages');
          if (hasImageAttachment) {
            await incrementUsage('image_analyses');
          }
        },
        onError: (error) => {
          toast.error(error);
          setIsStreaming(false);
          resetStream();
          resetSteps();
        },
      });
    } catch (e) {
      toast.error('Erro ao conectar com a IA. Tente novamente.');
      setIsStreaming(false);
      resetStream();
      resetSteps();
    }

  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      <div className="px-4 py-3 bg-background flex items-center gap-3">
        {agent && (
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-sm">{agent.icon}</span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {agent?.name || 'Vintel IA'}
          </span>
          {agent && (
            <span className="text-[11px] text-muted-foreground leading-tight">
              {agent.description}
            </span>
          )}
        </div>
      </div>

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
                { label: '🔊 Gerar áudio', action: () => handleSend('/voz Olá! Eu sou o Vintel IA.') },
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
          <MessageRow
            key={msg.id}
            msg={msg}
            trace={traces[msg.id]}
            audioUrl={msg.content.startsWith('🔊 Áudio gerado') ? audioUrl : undefined}
            onEdit={handleEditSubmit}
            onRegenerate={handleRegenerate}
          />
        ))}

        {(isStreaming || pendingConfirms.length > 0) && steps.length > 0 && (
          <div className="px-4 max-w-4xl mx-auto w-full pt-2">
            <AgentTrace steps={steps} live />
          </div>
        )}
        {pendingConfirms.length > 0 && (
          <div className="px-4 max-w-4xl mx-auto w-full pt-2 space-y-2">
            {pendingConfirms.map((req) => (
              <ConfirmActionCard
                key={req.id}
                request={req}
                busy={isStreaming}
                onConfirm={(r) => resumeAfterDecision(r, 'approved')}
                onCancel={(r) => resumeAfterDecision(r, 'cancelled')}
              />
            ))}
          </div>
        )}
        {isStreaming && streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date(),
            }}
            isStreaming
          />
        )}
        {isStreaming && !streamingContent && steps.length === 0 && (

          <div className="flex gap-3 px-4 py-3 max-w-4xl mx-auto w-full">
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
              {loadingLabel.includes('imagem') ? (
                <ImageIcon className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : loadingLabel.includes('PDF') || loadingLabel.includes('HTML') || loadingLabel.includes('texto') || loadingLabel.includes('ZIP') ? (
                <FileText className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : loadingLabel.includes('áudio') ? (
                <Mic className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : loadingLabel.includes('Buscando') ? (
                <Search className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : loadingLabel.includes('Extraindo') ? (
                <Globe className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2.5 max-w-xl">
              {loadingLabel ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-foreground/80 font-medium">{loadingLabel}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-muted/40" />
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-3 w-[85%]" />
                    <Skeleton className="h-3 w-[70%]" />
                    <Skeleton className="h-3 w-[60%]" />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 py-2">
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature={upgradeFeature} />
    </div>
  );
}
