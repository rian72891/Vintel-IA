import { useEffect, useState } from 'react';

const KEY = 'vintel_voice_unavailable';

type Listener = (available: boolean) => void;
const listeners = new Set<Listener>();

function readState(): boolean {
  try {
    return localStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
}

let available = readState();

export function isVoiceAvailable(): boolean {
  return available;
}

function setAvailable(next: boolean) {
  if (available === next) return;
  available = next;
  try {
    if (next) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(next));
}

/** Marca a voz como indisponível quando a chave/cota do ElevenLabs falha. */
export function reportVoiceError(message: string): boolean {
  const m = (message || '').toLowerCase();
  const fatal =
    /não configurad|not configured|401|402|403|429|quota|unauthorized|missing_permissions|detected_unusual_activity/.test(
      m,
    );
  if (fatal) setAvailable(false);
  return fatal;
}

/** Voz funcionou — reativa os botões. */
export function reportVoiceSuccess() {
  setAvailable(true);
}

export function useVoiceAvailable(): boolean {
  const [state, setState] = useState(available);
  useEffect(() => {
    const l: Listener = (v) => setState(v);
    listeners.add(l);
    setState(available);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
