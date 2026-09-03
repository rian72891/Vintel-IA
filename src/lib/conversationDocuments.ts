import { supabase } from '@/integrations/supabase/client';

export const DOC_BUCKET = 'conversation-docs';

const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown', 'application/json', 'text/html'];

export function isSupportedDocument(file: File) {
  return (
    file.type === 'application/pdf' ||
    TEXT_TYPES.includes(file.type) ||
    /\.(txt|csv|md|json|log)$/i.test(file.name)
  );
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Worker via bundler URL (evita CDN e problemas de CORS)
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: buf }).promise;
  const pages: string[] = [];
  const max = Math.min(doc.numPages, 40);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => it.str ?? '').join(' '));
  }
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}

export async function extractDocumentText(file: File): Promise<string> {
  if (file.type === 'application/pdf') return extractPdfText(file);
  return (await file.text()).trim();
}

export interface IngestedDocument {
  id: string;
  name: string;
  chars: number;
}

/** Extrai o texto, guarda o arquivo no storage e registra em conversation_documents. */
export async function ingestConversationDocument(
  conversationId: string,
  file: File,
): Promise<IngestedDocument | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const text = await extractDocumentText(file);

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${user.id}/${conversationId}/${Date.now()}-${safeName}`;

  let storagePath: string | null = path;
  const { error: upErr } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) {
    console.error('Falha no upload do documento:', upErr.message);
    storagePath = null;
  }

  const { data, error } = await supabase
    .from('conversation_documents')
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      extracted_text: text.slice(0, 120_000) || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Falha ao registrar documento:', error.message);
    return null;
  }

  return { id: data.id, name: file.name, chars: text.length };
}
