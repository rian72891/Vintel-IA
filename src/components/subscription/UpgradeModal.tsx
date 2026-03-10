import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentUsed: number;
  currentLimit: number;
}

export function UpgradeModal({ open, onOpenChange, feature, currentUsed, currentLimit }: UpgradeModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Limite atingido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Você atingiu o limite de <strong className="text-foreground">{feature}</strong> do seu plano atual ({currentUsed}/{currentLimit}).
          </p>
          <p className="text-sm text-muted-foreground">
            Faça upgrade para continuar usando sem interrupções.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            <Button
              onClick={() => { onOpenChange(false); navigate('/precos'); }}
              className="flex-1 gap-2"
            >
              Ver planos <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
