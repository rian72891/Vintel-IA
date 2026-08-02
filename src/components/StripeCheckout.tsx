import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StripeCheckoutProps {
  priceId: string | null;
  buttonText: string;
  className?: string;
  variant?: 'default' | 'outline';
}

export function StripeCheckout({ priceId, buttonText, className, variant = 'default' }: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = useCallback(async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!priceId) {
      toast({
        title: 'Checkout indisponível',
        description: 'Este plano ainda não está configurado para pagamento. Tente novamente em breve.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL de checkout não retornada');
      window.open(data.url, '_blank');
    } catch (e) {
      toast({
        title: 'Não foi possível iniciar o pagamento',
        description: e instanceof Error ? e.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, priceId, user]);

  return (
    <Button onClick={handleClick} disabled={loading} variant={variant} className={className}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
    </Button>
  );
}
