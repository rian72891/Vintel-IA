const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

export type ImageQuality = 'fast' | 'hd';

interface GenerateResult {
  imageUrl: string;
  description?: string;
  model?: string;
}

export async function generateImage(
  prompt: string,
  quality: ImageQuality = 'fast',
  editImageUrl?: string
): Promise<GenerateResult> {
  const resp = await fetch(GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ prompt, quality, editImageUrl }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${resp.status}`);
  }

  return await resp.json();
}
