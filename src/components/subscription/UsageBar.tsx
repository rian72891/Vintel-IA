import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  className?: string;
}

export function UsageBar({ label, used, limit, unit = '', className }: UsageBarProps) {
  if (limit === Infinity) {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium">Ilimitado</span>
        </div>
        <Progress value={0} className="h-1.5 bg-primary/10" />
      </div>
    );
  }

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isWarning = pct >= 75;
  const isDanger = pct >= 90;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          'font-medium',
          isDanger ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-foreground'
        )}>
          {used}/{limit}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          'h-1.5',
          isDanger ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''
        )}
      />
    </div>
  );
}
