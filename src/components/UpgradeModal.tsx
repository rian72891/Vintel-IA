import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Crown, AlertTriangle } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
}

export function UpgradeModal({ open, onOpenChange, feature }: UpgradeModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Limite atingido
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Você atingiu o limite de <span className="font-semibold text-foreground">{feature}</span> do seu plano atual.
          </p>
          <p className="text-sm text-muted-foreground">
            Faça upgrade para continuar usando sem limites.
          </p>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/precos');
            }}
            className="w-full gap-2"
          >
            <Crown className="h-4 w-4" />
            Ver planos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
