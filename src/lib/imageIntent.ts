export const imageEditKeywords = [
  'recri', 'edit', 'modifi', 'alter', 'transform', 'mude', 'muda', 'troque',
  'troca', 'refaz', 'refaç', 'imagine', 'gere', 'gerar', 'crie', 'criar',
  'tipo', 'estilo', 'igual', 'parecid', 'mesm',
];

export function isImageEditRequest(content: string, hasImageAttachment: boolean): boolean {
  if (!hasImageAttachment) return false;
  const lowerContent = content.toLowerCase();
  return (
    content.startsWith('/imagine ') ||
    content.startsWith('/imaginehd ') ||
    imageEditKeywords.some((keyword) => lowerContent.includes(keyword))
  );
}
