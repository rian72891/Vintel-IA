import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Sparkles, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Obrigado() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-extrabold text-foreground mb-2">
          Bem-vindo ao Vintel IA! 🎉
        </h1>
        <p className="text-muted-foreground mb-8">
          Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos do seu plano.
        </p>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Dica: comece assim
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Digite <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/imagine</code> para gerar imagens com IA</li>
            <li>• Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/pdf</code> para criar documentos profissionais</li>
            <li>• Envie uma imagem para análise inteligente</li>
            <li>• Converse naturalmente sobre qualquer assunto</li>
          </ul>
        </div>

        <Button onClick={() => navigate('/')} className="w-full gap-2" size="lg">
          <MessageCircle className="h-4 w-4" />
          Acessar Dashboard
        </Button>

        <p className="text-[10px] text-muted-foreground mt-4">
          Precisa de ajuda? <a href="mailto:suporte@vintel.ia" className="text-primary hover:underline">suporte@vintel.ia</a>
        </p>
      </motion.div>
    </div>
  );
}
