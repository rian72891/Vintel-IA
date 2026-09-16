import { motion, useReducedMotion } from 'framer-motion';
import logoUrl from '@/assets/vintel-logo.png';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  isStreaming?: boolean;
  className?: string;
}

export function AgentAvatar({ isStreaming = false, className }: AgentAvatarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-label={isStreaming ? 'Vintel IA está processando' : 'Vintel IA'}
      role="img"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-background shadow-sm',
        className,
      )}
      animate={
        isStreaming && !prefersReducedMotion
          ? {
              scale: [1, 1.04, 1],
              boxShadow: [
                '0 0 0 0 hsl(var(--primary) / 0.02)',
                '0 0 0 4px hsl(var(--primary) / 0.10)',
                '0 0 0 0 hsl(var(--primary) / 0.02)',
              ],
            }
          : {
              scale: 1,
              boxShadow: '0 0 0 0 hsl(var(--primary) / 0.02)',
            }
      }
      transition={
        isStreaming && !prefersReducedMotion
          ? { duration: 2.4, ease: 'easeInOut', repeat: Infinity }
          : { duration: 0.35, ease: 'easeOut' }
      }
    >
      <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
    </motion.div>
  );
}
