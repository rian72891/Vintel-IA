import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ArrowLeft, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const reasons = [
  'Não uso o suficiente',
  'Muito caro',
  'Encontrei alternativa melhor',
  'Faltam funcionalidades',
  'Problemas técnicos',
  'Outro motivo',
];

export default function Cancelar() {
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState('');
  const [showOffer, setShowOffer] = useState(false);

  const handleProceed = () => {
    if (!showOffer) {
      setShowOffer(true);
      return;
    }
    // Redirect to Gumroad subscription management
    window.open('https://app.gumroad.com/subscriptions', '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6"
      >
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">Sentiremos sua falta</h1>
          <p className="text-muted-foreground text-sm">
            Antes de ir, nos conte o motivo para podermos melhorar.
          </p>
        </div>

        {!showOffer ? (
          <div className="space-y-2">
            {reasons.map((reason) => (
              <button
                key={reason}
                onClick={() => setSelectedReason(reason)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  selectedReason === reason
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-primary/30 rounded-xl p-5 text-center space-y-3">
            <Gift className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-bold text-foreground">Oferta especial para você!</h3>
            <p className="text-sm text-muted-foreground">
              Que tal <strong className="text-primary">50% de desconto</strong> no próximo mês? 
              Queremos que você continue criando com a gente.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Aceitar oferta e continuar
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')} className="flex-1">
            Continuar com plano
          </Button>
          <Button
            variant="destructive"
            onClick={handleProceed}
            disabled={!selectedReason && !showOffer}
            className="flex-1"
          >
            {showOffer ? 'Cancelar mesmo assim' : 'Continuar cancelamento'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
