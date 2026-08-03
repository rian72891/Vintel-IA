import { ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import type { ConfirmRequest } from '@/lib/streamChat';

interface ConfirmActionCardProps {
  request: ConfirmRequest;
  busy?: boolean;
  onConfirm: (req: ConfirmRequest) => void;
  onCancel: (req: ConfirmRequest) => void;
}

export function ConfirmActionCard({ request, busy = false, onConfirm, onCancel }: ConfirmActionCardProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-card/80 p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-foreground leading-snug">{request.label}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{request.tool}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(request)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onCancel(request)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
