import { useChatStore } from '@/store/chatStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sun, Moon } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useChatStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Theme */}
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">Aparência</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-colors ${
                  theme === 'light' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Sun className="h-4 w-4" />
                Claro
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-colors ${
                  theme === 'dark' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Moon className="h-4 w-4" />
                Escuro
              </button>
            </div>
          </div>

          {/* Info */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Sobre</label>
            <p className="text-xs text-muted-foreground">
              Ventel IA — Assistente de Inteligência Artificial avançado com agentes especializados para pesquisa, programação, negócios, marketing, conteúdo e automação.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
