import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Obrigado() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">
            Bem-vindo ao Ventel IA! 🎉
          </h1>
          <p className="text-muted-foreground">
            Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos do seu plano.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 text-left space-y-3">
          <p className="text-sm font-semibold text-foreground">💡 Dica para começar:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              Comece uma conversa e peça o que precisar
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              Use /imagine para gerar imagens, /pdf para documentos
            </li>
          </ul>
        </div>

        <Button onClick={() => navigate('/')} className="w-full gap-2">
          Acessar Dashboard <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-xs text-muted-foreground">
          Precisa de ajuda? Entre em contato pelo chat ou email.
        </p>
      </motion.div>
    </div>
  );
}
