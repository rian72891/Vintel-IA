import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Termos() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-semibold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 10 de julho de 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação</h2>
            <p>Ao acessar ou utilizar o Vintel IA ("Serviço"), você concorda com estes Termos. Se não concordar, não utilize o Serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p>O Vintel IA é uma plataforma de assistente de inteligência artificial que oferece geração de texto, código, imagens, áudio e integrações com serviços de terceiros (GitHub, Google, Lovable).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Conta e Elegibilidade</h2>
            <p>Você deve ter pelo menos 13 anos para usar o Serviço. Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades sob sua conta.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Uso Aceitável</h2>
            <p>Você concorda em não utilizar o Serviço para: (a) atividades ilegais; (b) gerar conteúdo que viole direitos de terceiros; (c) tentar burlar limites técnicos ou de segurança; (d) revender ou redistribuir o Serviço sem autorização.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Planos e Pagamentos</h2>
            <p>Planos pagos são processados via Stripe. Cobranças recorrentes ocorrem no ciclo contratado. Cancelamentos podem ser feitos a qualquer momento e valem para o próximo ciclo. Não realizamos reembolsos de créditos já consumidos.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Conteúdo Gerado por IA</h2>
            <p>Respostas geradas pela IA podem conter imprecisões. Você é responsável por verificar informações antes de utilizá-las em contextos críticos. O Vintel IA não se responsabiliza por decisões tomadas com base no conteúdo gerado.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Integrações de Terceiros</h2>
            <p>Ao conectar serviços externos (GitHub, Google, etc.), você autoriza o Vintel IA a acessar dados conforme os escopos aprovados. Você pode revogar acessos a qualquer momento em /conectores.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Limitação de Responsabilidade</h2>
            <p>O Serviço é fornecido "como está". Na máxima extensão permitida por lei, o Vintel IA não se responsabiliza por danos indiretos, lucros cessantes ou perda de dados.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Alterações</h2>
            <p>Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas via e-mail ou na plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Contato</h2>
            <p>Dúvidas: contato@vintel-ia.app</p>
          </section>
        </div>
      </div>
    </div>
  );
}
