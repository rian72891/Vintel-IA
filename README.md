<h1 align="center">🤖 Vintel IA</h1>
<p align="center"><strong>Plataforma SaaS de Agentes de Inteligência Artificial</strong></p>

<p align="center">
  <a href="https://vintel-ia.lovable.app">🔗 Acessar demo</a>
</p>

---

## Sobre o projeto

O Vintel IA é uma plataforma de agentes de IA construída para operar no nível de produtos como Claude, ChatGPT e Manus — com foco em orquestração inteligente, memória e autonomia de execução.

## ✨ Funcionalidades

- 💬 **Chat inteligente** com Google Gemini (fallback automático Pro → Flash)
- 🧠 **Memória persistente** entre conversas
- ⚙️ **Execução de tarefas em segundo plano** (independente da conexão aberta)
- 🔍 **Trace visual em tempo real** do raciocínio e das chamadas de ferramentas do agente
- ✅ **Confirmação de segurança** antes de ações irreversíveis
- ✏️ Edição de mensagens e regeneração de respostas
- 📱 **PWA instalável**
- 💳 Pagamentos via Stripe
- 🔗 Integrações com Slack, Linear e Asana

## 🛠️ Stack

[![Lovable](https://img.shields.io/badge/Lovable-8A2BE2?style=for-the-badge&logo=lightning&logoColor=white)](https://lovable.dev)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://gemini.google.com)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)

**Frontend/backend construídos com Lovable · Banco de dados e autenticação: Supabase**

## CI e avaliações

Todo push ou pull request direcionado à branch `main` executa automaticamente o workflow `.github/workflows/ci.yml`, que instala as dependências com `npm ci`, executa o build de produção, roda todos os testes e executa o linter. A suíte fixa de comportamento do agente está em `src/test/agent-eval.test.ts` e usa respostas de rede mockadas, sem chamadas a provedores de IA reais.

## Monitoramento com Sentry

O frontend usa `@sentry/react` quando `VITE_SENTRY_DSN` está configurada. O SDK captura erros JavaScript não tratados, rejeições de promises e erros de renderização via Error Boundary. Falhas HTTP do chat são reportadas apenas como metadados — status, tipo do erro, rota e stack — sem tokens, headers de autenticação ou mensagens completas do usuário.

Para ativar o monitoramento, crie uma conta gratuita em [sentry.io](https://sentry.io), crie um projeto **React**, copie o DSN gerado e defina `VITE_SENTRY_DSN` no ambiente do frontend, como nas variáveis de ambiente da Vercel e no ambiente local. Sem essa variável, o Sentry permanece desativado.

## 🚧 Status

Projeto em desenvolvimento ativo.

<!-- Deploy marker: Sentry production environment refresh. -->

---

<p align="center">Desenvolvido por <a href="https://github.com/rian72891">Rian Bruno</a></p>
