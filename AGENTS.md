# Vintel IA — regras técnicas

- Slash commands (`/imagine`, `/imaginehd`, `/voz`, `/search`, `/scrape`, `/pdf`, `/html`, `/txt`, `/zip`) são tratados só pelo `ChatView`. A barra da tela inicial (`AgentSelector`) não os executa: ela cria a conversa e grava o texto em `chatStore.pendingCommand`, e o `ChatView` consome via `takePendingCommand`. Motivo: duplicar a lógica de comandos em dois lugares faria os comandos se comportarem diferente conforme a origem.
- Ao consumir `pendingCommand`, o `ChatView` precisa assinar o próprio campo do store (não só `activeConversationId`), porque a tela pode montar antes de o comando ser gravado.
- A geração de imagens usa Gemini primeiro e o gerador gratuito `image.pollinations.ai` como fallback. O gerador gratuito exige que a edge function peça a imagem ~12% mais alta e o app corte a faixa inferior; sem esse corte a marca d'água aparece.
- Authentication and plan/rate-limit denials return HTTP 401/429; callers must consume their error payloads without uncaught rejections. Provider generation errors retain the existing response contract to preserve the UI.
- Image usage is incremented only in generate-image after success; ChatView refreshes usage and update-usage rejects image increments to avoid double counting.
- `npx tsgo --noEmit -p tsconfig.app.json` e `bunx vitest run` precisam passar antes de encerrar qualquer mudança em `src/` ou `supabase/functions/`.
