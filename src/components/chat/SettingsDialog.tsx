import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsage } from '@/hooks/useUsage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Sun, Moon, Crown, RefreshCw, LogOut, User, Zap, MessageSquare, Image, FileText, Mic, Eye, Loader2 } from 'lucide-react';
import { PLANS, PlanKey } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useChatStore();
  const { user } = useAuth();
  const { plan, subscribed, loading: subLoading, checkSubscription } = useSubscription();
  const { usage, refreshUsage, getUsagePercent, getUsageLabel } = useUsage();
  const [syncing, setSyncing] = useState(false);

  const planData = PLANS[plan as PlanKey] || PLANS.free;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await checkSubscription();
      await refreshUsage();
      toast.success('Dados sincronizados!');
    } catch {
      toast.error('Erro ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onOpenChange(false);
  };

  const usageItems = [
    { type: 'messages' as const, label: 'Mensagens (dia)', icon: MessageSquare, color: 'text-primary' },
    { type: 'images' as const, label: 'Imagens (mês)', icon: Image, color: 'text-accent' },
    { type: 'files' as const, label: 'Arquivos (mês)', icon: FileText, color: 'text-emerald-500' },
    { type: 'audio' as const, label: 'Áudio (mês)', icon: Mic, color: 'text-orange-500' },
    { type: 'image_analyses' as const, label: 'Análises (mês)', icon: Eye, color: 'text-cyan-500' },
  ];

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    starter: 'bg-primary/10 text-primary',
    pro: 'bg-accent/10 text-accent',
    agency: 'bg-orange-500/10 text-orange-500',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Configurações
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', planColors[plan] || planColors.free)}>
                  {planData.name}
                </span>
                {subscribed && <span className="text-[10px] text-emerald-500 font-medium">● Ativo</span>}
              </div>
            </div>
          </div>

          {/* Plan & Usage */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Uso do plano</span>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sincronizar
              </button>
            </div>

            <div className="space-y-3">
              {usageItems.map((item) => {
                const percent = getUsagePercent(item.type);
                const label = getUsageLabel(item.type);
                if (label.includes('∞') && percent === 0) return null;
                
                return (
                  <div key={item.type} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <item.icon className={cn('h-3.5 w-3.5', item.color)} />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <span className={cn(
                        'text-xs font-semibold',
                        percent >= 90 ? 'text-destructive' : percent >= 70 ? 'text-yellow-500' : 'text-foreground'
                      )}>
                        {label}
                      </span>
                    </div>
                    <Progress
                      value={percent}
                      className={cn(
                        'h-1.5',
                        percent >= 90 ? '[&>div]:bg-destructive' : percent >= 70 ? '[&>div]:bg-yellow-500' : ''
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {plan === 'free' && (
              <a
                href="/precos"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Crown className="h-4 w-4" />
                Fazer upgrade
              </a>
            )}
          </div>

          {/* Theme */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2.5 block">Aparência</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  theme === 'light' ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <Sun className="h-4 w-4" />
                Claro
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  theme === 'dark' ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <Moon className="h-4 w-4" />
                Escuro
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            Vintel IA — Assistente de IA multimodal
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
