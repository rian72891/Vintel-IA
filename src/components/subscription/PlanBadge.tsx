import { Crown, Zap, Building2 } from 'lucide-react';
import { PlanKey } from '@/lib/plans';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  plan: PlanKey;
  className?: string;
}

const config: Record<PlanKey, { icon: any; label: string; className: string }> = {
  free: { icon: Zap, label: 'Free', className: 'bg-muted text-muted-foreground' },
  starter: { icon: Zap, label: 'Starter', className: 'bg-secondary text-secondary-foreground' },
  pro: { icon: Crown, label: 'Pro', className: 'bg-primary/15 text-primary border-primary/20' },
  agency: { icon: Building2, label: 'Agency', className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const c = config[plan];
  const Icon = c.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
      c.className,
      className
    )}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
