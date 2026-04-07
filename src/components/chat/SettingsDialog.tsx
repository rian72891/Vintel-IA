import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsage } from '@/hooks/useUsage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Sun, Moon, Crown, RefreshCw, LogOut, User, Zap, MessageSquare,
  Image, FileText, Mic, Eye, Loader2, Palette, Settings2, Brain, Key, Copy, Check,
  Thermometer
} from 'lucide-react';
import { useState } from 'react';
import { PLANS, PlanKey } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, temperature, setTemperature, verboseMode, setVerboseMode, streamingEnabled, setStreamingEnabled } = useChatStore();
  const { user } = useAuth();
  const { plan, subscribed, loading: subLoading, checkSubscription } = useSubscription();
  const { usage, refreshUsage, getUsagePercent, getUsageLabel } = useUsage();
  const [syncing, setSyncing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopyKey = () => {
    navigator.clipboard.writeText('vntel_sk_••••••••••••');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
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

  const temperatureLabel = temperature <= 0.3 ? 'Preciso' : temperature >= 0.8 ? 'Criativo' : 'Balanceado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Configurações
          </DialogTitle>
        </DialogHeader>

        {/* User card */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
        </div>

        <Tabs defaultValue="account" className="px-6 pb-6">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="account" className="text-xs gap-1"><User className="h-3.5 w-3.5" /> Conta</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1"><Palette className="h-3.5 w-3.5" /> Visual</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs gap-1"><Brain className="h-3.5 w-3.5" /> IA</TabsTrigger>
            <TabsTrigger value="api" className="text-xs gap-1"><Key className="h-3.5 w-3.5" /> API</TabsTrigger>
          </TabsList>

          {/* ─── Account Tab ─── */}
          <TabsContent value="account" className="space-y-4 mt-0">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Uso do plano</span>
                </div>
                <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
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
                        <span className={cn('text-xs font-semibold', percent >= 90 ? 'text-destructive' : percent >= 70 ? 'text-yellow-500' : 'text-foreground')}>
                          {label}
                        </span>
                      </div>
                      <Progress value={percent} className={cn('h-1.5', percent >= 90 ? '[&>div]:bg-destructive' : percent >= 70 ? '[&>div]:bg-yellow-500' : '')} />
                    </div>
                  );
                })}
              </div>
              {plan === 'free' && (
                <a href="/precos" className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                  <Crown className="h-4 w-4" /> Fazer upgrade
                </a>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
              <LogOut className="h-4 w-4" /> Sair da conta
            </button>
          </TabsContent>

          {/* ─── Appearance Tab ─── */}
          <TabsContent value="appearance" className="space-y-5 mt-0">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2.5 block">Tema</label>
              <div className="flex gap-2">
                {([['light', Sun, 'Claro'], ['dark', Moon, 'Escuro']] as const).map(([t, Icon, label]) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      theme === t ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Modo Performance</p>
                <p className="text-xs text-muted-foreground">Reduz animações para celulares</p>
              </div>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  reducedMotion ? 'bg-primary' : 'bg-border'
                )}
              >
                <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-primary-foreground transition-transform will-change-transform', reducedMotion && 'translate-x-5')} />
              </button>
            </div>
          </TabsContent>

          {/* ─── AI Tab ─── */}
          <TabsContent value="ai" className="space-y-5 mt-0">
            {/* Temperature / Creativity */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Thermometer className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Criatividade</label>
                <span className={cn(
                  'ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  temperature <= 0.3 ? 'bg-cyan-500/10 text-cyan-500' :
                  temperature >= 0.8 ? 'bg-orange-500/10 text-orange-500' :
                  'bg-primary/10 text-primary'
                )}>
                  {temperatureLabel}
                </span>
              </div>
              <div className="px-1">
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between mt-1.5 px-1">
                <span className="text-[10px] text-muted-foreground">Preciso</span>
                <span className="text-[10px] text-muted-foreground">Criativo</span>
              </div>
            </div>

            {/* Response style */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2.5 block">Estilo de Resposta</label>
              <div className="flex gap-2">
                {([['short', 'Curtas'], ['detailed', 'Detalhadas']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setVerboseMode(mode)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      verboseMode === mode ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Streaming */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Modo Streaming</p>
                <p className="text-xs text-muted-foreground">Exibe respostas palavra por palavra</p>
              </div>
              <button
                onClick={() => setStreamingEnabled(!streamingEnabled)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', streamingEnabled ? 'bg-primary' : 'bg-border')}
              >
                <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-primary-foreground transition-transform will-change-transform', streamingEnabled && 'translate-x-5')} />
              </button>
            </div>
          </TabsContent>

          {/* ─── API Tab ─── */}
          <TabsContent value="api" className="space-y-4 mt-0">
            {plan === 'agency' ? (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">Sua API Key</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground font-mono truncate">
                    vntel_sk_••••••••••••••••
                  </div>
                  <button onClick={handleCopyKey} className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Use esta chave para integrar a Vintel IA ao seu produto.</p>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <Key className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">API Keys disponíveis apenas no <span className="text-foreground font-semibold">Plano Agency</span>.</p>
                <a href="/precos" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                  <Crown className="h-3.5 w-3.5" /> Ver planos
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="px-6 pb-4">
          <p className="text-[10px] text-muted-foreground/50 text-center">Vintel IA — Assistente de IA multimodal</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
