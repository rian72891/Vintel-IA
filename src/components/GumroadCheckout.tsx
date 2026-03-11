import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface GumroadCheckoutProps {
  productUrl: string;
  buttonText: string;
  className?: string;
  variant?: 'default' | 'outline';
}

export function GumroadCheckout({ productUrl, buttonText, className, variant = 'default' }: GumroadCheckoutProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Gumroad embed script
    if (!document.getElementById('gumroad-script')) {
      const script = document.createElement('script');
      script.id = 'gumroad-script';
      script.src = 'https://gumroad.com/js/gumroad-embed.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const handleClick = () => {
    setLoading(true);
    // Open Gumroad overlay
    window.open(productUrl, '_blank');
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      className={className}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
    </Button>
  );
}
