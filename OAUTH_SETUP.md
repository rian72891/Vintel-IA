# Configuração de Conectores OAuth - Vintel IA

## Status Atual

✅ **Backend**: Totalmente implementado e pronto
✅ **Frontend**: Totalmente implementado e pronto
⏳ **Variáveis de Ambiente**: Aguardando configuração no Vercel

## Conectores Implementados

O projeto Vintel IA já possui suporte completo para os seguintes conectores OAuth:

1. **Google Workspace** ✅
2. **GitHub** ✅
3. **Notion** ✅
4. **Slack** ✅
5. **Linear** ✅
6. **Asana** ✅

## Como Configurar no Vercel

### Passo 1: Acessar o Dashboard do Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Navegue até seu projeto `Vintel-IA`
3. Clique em **Settings** → **Environment Variables**

### Passo 2: Adicionar Variáveis de Ambiente

Adicione as seguintes variáveis de ambiente no Vercel:

#### Para Slack
```
SLACK_CLIENT_ID = your_slack_client_id
SLACK_CLIENT_SECRET = your_slack_client_secret
```

#### Para Linear
```
LINEAR_CLIENT_ID = your_linear_client_id
LINEAR_CLIENT_SECRET = your_linear_client_secret
```

#### Para Asana
```
ASANA_CLIENT_ID = your_asana_client_id
ASANA_CLIENT_SECRET = your_asana_client_secret
```

### Passo 3: Configurar no Supabase (Funções Edge)

Se você estiver usando Supabase, as variáveis de ambiente também precisam estar configuradas no **Supabase Dashboard**:

1. Acesse [supabase.com](https://supabase.com)
2. Selecione seu projeto
3. Vá para **Settings** → **Edge Functions** → **Secrets**
4. Adicione as mesmas variáveis acima

Ou via CLI:
```bash
supabase secrets set SLACK_CLIENT_ID=your_slack_client_id
supabase secrets set SLACK_CLIENT_SECRET=your_slack_client_secret
supabase secrets set LINEAR_CLIENT_ID=your_linear_client_id
supabase secrets set LINEAR_CLIENT_SECRET=your_linear_client_secret
supabase secrets set ASANA_CLIENT_ID=your_asana_client_id
supabase secrets set ASANA_CLIENT_SECRET=your_asana_client_secret
```

### Passo 4: Redeploy

Após adicionar as variáveis de ambiente:

1. No Vercel, clique em **Deployments**
2. Clique em **Redeploy** no último deployment
3. Aguarde a conclusão do deploy

Ou via CLI:
```bash
vercel deploy --prod
```

## Testando os Conectores

Após configurar as variáveis de ambiente:

1. Acesse `/conectores` no seu aplicativo
2. Clique em "Conectar" para Slack, Linear ou Asana
3. Você será redirecionado para o fluxo OAuth de cada serviço
4. Após autorizar, o conector aparecerá como "Conectado"

## Arquitetura Implementada

### Frontend (`src/pages/Conectores.tsx`)

- Exibe cards para cada conector (Slack, Linear, Asana, etc.)
- Botão "Conectar" inicia o fluxo OAuth
- Exibe status "Conectado" com informações da conta
- Menu dropdown com opções de "Testar conexão", "Reconectar" e "Desconectar"

### Backend (Supabase Edge Functions)

#### `oauth-init`
- Gera a URL de autorização OAuth
- Valida se as credenciais estão configuradas
- Retorna erro se CLIENT_ID/SECRET estiverem faltando

#### `oauth-callback`
- Recebe o código de autorização
- Faz exchange do código pelo access token
- Armazena o token no banco de dados
- Busca informações da conta do usuário (email, nome, etc.)
- Atualiza o status do conector para "conectado"

#### `connector-test`
- Testa a validade do token armazenado
- Atualiza `last_synced_at` se bem-sucedido
- Registra erro se o token expirou ou é inválido

### Banco de Dados

#### Tabela `oauth_tokens`
```sql
- user_id (UUID)
- provider (TEXT): 'slack', 'linear', 'asana', etc.
- access_token (TEXT)
- refresh_token (TEXT, nullable)
- scope (TEXT, nullable)
- token_type (TEXT, nullable)
- expires_at (TIMESTAMP, nullable)
- updated_at (TIMESTAMP)
```

#### Tabela `user_connectors`
```sql
- user_id (UUID)
- provider (TEXT)
- status (TEXT): 'connected' ou 'error'
- account_label (TEXT): email ou nome do usuário
- scopes (TEXT)
- last_synced_at (TIMESTAMP)
- last_error (TEXT)
- updated_at (TIMESTAMP)
```

## Fluxo de Autenticação OAuth

```
1. Usuário clica em "Conectar" no card do conector
   ↓
2. Frontend chama `oauth-init` com provider e redirect_uri
   ↓
3. Backend retorna URL de autorização do provedor
   ↓
4. Frontend redireciona para a URL de autorização
   ↓
5. Usuário autoriza no provedor (Slack, Linear, Asana, etc.)
   ↓
6. Provedor redireciona para `/auth/callback/{provider}?code=...`
   ↓
7. Frontend extrai o código e chama `oauth-callback`
   ↓
8. Backend faz exchange do código pelo access token
   ↓
9. Backend armazena o token em `oauth_tokens`
   ↓
10. Backend atualiza `user_connectors` com status 'connected'
    ↓
11. Frontend redireciona para `/conectores`
    ↓
12. Conector aparece como "Conectado" com informações da conta
```

## Troubleshooting

### "Configuração pendente" ao clicar em Conectar

**Causa**: As variáveis de ambiente não estão configuradas no Vercel/Supabase

**Solução**: Adicione as variáveis de ambiente conforme o Passo 2 e 3 acima

### Token inválido ou expirado

**Causa**: O token armazenado expirou

**Solução**: Clique em "Reconectar" no menu dropdown do conector

### "Unauthorized" ao testar conexão

**Causa**: O usuário não está autenticado ou o token está inválido

**Solução**: Faça logout e login novamente, depois reconecte o conector

## Próximos Passos

1. ✅ Adicione as variáveis de ambiente no Vercel
2. ✅ Adicione as variáveis de ambiente no Supabase
3. ✅ Redeploy o projeto
4. ✅ Teste os conectores em `/conectores`
5. ✅ Implemente integrações específicas para cada conector conforme necessário

## Referências

- [Slack OAuth Documentation](https://api.slack.com/authentication/oauth-v2)
- [Linear OAuth Documentation](https://developers.linear.app/docs/oauth)
- [Asana OAuth Documentation](https://developers.asana.com/docs/oauth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
