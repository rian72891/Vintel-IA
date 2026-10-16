import { supabase } from '@/integrations/supabase/client';

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

export type ImageQuality = 'fast' | 'hd';

interface GenerateResult {
  imageUrl: string;
  description?: string;
  model?: string;
  free?: boolean;
}

/**
 * O gerador gratuito entrega a imagem com a marca dele no rodapé. Pedimos a
 * imagem um pouco mais alta e, aqui, cortamos essa faixa de baixo e quadrada-
 * mos o resultado. Se qualquer coisa falhar, devolvemos a imagem original.
 */
async function cropFreeImage(dataUrl: string, size = 768): Promise<string> {
  try {
    if (!dataUrl.startsWith('data:image/') || typeof document === 'undefined') return dataUrl;

    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) return dataUrl;

    const usableH = Math.floor(srcH * 0.92); // remove a faixa do rodapé
    const side = Math.min(srcW, usableH);
    const sx = Math.floor((srcW - side) / 2);
    const sy = Math.floor((usableH - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return dataUrl;
  }
}

export async function generateImage(
  prompt: string,
  quality: ImageQuality = 'fast',
  editImageUrl?: string
): Promise<GenerateResult> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) throw new Error('Faça login para gerar imagens.');
  const resp = await fetch(GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ prompt, quality, editImageUrl }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${resp.status}`);
  }

  const result = await resp.json().catch(() => ({}));
  if (result?.error || !result?.imageUrl) throw new Error(result?.error || 'Erro ao gerar imagem.');

  if (result.free) {
    result.imageUrl = await cropFreeImage(result.imageUrl, quality === 'hd' ? 1024 : 768);
  }
  return result;
}
