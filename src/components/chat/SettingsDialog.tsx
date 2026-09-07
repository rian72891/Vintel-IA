import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsage } from '@/hooks/useUsage';
import { useConnectors } from '@/hooks/useConnectors';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ChevronRight, ChevronLeft, User, CreditCard, Zap, Plug, Moon, Type, Mic, Vibrate,
  Shield, Link as LinkIcon, Thermometer, LogOut, Check, Sun, Monitor, Crown, RefreshCw,
  Loader2, Copy, Trash2, Brain, Languages,
} from 'lucide-react';
import { PLANS, PlanKey } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Section =
  | 'root' | 'profile' | 'billing' | 'capabilities' | 'theme'
  | 'font' | 'voice' | 'shared' | 'creativity' | 'memory' | 'language';

const CAP_KEYS = [
  { key: 'cap_images', label: 'Geração de imagens' },
  { key: 'cap_search', label: 'Busca na web' },
  { key: 'cap_audio', label: 'Geração de áudio' },
  { key: 'cap_files', label: 'Geração de arquivos' },
] as const;

function readBool(key: string, def = true) {
  const v = localStorage.getItem(key);
  return v == null ? def : v === 'true';
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const navigate = useNavigate();
  const { temperature, setTemperature } = useChatStore();
  const { user } = useAuth();
  const { plan, subscribed, checkSubscription } = useSubscription();
  const { getUsagePercent, getUsageLabel, refreshUsage } = useUsage();
  const { connected } = useConnectors();
  const { lang, setLang, t: tr } = useI18n();

  const [section, setSection] = useState<Section>('root');
  const [syncing, setSyncing] = useState(false);

  // Profile
  const [name, setName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Capabilities
  const [caps, setCaps] = useState<Record<string, boolean>>({});

  // Theme
  const [themeChoice, setThemeChoice] = useState<'system' | 'light' | 'dark'>(
    (localStorage.getItem('theme') as any) || 'dark'
  );

  // Font
  const [fontChoice, setFontChoice] = useState<'default' | 'serif' | 'mono'>(
    (localStorage.getItem('font_style') as any) || 'default'
  );

  // Voice
  const [voiceId, setVoiceId] = useState<'female' | 'male'>(
    (localStorage.getItem('voice_id') as any) || 'female'
  );
  const [testingVoice, setTestingVoice] = useState(false);

  // Haptic
  const [haptic, setHaptic] = useState<boolean>(readBool('haptic', false));

  // Shared
  const [sharedItems, setSharedItems] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  // Memória persistente entre conversas
  const [memories, setMemories] = useState<any[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  const planData = PLANS[plan as PlanKey] || PLANS.free;

  useEffect(() => {
    if (!open) return;
    setSection('root');
    setName(user?.user_metadata?.full_name || '');
    const c: Record<string, boolean> = {};
    for (const { key } of CAP_KEYS) c[key] = readBool(key, true);
    setCaps(c);
  }, [open, user]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const userInitial = (user?.user_metadata?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase();

  const planColors: Record<string, string> = {
    free: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    starter: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    pro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    agency: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  };

  const capsActive = Object.values(caps).filter(Boolean).length;

  // Actions
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (error) throw error;
      toast.success('Perfil atualizado!');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await checkSubscription();
      await refreshUsage();
      toast.success('Assinatura sincronizada!');
    } catch {
      toast.error('Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const toggleCap = (key: string) => {
    const next = !caps[key];
    setCaps({ ...caps, [key]: next });
    localStorage.setItem(key, String(next));
  };

  const applyTheme = (t: 'system' | 'light' | 'dark') => {
    setThemeChoice(t);
    localStorage.setItem('theme', t);
    const root = document.documentElement;
    let dark = t === 'dark';
    if (t === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', dark);
  };

  const applyFont = (f: 'default' | 'serif' | 'mono') => {
    setFontChoice(f);
    localStorage.setItem('font_style', f);
    const map = {
      default: 'Inter, sans-serif',
      serif: 'Georgia, serif',
      mono: "'JetBrains Mono', monospace",
    };
    document.documentElement.style.setProperty('--font-sans', map[f]);
  };

  const applyVoice = (v: 'female' | 'male') => {
    setVoiceId(v);
    localStorage.setItem('voice_id', v);
  };

  const testVoice = async () => {
    setTestingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text: 'Olá, eu sou o Vintel IA!', voice: voiceId },
      });
      if (error) throw error;
      const b64 = (data as any)?.audioContent;
      if (!b64) throw new Error('Sem áudio');
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao testar voz');
    } finally {
      setTestingVoice(false);
    }
  };

  const toggleHaptic = () => {
    const next = !haptic;
    setHaptic(next);
    localStorage.setItem('haptic', String(next));
    if (next && 'vibrate' in navigator) navigator.vibrate(10);
  };

  const loadShared = async () => {
    if (!user) return;
    setLoadingShared(true);
    try {
      const { data, error } = await supabase
        .from('shared_artifacts')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSharedItems(data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar links');
    } finally {
      setLoadingShared(false);
    }
  };

  const loadMemories = async () => {
    if (!user) return;
    setLoadingMemories(true);
    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('id, content, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setMemories(data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar memórias');
    } finally {
      setLoadingMemories(false);
    }
  };

  const deleteMemory = async (id: string) => {
    const { error } = await supabase.from('user_memories').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.success('Memória apagada');
  };

  const clearMemories = async () => {
    if (!user) return;
    const { error } = await supabase.from('user_memories').delete().eq('user_id', user.id);
    if (error) return toast.error(error.message);
    setMemories([]);
    toast.success('Todas as memórias foram apagadas');
  };

  useEffect(() => {
    if (section === 'memory') loadMemories();
    if (section === 'shared') loadShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const copyShared = (id: string) => {
    const url = `${window.location.origin}/shared/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const deleteShared = async (id: string) => {
    try {
      const { error } = await supabase.from('shared_artifacts').delete().eq('id', id);
      if (error) throw error;
      setSharedItems((prev) => prev.filter((s) => s.id !== id));
      toast.success('Link removido');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onOpenChange(false);
  };

  // Section item component
  const Row = ({ icon: Icon, label, subtitle, onClick, danger, rightSlot }: any) => (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left',
        danger && 'text-red-400 hover:text-red-300'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', danger ? 'text-red-400' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {rightSlot ?? (!danger && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />)}
    </button>
  );

  const BackHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
      <button
        onClick={() => setSection('root')}
        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );

  const themeSubtitle =
    themeChoice === 'system' ? 'Sistema' : themeChoice === 'light' ? 'Claro' : 'Escuro';
  const fontSubtitle =
    fontChoice === 'default' ? 'Padrão' : fontChoice === 'serif' ? 'Serif' : 'Mono';
  const voiceSubtitle = voiceId === 'female' ? 'Feminina' : 'Masculina';

  const msgPercent = getUsagePercent('messages');
  const msgLabel = getUsageLabel('messages');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 bg-background flex flex-col">
        {section === 'root' && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">{userInitial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <span className={cn('inline-block mt-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', planColors[plan] || planColors.free)}>
                {planData.name}
              </span>
            </div>

            {/* Sections list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
              <div className="py-1">
                <Row icon={User} label="Perfil" onClick={() => setSection('profile')} />
                <Row icon={CreditCard} label="Cobrança" onClick={() => setSection('billing')} />
                <Row icon={Zap} label="Capacidades" subtitle={`${capsActive} ativadas`} onClick={() => setSection('capabilities')} />
                <Row icon={Plug} label="Conectores" subtitle={`${connected.size} conectados`} onClick={() => { onOpenChange(false); navigate('/conectores'); }} />
              </div>
              <div className="border-t border-border py-1">
                <Row icon={Moon} label="Modo de cor" subtitle={themeSubtitle} onClick={() => setSection('theme')} />
                <Row icon={Type} label="Estilo de fonte" subtitle={fontSubtitle} onClick={() => setSection('font')} />
                <Row icon={Mic} label="Voz" subtitle={voiceSubtitle} onClick={() => setSection('voice')} />
                <Row
                  icon={Languages}
                  label={tr('common.language')}
                  subtitle={lang === 'pt' ? tr('common.portuguese') : tr('common.english')}
                  onClick={() => setSection('language')}
                />
                <Row
                  icon={Vibrate}
                  label="Feedback háptico"
                  onClick={toggleHaptic}
                  rightSlot={<Switch checked={haptic} onCheckedChange={toggleHaptic} onClick={(e) => e.stopPropagation()} />}
                />
              </div>
              <div className="border-t border-border py-1">
                <Row icon={Shield} label="Privacidade" onClick={() => { onOpenChange(false); navigate('/privacidade'); }} />
                <Row icon={FileText} label="Termos de Uso" onClick={() => { onOpenChange(false); navigate('/termos'); }} />
                <Row icon={Brain} label="Memória" onClick={() => setSection('memory')} />
                <Row icon={LinkIcon} label="Links compartilhados" onClick={() => setSection('shared')} />
                <Row icon={Thermometer} label="Criatividade da IA" subtitle={`${temperature.toFixed(1)}`} onClick={() => setSection('creativity')} />
              </div>
              <div className="border-t border-border py-1">
                <Row icon={LogOut} label="Sair" danger onClick={handleLogout} />
                <Row icon={Trash2} label="Excluir minha conta" danger onClick={() => setSection('delete')} />
              </div>

            </div>
          </>
        )}

        {section === 'profile' && (
          <>
            <BackHeader title="Perfil" />
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center">
                <div className="h-20 w-20 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-primary">{userInitial}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  value={user?.email || ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </>
        )}

        {section === 'billing' && (
          <>
            <BackHeader title="Cobrança" />
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plano atual</span>
                <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', planColors[plan] || planColors.free)}>
                  {planData.name}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Mensagens hoje</span>
                  <span className="font-medium">{msgLabel}</span>
                </div>
                <Progress value={msgPercent} className="h-1.5" />
              </div>
              {plan !== 'agency' && (
                <button
                  onClick={() => { onOpenChange(false); navigate('/precos'); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Crown className="h-4 w-4" /> Fazer upgrade
                </button>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar assinatura
              </button>
              {subscribed && <p className="text-xs text-emerald-500 text-center">● Assinatura ativa</p>}
            </div>
          </>
        )}

        {section === 'capabilities' && (
          <>
            <BackHeader title="Capacidades" />
            <div className="p-2">
              {CAP_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-lg">
                  <span className="text-sm">{label}</span>
                  <Switch checked={!!caps[key]} onCheckedChange={() => toggleCap(key)} />
                </div>
              ))}
            </div>
          </>
        )}

        {section === 'theme' && (
          <>
            <BackHeader title="Modo de cor" />
            <div className="p-2">
              {([['system', Monitor, 'Sistema'], ['light', Sun, 'Claro'], ['dark', Moon, 'Escuro']] as const).map(([t, Icon, label]) => (
                <button
                  key={t}
                  onClick={() => applyTheme(t)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-sm">{label}</span>
                  {themeChoice === t && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}

        {section === 'language' && (
          <>
            <BackHeader title={tr('common.language')} />
            <div className="p-2">
              {([['pt', tr('common.portuguese')], ['en', tr('common.english')]] as const).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLang(code as 'pt' | 'en')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="flex-1 text-left text-sm">{label}</span>
                  {lang === code && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}

        {section === 'font' && (
          <>
            <BackHeader title="Estilo de fonte" />
            <div className="p-2">
              {([['default', 'Padrão'], ['serif', 'Serif'], ['mono', 'Mono']] as const).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => applyFont(f)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-sm">{label}</span>
                  {fontChoice === f && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}

        {section === 'voice' && (
          <>
            <BackHeader title="Voz" />
            <div className="p-2 space-y-1">
              {([['female', 'Feminina (Bia)'], ['male', 'Masculina (Carlos)']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => applyVoice(v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-sm">{label}</span>
                  {voiceId === v && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
              <div className="px-4 pt-3">
                <button
                  onClick={testVoice}
                  disabled={testingVoice}
                  className="w-full py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Testar voz
                </button>
              </div>
            </div>
          </>
        )}

        {section === 'shared' && (
          <>
            <BackHeader title="Links compartilhados" />
            <div className="p-3 space-y-2 overflow-y-auto scrollbar-thin">
              {loadingShared && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingShared && sharedItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum link compartilhado ainda</p>
              )}
              {sharedItems.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <span className="flex-1 text-sm truncate">{s.title || 'Sem título'}</span>
                  <button onClick={() => copyShared(s.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Copiar link">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteShared(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Deletar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {section === 'memory' && (
          <>
            <BackHeader title="Memória" />
            <div className="p-3 space-y-2 overflow-y-auto scrollbar-thin">
              <p className="text-xs text-muted-foreground px-1 pb-1">
                Fatos que o Vintel IA lembra sobre você entre conversas diferentes.
              </p>
              {loadingMemories && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingMemories && memories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma memória salva ainda</p>
              )}
              {memories.map((m) => (
                <div key={m.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <span className="flex-1 text-sm leading-relaxed">{m.content}</span>
                  <button onClick={() => deleteMemory(m.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Apagar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {memories.length > 0 && (
                <button
                  onClick={clearMemories}
                  className="w-full mt-2 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors"
                >
                  Apagar tudo
                </button>
              )}
            </div>
          </>
        )}

        {section === 'creativity' && (
          <>
            <BackHeader title="Criatividade da IA" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Temperatura</span>
                <span className="text-sm font-semibold">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                min={0}
                max={1}
                step={0.1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Preciso</span>
                <span>Criativo</span>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
