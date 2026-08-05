export type Feedback = 'up' | 'down';

const KEY = 'vintel-message-feedback';

type FeedbackRecord = Record<string, { value: Feedback; at: string }>;

function read(): FeedbackRecord {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as FeedbackRecord;
  } catch {
    return {};
  }
}

export function getFeedback(messageId: string): Feedback | null {
  return read()[messageId]?.value ?? null;
}

/** Alterna o feedback da mensagem e devolve o valor final (null = removido). */
export function setFeedback(messageId: string, value: Feedback): Feedback | null {
  const all = read();
  const current = all[messageId]?.value;
  let next: Feedback | null = value;
  if (current === value) {
    delete all[messageId];
    next = null;
  } else {
    all[messageId] = { value, at: new Date().toISOString() };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage cheio/indisponível */ }
  return next;
}
