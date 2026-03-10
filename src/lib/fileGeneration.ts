import jsPDF from 'jspdf';
import JSZip from 'jszip';

export async function generatePDF(content: string, title = 'Documento Ventel IA'): Promise<string> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 25;

  // Add title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  const titleWrapped = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleWrapped, margin, y);
  y += titleWrapped.length * 10 + 5;

  // Add separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  const lines = content.split('\n');

  for (const line of lines) {
    if (y > pageHeight - 25) {
      pdf.addPage();
      y = 25;
    }

    // Headings
    if (line.startsWith('# ')) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      const text = line.replace('# ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 4;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 9 + 4;
    } else if (line.startsWith('## ')) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      const text = line.replace('## ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 3;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 7 + 3;
    } else if (line.startsWith('### ')) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      const text = line.replace('### ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 2;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 6 + 2;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const text = '• ' + line.replace(/^[-*]\s/, '').replace(/\*\*/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth - 5);
      pdf.text(wrapped, margin + 5, y);
      y += wrapped.length * 5.5;
    } else if (/^\d+\.\s/.test(line)) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const text = line.replace(/\*\*/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth - 5);
      pdf.text(wrapped, margin + 5, y);
      y += wrapped.length * 5.5;
    } else if (line === '') {
      y += 3;
    } else {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const text = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 5.5;
    }
  }

  // Add footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Gerado por Ventel IA • Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }

  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}

export function generateHTML(content: string, title = 'Documento Ventel IA'): string {
  // Check if content is already complete HTML
  if (content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html')) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  }

  // Wrap content in a styled HTML template
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #fafafa;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #1a1a1a; }
    h2 { font-size: 1.5rem; margin: 1.5rem 0 0.75rem; color: #333; }
    h3 { font-size: 1.25rem; margin: 1.25rem 0 0.5rem; color: #444; }
    p { margin-bottom: 1rem; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin-bottom: 0.5rem; }
    code { background: #e8e8e8; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #1a1a1a; color: #f8f8f8; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #6366f1; padding-left: 1rem; margin: 1rem 0; color: #555; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.85rem; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${markdownToHTML(content)}
  <div class="footer">Gerado por Ventel IA</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function markdownToHTML(markdown: string): string {
  let html = markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (lines that don't start with HTML tags)
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');

  return html;
}

export function generateTXT(content: string): string {
  // Remove markdown formatting for clean text
  const cleanText = content
    .replace(/^#{1,6}\s/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export interface ZipFile {
  name: string;
  content: string;
}

export async function generateZIP(filesJson: string, projectName = 'projeto-ventel'): Promise<string> {
  const zip = new JSZip();

  try {
    // Try to find JSON in the content
    const jsonMatch = filesJson.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON de arquivos não encontrado na resposta');
    }

    const data = JSON.parse(jsonMatch[0]);
    const files: ZipFile[] = data.files || [];

    if (files.length === 0) {
      throw new Error('Nenhum arquivo encontrado no JSON');
    }

    for (const file of files) {
      if (file.name && file.content) {
        zip.file(file.name, file.content);
      }
    }

    // Add a README if not present
    if (!files.some(f => f.name.toLowerCase() === 'readme.md')) {
      zip.file('README.md', `# ${projectName}\n\nProjeto gerado por Ventel IA\n\n## Arquivos\n\n${files.map(f => `- ${f.name}`).join('\n')}`);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Erro ao gerar ZIP:', e);
    throw new Error('Não foi possível gerar o arquivo ZIP. Verifique o formato do conteúdo.');
  }
}

export function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
