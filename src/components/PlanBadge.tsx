import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlanBadge() {
  const { plan } = useSubscription();
  const navigate = useNavigate();

  const config: Record<string, { icon: any; label: string; className: string }> = {
    free: { icon: Zap, label: 'Gratuito', className: 'bg-muted text-muted-foreground' },
    starter: { icon: Zap, label: 'Starter', className: 'bg-secondary text-secondary-foreground' },
    pro: { icon: Crown, label: 'Pro', className: 'bg-primary/10 text-primary' },
    agency: { icon: Building2, label: 'Agency', className: 'bg-yellow-500/10 text-yellow-600' },
  };

  const c = config[plan] || config.free;
  const Icon = c.icon;

  return (
    <button
      onClick={() => navigate('/precos')}
      className={cn(
        'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80',
        c.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {plan === 'free' ? 'Fazer upgrade' : `Plano ${c.label} ✓`}
    </button>
  );
}
