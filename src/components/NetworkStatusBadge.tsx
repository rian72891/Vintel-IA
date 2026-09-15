import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';

export function NetworkStatusBadge() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setOffline(true);
      setJustReconnected(false);
    };
    const handleOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      const timer = window.setTimeout(() => setJustReconnected(false), 2600);
      return timer;
    };

    const onOnline = () => { handleOnline(); };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-3 pointer-events-none transition-all duration-300 ${offline ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <div className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-md ${offline ? 'border-destructive/20 bg-background/95 text-foreground' : 'border-emerald-500/20 bg-background/95 text-emerald-600'}`}>
        {offline ? <WifiOff className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {offline ? 'Sem conexão — tentando reconectar…' : 'Conexão restaurada'}
      </div>
    </div>
  );
}
