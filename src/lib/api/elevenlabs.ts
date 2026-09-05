import { reportVoiceError, reportVoiceSuccess } from '@/lib/voiceAvailability';

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export async function textToSpeech(text: string, voiceId?: string): Promise<string> {
  const response = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg = data.error || `Erro TTS: ${response.status}`;
    reportVoiceError(`${response.status} ${msg}`);
    throw new Error(msg);
  }

  const data = await response.json();
  reportVoiceSuccess();
  return `data:audio/mpeg;base64,${data.audioContent}`;
}
