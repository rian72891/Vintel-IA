import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Gift } from 'lucide-react';
import { motion } from 'framer-motion';

const reasons = [
  'Muito caro para mim',
  'Não uso o suficiente',
  'Encontrei uma alternativa melhor',
  'Faltam recursos que preciso',
  'Problemas técnicos',
  'Outro motivo',
];

export default function Cancelar() {
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState('');
  const [showOffer, setShowOffer] = useState(false);

  const handleConfirm = () => {
    if (!showOffer) {
      setShowOffer(true);
      return;
    }
    // Redirect to Gumroad management
    window.open('https://app.gumroad.com/subscriptions', '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Cancelar assinatura</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <Heart className="h-12 w-12 text-destructive/50 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Sentiremos sua falta</h1>
            <p className="text-sm text-muted-foreground">
              Antes de ir, nos diga o que podemos melhorar.
            </p>
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-sm font-medium text-foreground">Por que está cancelando?</p>
            {reasons.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                  selectedReason === reason ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{reason}</span>
              </label>
            ))}
          </div>

          {showOffer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-6 text-center"
            >
              <Gift className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-1">Oferta especial!</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Que tal <span className="font-bold text-primary">50% de desconto</span> no próximo mês?
              </p>
              <Button onClick={() => navigate('/')} className="w-full mb-2">
                Aceitar oferta e continuar
              </Button>
              <button
                onClick={handleConfirm}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Não, quero cancelar mesmo
              </button>
            </motion.div>
          )}

          {!showOffer && (
            <Button
              onClick={handleConfirm}
              variant="destructive"
              className="w-full"
              disabled={!selectedReason}
            >
              Continuar cancelamento
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
