import { describe, expect, it } from 'vitest';
import { isImageEditRequest } from '@/lib/imageIntent';

describe('image intent classification', () => {
  it('sends a short question with an image to normal multimodal chat', () => {
    expect(isImageEditRequest('Responda as questões de geografia', true)).toBe(false);
    expect(isImageEditRequest('O que aparece nesta foto?', true)).toBe(false);
  });

  it('recognizes explicit image editing commands and wording', () => {
    expect(isImageEditRequest('/imaginehd transforme em aquarela', true)).toBe(true);
    expect(isImageEditRequest('Edite a imagem e remova o fundo', true)).toBe(true);
    expect(isImageEditRequest('gere uma versão em estilo retrô', true)).toBe(true);
  });

  it('never classifies text-only requests as image editing', () => {
    expect(isImageEditRequest('Edite este texto', false)).toBe(false);
  });
});
