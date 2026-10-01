import { useEffect, useRef, useState } from 'react';
import { Download, Minus, Plus, RotateCcw, X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  filename?: string;
  onClose: () => void;
  onDownload: (src: string, filename?: string) => void;
}

function distanceBetweenTouches(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

export function ImageLightbox({ src, alt = 'Imagem ampliada', filename, onClose, onDownload }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const pinchStartRef = useRef<number | null>(null);
  const scaleStartRef = useRef(1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setScale((value) => Math.min(4, value + 0.25));
      if (event.key === '-') setScale((value) => Math.max(0.5, value - 0.25));
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const zoomBy = (amount: number) => setScale((value) => Math.min(4, Math.max(0.5, value + amount)));

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
      onClick={onClose}
      onWheel={(event) => {
        event.preventDefault();
        zoomBy(event.deltaY > 0 ? -0.1 : 0.1);
      }}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <span className="max-w-[55vw] truncate text-xs font-medium text-white/70">{filename || alt}</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => zoomBy(-0.25)} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Reduzir zoom" title="Reduzir zoom">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => zoomBy(0.25)} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Aumentar zoom" title="Aumentar zoom">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setScale(1)} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Restaurar zoom" title="Restaurar zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDownload(src, filename)} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Baixar imagem" title="Baixar imagem">
            <Download className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Fechar visualizador" title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex max-h-full max-w-full items-center justify-center overflow-auto rounded-xl"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          if (event.touches.length >= 2) {
            pinchStartRef.current = distanceBetweenTouches(event.touches);
            scaleStartRef.current = scale;
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length >= 2 && pinchStartRef.current) {
            event.preventDefault();
            const distance = distanceBetweenTouches(event.touches);
            setScale(Math.min(4, Math.max(0.5, scaleStartRef.current * (distance / pinchStartRef.current))));
          }
        }}
        onTouchEnd={() => { pinchStartRef.current = null; }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[82vh] max-w-[92vw] select-none object-contain transition-transform duration-100"
          style={{ transform: `scale(${scale})`, touchAction: 'none' }}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white/70">
        {Math.round(scale * 100)}% · role para fechar
      </div>
    </div>
  );
}
