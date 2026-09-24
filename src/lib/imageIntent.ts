export const imageEditKeywords = [
  'recri', 'edit', 'modifi', 'alter', 'transform', 'mude', 'muda', 'troque',
  'troca', 'refaz', 'refaç', 'imagine', 'gere', 'gerar', 'crie', 'criar',
  'tipo', 'estilo', 'igual', 'parecid', 'mesm',
];

export function isImageEditRequest(content: string, hasImageAttachment: boolean): boolean {
  const lower = content.toLowerCase();
  if (content.startsWith('/imagine ') || content.startsWith('/imaginehd ')) return true;
  if (!hasImageAttachment) return false;
  return imageEditKeywords.some((keyword) => lower.includes(keyword));
}
