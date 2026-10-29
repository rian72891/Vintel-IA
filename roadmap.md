# Roadmap — Vintel IA

## Proteções solicitadas — RB07
- [ ] 1. Autenticação, limite mensal e contagem única no servidor para imagens; testar.
- [ ] 2. Limite de 10 mensagens por 60 segundos e aviso distinto; testar.

## Melhorias gratuitas (lote atual)

- [x] 1. Tarefas agendadas (pg_cron → edge function dedicada, salvar resultado como conversa, tela de config)
- [x] 2. Sub-agentes em paralelo (tool calls independentes via `Promise.all` em `supabase/functions/chat/index.ts`)
- [x] 3. Upload de documentos por conversa (storage + `conversation_documents` + extração de texto + injeção de contexto)
- [x] 4. Página pública de status/uptime (`/status`)
- [x] 5. Indicador de uso no chat ("X de Y mensagens hoje")
- [x] 6. Multi-idioma (pt/en) com seletor nas configurações
- [x] 7. Exportar conversa atual como Markdown (.md)
- [x] 8. Gerador de imagens gratuito (fallback sem chave/cartão quando a cota do Gemini acaba; corte da marca d'água no app)
- [x] 9. Comandos (/imagine, /search, /pdf...) da barra da tela inicial agora executam de verdade (rota via `pendingCommand`)
