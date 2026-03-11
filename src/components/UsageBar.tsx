import { useUsage, UsageType } from '@/hooks/useUsage';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageBarProps {
  type: UsageType;
  label: string;
  className?: string;
}

export function UsageBar({ type, label, className }: UsageBarProps) {
  const { getUsagePercent, getUsageLabel } = useUsage();
  const percent = getUsagePercent(type);
  const usageLabel = getUsageLabel(type);

  if (percent === 0 && usageLabel.includes('∞')) return null;

  const colorClass = percent >= 90 ? 'text-destructive' : percent >= 70 ? 'text-yellow-500' : 'text-primary';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', colorClass)}>{usageLabel}</span>
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
}
