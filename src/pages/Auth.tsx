import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import vintelLogo from '@/assets/vintel-logo.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Bem-vindo de volta!');
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu email para confirmar.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (error) {
        console.error('Google OAuth error:', error);
        toast.error('Login com Google indisponível neste domínio. Use email e senha.');
      }
    } catch (e) {
      console.error('Google OAuth exception:', e);
      toast.error('Login com Google indisponível. Use email e senha para entrar.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none gpu-layer">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.05]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm flex flex-col items-center"
      >
        {/* Logo with pulse glow */}
        <motion.div
          className="relative mb-6"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="absolute inset-[-12px] rounded-full bg-primary/15 animate-pulse" />
          <img src={vintelLogo} alt="Vintel IA" className="relative h-20 w-20 rounded-2xl object-cover" />
        </motion.div>

        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">
          Bem-vindo à <span className="animated-gradient-text">Vintel IA</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Entre para criar 10x mais rápido
        </p>

        <div className="w-full bg-card border border-border rounded-2xl p-6">
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors mb-4"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" required minLength={6} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLogin ? 'Desbloquear Acesso Pro' : 'Criar conta'}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
              {isLogin ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-6 leading-relaxed">
          Ao continuar, você concorda com os{' '}
          <a href="/termos" className="underline hover:text-foreground">Termos de Uso</a> e a{' '}
          <a href="/privacidade" className="underline hover:text-foreground">Política de Privacidade</a>.
        </p>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
          Powered by Gemini Pro & GPT-4o
        </p>
      </motion.div>
    </div>
  );
}
