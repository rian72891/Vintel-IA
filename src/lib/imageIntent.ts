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

/**
 * Comandos que o ChatView executa sozinho (imagem, voz, busca, arquivos).
 * Os textos precisam bater exatamente com os `startsWith` usados no ChatView.
 */
export const chatCommands = [
  '/imagine ', '/imaginehd ', '/voz ', '/search ', '/scrape ',
  '/pdf ', '/html ', '/txt ', '/zip ',
];

/** Verdadeiro quando a barra da tela inicial deve deixar o comando para o ChatView. */
export function isChatCommand(content: string): boolean {
  return chatCommands.some((command) => content.startsWith(command));
}
