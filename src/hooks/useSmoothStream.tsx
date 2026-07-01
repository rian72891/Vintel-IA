import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Smooth streaming buffer: accepts raw token deltas from the model and
 * reveals them character-by-character on a requestAnimationFrame loop so the
 * rendered text feels fluid (like ChatGPT / Gemini) instead of chunky.
 */
export function useSmoothStream() {
  const [displayed, setDisplayed] = useState('');
  const targetRef = useRef('');
  const displayedRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const doneCbRef = useRef<(() => void) | null>(null);

  const tick = useCallback((ts: number) => {
    const last = lastTsRef.current || ts;
    const dt = ts - last;
    lastTsRef.current = ts;

    const remaining = targetRef.current.length - displayedRef.current.length;
    if (remaining <= 0) {
      rafRef.current = null;
      lastTsRef.current = 0;
      if (doneCbRef.current) {
        const cb = doneCbRef.current;
        doneCbRef.current = null;
        cb();
      }
      return;
    }

    // Base speed ~90 chars/sec, but accelerate when the buffer grows
    // so we never fall too far behind the model.
    const baseCps = 90;
    const catchUp = Math.min(6, 1 + remaining / 60);
    const charsToAdd = Math.max(1, Math.floor((dt / 1000) * baseCps * catchUp));
    const nextLen = Math.min(targetRef.current.length, displayedRef.current.length + charsToAdd);
    const next = targetRef.current.slice(0, nextLen);
    displayedRef.current = next;
    setDisplayed(next);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const push = useCallback((delta: string) => {
    targetRef.current += delta;
    if (rafRef.current == null) {
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const finish = useCallback((cb?: () => void) => {
    // If already caught up, invoke immediately; else wait for the loop to drain.
    if (displayedRef.current.length >= targetRef.current.length) {
      cb?.();
    } else {
      doneCbRef.current = cb ?? null;
    }
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = 0;
    targetRef.current = '';
    displayedRef.current = '';
    doneCbRef.current = null;
    setDisplayed('');
  }, []);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { displayed, push, finish, reset };
}
