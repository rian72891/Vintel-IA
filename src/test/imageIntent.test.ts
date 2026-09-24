import { describe, expect, it } from 'vitest';
import { isImageEditRequest } from '@/lib/imageIntent';

describe('image intent classification', () => {
  it('recognizes /imaginehd without an image as generation from scratch', () => {
    expect(isImageEditRequest('/imaginehd crie uma imagem de um cavalo', false)).toBe(true);
  });

  it('recognizes /imagine without an image as generation from scratch', () => {
    expect(isImageEditRequest('/imagine um gato', false)).toBe(true);
  });

  it('recognizes editing wording when an image is attached', () => {
    expect(isImageEditRequest('edite isso para ficar mais escuro', true)).toBe(true);
    expect(isImageEditRequest('/imaginehd deixe isso em preto e branco', true)).toBe(true);
  });

  it('keeps an attached-image question in normal multimodal chat', () => {
    expect(isImageEditRequest('responda essa questão', true)).toBe(false);
  });

  it('does not classify ordinary text without an image or command as image editing', () => {
    expect(isImageEditRequest('como você está?', false)).toBe(false);
  });

  it('continues to protect other image-analysis questions from false positives', () => {
    expect(isImageEditRequest('Responda as questões de geografia', true)).toBe(false);
    expect(isImageEditRequest('O que aparece nesta foto?', true)).toBe(false);
  });
});
