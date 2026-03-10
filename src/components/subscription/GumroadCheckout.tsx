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

// Load Gumroad script once
let gumroadLoaded = false;
function loadGumroadScript() {
  if (gumroadLoaded) return;
  const script = document.createElement('script');
  script.src = 'https://gumroad.com/js/gumroad.js';
  script.async = true;
  document.head.appendChild(script);
  gumroadLoaded = true;
}

export function GumroadCheckout({ productUrl, buttonText, className, variant = 'default' }: GumroadCheckoutProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGumroadScript();
  }, []);

  const handleClick = () => {
    setLoading(true);
    // Gumroad overlay will handle the rest
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <a
      href={productUrl}
      className="gumroad-button"
      data-gumroad-overlay-checkout="true"
      onClick={handleClick}
      style={{ textDecoration: 'none' }}
    >
      <Button variant={variant} className={className} disabled={loading} asChild={false}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
      </Button>
    </a>
  );
}
