import type { Conversation, Message } from '@/types/agent';

function fmtDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function conversationToMarkdown(conversation: {
  title?: string;
  agent?: string;
  createdAt?: Date | string;
  messages: Message[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${conversation.title || 'Conversa'}`);
  const meta: string[] = [];
  if (conversation.agent) meta.push(`Agente: ${conversation.agent}`);
  if (conversation.createdAt) meta.push(`Criada em: ${fmtDate(conversation.createdAt)}`);
  meta.push(`Exportada em: ${fmtDate(new Date())}`);
  lines.push('', `> ${meta.join(' · ')}`, '', '---', '');

  for (const m of conversation.messages) {
    if (m.role === 'system') continue;
    const who = m.role === 'user' ? '👤 Você' : '🤖 Vintel IA';
    lines.push(`## ${who}`);
    const ts = m.timestamp ? fmtDate(m.timestamp) : '';
    if (ts) lines.push('', `*${ts}*`);
    lines.push('', m.content.trim(), '');
    if (m.attachments?.length) {
      lines.push(
        ...m.attachments.map((a: any) => `- Anexo: ${a?.name || a?.type || 'arquivo'}`),
        '',
      );
    }
    lines.push('---', '');
  }

  return lines.join('\n');
}

export function slugify(text: string) {
  return (text || 'conversa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || 'conversa';
}

export function downloadMarkdown(conversation: Conversation) {
  const md = conversationToMarkdown(conversation as any);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(conversation.title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
