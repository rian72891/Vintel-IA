import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useConnectors } from '@/hooks/useConnectors';

type Item = {
  id: string;
  label: string;
  icon: JSX.Element;
};

const GoogleMini = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GitHubMini = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.73 18.27.5 12 .5z" />
  </svg>
);

const LovableMini = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);




const ITEMS: Item[] = [
  { id: 'github', label: 'GitHub', icon: <GitHubMini /> },
  { id: 'google', label: 'Google Workspace', icon: <GoogleMini /> },
  { id: 'lovable', label: 'Lovable', icon: <LovableMini /> },
];

export function ConnectorIndicators() {
  const navigate = useNavigate();
  const { connected } = useConnectors();

  return (
    <div className="flex items-center justify-center gap-1.5 mt-2">
      {ITEMS.map((it) => {
        const active = connected.has(it.id);
        return (
          <motion.button
            key={it.id}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/conectores')}
            title={active ? `${it.label} conectado` : `${it.label} desconectado — clique para conectar`}
            className={[
              'relative h-6 w-6 rounded-md flex items-center justify-center transition-colors',
              active
                ? 'text-[hsl(142_72%_55%)] bg-[hsl(142_72%_55%/0.10)] border border-[hsl(142_72%_55%/0.35)]'
                : 'text-muted-foreground/40 bg-muted/30 border border-border/40 hover:text-muted-foreground/70',
            ].join(' ')}
            style={
              active
                ? { boxShadow: '0 0 10px hsl(142 72% 55% / 0.55), 0 0 2px hsl(142 72% 55% / 0.9)' }
                : undefined
            }
          >
            {it.icon}
            {active && (
              <motion.span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(142_72%_55%)]"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{ boxShadow: '0 0 6px hsl(142 72% 55%)' }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
