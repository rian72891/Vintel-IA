import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-semibold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Em conformidade com a LGPD (Lei nº 13.709/2018) · Última atualização: 10 de julho de 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Controlador dos Dados</h2>
            <p>O Vintel IA atua como controlador dos dados coletados através do Serviço. Contato do encarregado (DPO): privacidade@vintel-ia.app</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Dados que Coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Dados de conta:</strong> nome, e-mail, foto de perfil (via Google).</li>
              <li><strong className="text-foreground">Conteúdo:</strong> mensagens, arquivos e artefatos gerados durante o uso.</li>
              <li><strong className="text-foreground">Tokens OAuth:</strong> tokens de acesso a serviços conectados (GitHub, Google, Lovable), armazenados de forma criptografada.</li>
              <li><strong className="text-foreground">Dados de uso:</strong> métricas anônimas de navegação (via analytics).</li>
              <li><strong className="text-foreground">Dados de pagamento:</strong> processados diretamente pela Stripe; não armazenamos dados de cartão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Base Legal (Art. 7º LGPD)</h2>
            <p>Tratamos seus dados com base em: (i) execução de contrato; (ii) consentimento para integrações opcionais; (iii) legítimo interesse para segurança e melhoria do serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Uso dos Dados</h2>
            <p>Utilizamos seus dados para operar o Serviço, personalizar respostas da IA, processar pagamentos, prevenir fraudes e comunicar atualizações importantes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento com Terceiros</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provedores de IA (Google Gemini, OpenAI) — para processar suas mensagens.</li>
              <li>Supabase — infraestrutura de banco e autenticação.</li>
              <li>Stripe — processamento de pagamentos.</li>
              <li>Serviços conectados por você (GitHub, Google Drive, etc.) — apenas conforme suas ações explícitas.</li>
            </ul>
            <p>Não vendemos seus dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Seus Direitos (Art. 18 LGPD)</h2>
            <p>Você pode, a qualquer momento, solicitar: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, revogação de consentimento. Envie sua solicitação para privacidade@vintel-ia.app.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Retenção</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão da conta, os dados são removidos em até 30 dias, exceto quando houver obrigação legal de retenção.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Segurança</h2>
            <p>Aplicamos criptografia em trânsito (TLS) e em repouso, políticas de Row-Level Security no banco de dados e revisões periódicas de segurança. Nenhum sistema é 100% seguro; incidentes serão comunicados conforme a ANPD exigir.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Cookies e Analytics</h2>
            <p>Utilizamos cookies essenciais para autenticação e um serviço de analytics sem cookies (Plausible) para métricas agregadas e anônimas. Não realizamos rastreamento cross-site.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Menores de Idade</h2>
            <p>O Serviço não é destinado a menores de 13 anos. Menores entre 13 e 18 anos devem ter autorização dos responsáveis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Alterações</h2>
            <p>Atualizações desta Política serão publicadas nesta página com a data de revisão atualizada.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
