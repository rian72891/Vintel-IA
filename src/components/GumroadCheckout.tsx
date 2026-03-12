import { useEffect, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { PlanKey } from '@/lib/stripe';

interface GumroadCheckoutProps {
  productUrl: string;
  buttonText: string;
  className?: string;
  variant?: 'default' | 'outline';
  expectedPlan?: PlanKey;
}

export function GumroadCheckout({
  productUrl,
  buttonText,
  className,
  variant = 'default',
  expectedPlan,
}: GumroadCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { checkSubscription } = useSubscription();
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const syncAndRedirect = useCallback(async () => {
    await checkSubscription();
    stopPolling();
    navigate('/obrigado');
  }, [checkSubscription, navigate, stopPolling]);

  const startActivationPolling = useCallback(() => {
    if (!user) return;

    stopPolling();

    pollRef.current = window.setInterval(async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('[GUMROAD] Polling error:', error);
        return;
      }

      if (!data) return;
      if (expectedPlan && data.plan !== expectedPlan) return;

      console.log('[GUMROAD] Assinatura ativa detectada:', data.plan);
      await syncAndRedirect();
    }, 3000);

    timeoutRef.current = window.setTimeout(() => {
      stopPolling();
    }, 180000);
  }, [expectedPlan, stopPolling, syncAndRedirect, user]);

  useEffect(() => {
    if (!document.getElementById('gumroad-script')) {
      const script = document.createElement('script');
      script.id = 'gumroad-script';
      script.src = 'https://gumroad.com/js/gumroad.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('gumroad.com')) return;

      let payload: any = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = { raw: payload };
        }
      }

      const eventName = payload?.post_message_name || payload?.event || payload?.type || payload?.name;
      const completed =
        payload?.success === true ||
        eventName === 'sale' ||
        eventName === 'purchase' ||
        String(payload?.raw ?? '').toLowerCase().includes('sale');

      if (completed) {
        console.log('[GUMROAD] Compra concluída, iniciando sincronização...');
        startActivationPolling();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      stopPolling();
    };
  }, [startActivationPolling, stopPolling]);

  const handleClick = useCallback(() => {
    setLoading(true);

    const url = new URL(productUrl);
    if (user?.email) {
      url.searchParams.set('email', user.email);
    }

    startActivationPolling();

    const gumroadOverlay = (window as any).GumroadOverlay;
    if (gumroadOverlay) {
      gumroadOverlay.show({ url: url.toString() });
    } else {
      window.open(url.toString(), '_blank');
    }

    window.setTimeout(() => setLoading(false), 2000);
  }, [productUrl, startActivationPolling, user?.email]);

  const href = productUrl + (user?.email ? `?email=${encodeURIComponent(user.email)}` : '');

  return (
    <a
      href={href}
      className="gumroad-button"
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    >
      <Button disabled={loading} variant={variant} className={className} asChild={false}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
      </Button>
    </a>
  );
}

